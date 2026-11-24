import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getDb, persist } from "./db";

export type UserRole = "admin" | "client";
export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  whatsappNumber: string;
  status: UserStatus;
  createdAt: string;
}

/** What's safe to send to the browser / use in a session — never the hash. */
export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.passwordHash),
    name: String(row.name),
    role: row.role as UserRole,
    whatsappNumber: String(row.whatsappNumber ?? ""),
    status: row.status as UserStatus,
    createdAt: String(row.createdAt),
  };
}

/** Runs a SELECT and returns every matching row as a plain object array —
 * sql.js's native result shape (parallel `columns`/`values` arrays) is
 * awkward to work with directly, so every read goes through this. */
function queryAll(
  db: Awaited<ReturnType<typeof getDb>>,
  sql: string,
  params: (string | number)[] = []
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const rows = queryAll(db, "SELECT COUNT(*) as count FROM users");
  return Number(rows[0]?.count ?? 0);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function listClients(): Promise<User[]> {
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM users WHERE role = 'client' ORDER BY createdAt ASC");
  return rows.map(rowToUser);
}

export async function listAllUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM users ORDER BY createdAt ASC");
  return rows.map(rowToUser);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

function makeId(): string {
  return randomUUID();
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  whatsappNumber?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("A user with that email already exists.");
  }

  const user: User = {
    id: makeId(),
    email,
    passwordHash: await hashPassword(input.password),
    name: input.name.trim() || email,
    role: input.role,
    whatsappNumber: input.whatsappNumber?.trim() ?? "",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  db.run(
    `INSERT INTO users (id, email, passwordHash, name, role, whatsappNumber, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.passwordHash, user.name, user.role, user.whatsappNumber, user.status, user.createdAt]
  );
  await persist(db);

  return user;
}

export interface UpdateUserInput {
  name?: string;
  whatsappNumber?: string;
  status?: UserStatus;
  password?: string;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<User | null> {
  const db = await getDb();
  const existing = await getUserById(id);
  if (!existing) return null;

  const next: User = {
    ...existing,
    name: patch.name?.trim() || existing.name,
    whatsappNumber: patch.whatsappNumber !== undefined ? patch.whatsappNumber.trim() : existing.whatsappNumber,
    status: patch.status ?? existing.status,
    passwordHash: patch.password ? await hashPassword(patch.password) : existing.passwordHash,
  };

  db.run(
    `UPDATE users SET name = ?, whatsappNumber = ?, status = ?, passwordHash = ? WHERE id = ?`,
    [next.name, next.whatsappNumber, next.status, next.passwordHash, id]
  );
  await persist(db);

  return next;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = await getDb();
  const existing = await getUserById(id);
  if (!existing) return false;

  db.run("DELETE FROM users WHERE id = ?", [id]);
  await persist(db);
  return true;
}

/**
 * First-run setup: if the database has no users at all yet, create the
 * one admin account from ADMIN_EMAIL / ADMIN_PASSWORD environment
 * variables. Only called from the login route (right before checking
 * credentials) — deliberately NOT from the general getCurrentUser() check
 * every page runs, because Next.js tries rendering every page once at
 * build time to decide whether it can be pre-built as static HTML, and
 * runs everything up to (but not including) the first cookie/session
 * read for real while doing that. A database write sitting in that path
 * would — and once did — run for real during the build, more than once,
 * which is how two attempts raced to create the same admin account and
 * failed the whole build. Keeping this out of the common path means it
 * only ever runs when someone actually submits the login form.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const existing = await countUsers();
  if (existing > 0) return;

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    // Nothing to do — the login page will explain that these need to be
    // set. We deliberately don't fall back to a hardcoded default
    // password for a publicly-reachable app.
    return;
  }

  try {
    await createUser({ email, password, name: "Admin", role: "admin" });
  } catch (err) {
    // Two near-simultaneous first logins could both pass the countUsers()
    // check above before either has inserted anything. Whichever loses
    // that race hits a duplicate-email error here — harmless, since the
    // other one succeeded at creating the same admin account a moment
    // earlier. Anything else is a real problem and should still surface.
    const isDuplicateEmail = err instanceof Error && /already exists/i.test(err.message);
    if (!isDuplicateEmail) throw err;
  }
}
