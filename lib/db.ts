import { promises as fs } from "fs";
import path from "path";
import initSqlJs, { type Database } from "sql.js";

/**
 * Accounts database — a real SQLite database (via sql.js, which compiles
 * SQLite to WebAssembly) rather than a native-binary SQLite driver. This
 * project got badly burned once already by a native binary (@next/swc)
 * refusing to load on this host's older glibc; sql.js has no native
 * component at all, so that whole class of problem can't recur here. It
 * lives in one file (data/users.db) next to the existing forms.json /
 * submissions.json, so backups/restores work the same way.
 *
 * sql.js keeps the whole database in memory and only touches disk when we
 * explicitly export() and write it out, so every write here re-persists
 * the full file. That's the same "good enough" tradeoff the JSON stores
 * already make, at a scale (a handful of client accounts) where it's a
 * non-issue.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "users.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
    whatsappNumber TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    createdAt TEXT NOT NULL
  );
`;

let dbPromise: Promise<Database> | null = null;

async function loadDb(): Promise<Database> {
  const SQL = await initSqlJs();
  await fs.mkdir(DATA_DIR, { recursive: true });

  let db: Database;
  try {
    const buffer = await fs.readFile(DB_FILE);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  return db;
}

/** The shared, lazily-initialized database instance for this server
 * process. Hostinger runs this app as a long-lived Node process (not
 * per-request serverless functions), so one in-memory instance reused
 * across requests is the right model — same as the JSON stores already
 * do implicitly by re-reading their file each call, except here we keep
 * the parsed DB warm instead of re-parsing on every query. */
export async function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = loadDb();
  return dbPromise;
}

// Serialize writes so two near-simultaneous requests can't interleave
// their file writes and corrupt the on-disk copy.
let saveQueue: Promise<void> = Promise.resolve();

export async function persist(db: Database): Promise<void> {
  saveQueue = saveQueue.then(async () => {
    const data = db.export();
    // Defensive, not just belt-and-braces: Next.js can bundle this module
    // separately per route handler, so don't assume some other route's
    // loadDb() already created the folder — make sure it exists right
    // before every write, not only once at load time.
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, Buffer.from(data));
  });
  await saveQueue;
}
