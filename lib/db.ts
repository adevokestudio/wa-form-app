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

/**
 * Columns added after the table above first shipped — the WhatsApp
 * Catalogue/Cart premium feature's per-client settings (whether it's
 * switched on for them, and their own payment details, so money goes
 * straight to each client rather than through us). `ALTER TABLE ... ADD
 * COLUMN` has no "IF NOT EXISTS" in SQLite, so each one is attempted and a
 * "duplicate column" error (meaning a previous run already added it) is
 * swallowed; anything else still surfaces.
 */
const MIGRATIONS: string[] = [
  `ALTER TABLE users ADD COLUMN catalogEnabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN paypalMeUsername TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN payHereMerchantId TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN payHereMerchantSecret TEXT NOT NULL DEFAULT ''`,
  // Defaults to sandbox (1) so a client's first-ever save of their PayHere
  // details can't accidentally start taking real payments before they've
  // tested the flow and switched this off themselves.
  `ALTER TABLE users ADD COLUMN payHereSandbox INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN bankTransferDetails TEXT NOT NULL DEFAULT ''`,
];

function runMigrations(db: Database): void {
  for (const statement of MIGRATIONS) {
    try {
      db.run(statement);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column name/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }
}

let dbPromise: Promise<Database> | null = null;

async function loadDb(): Promise<Database> {
  // Don't let sql.js guess where its own .wasm binary lives (relative to
  // its own folder inside node_modules) — on Hostinger that file was
  // missing from the deployed copy of node_modules/sql.js/dist entirely,
  // even though it exists right after `npm install`. scripts/copy-sql-wasm.js
  // copies it into public/ at build time instead (public/ always survives
  // deployment — it has to, for the app's static assets to work at all),
  // and this points sql.js there directly.
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "public", file),
    useOldExtensionFunctions: false,
  });
  await fs.mkdir(DATA_DIR, { recursive: true });

  let db: Database;
  try {
    const buffer = await fs.readFile(DB_FILE);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  runMigrations(db);
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
