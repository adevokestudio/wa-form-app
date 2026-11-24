import { cookies } from "next/headers";
import { webcrypto } from "node:crypto";

/**
 * A minimal signed-cookie session — no external auth library. The token is
 * `<base64url payload>.<base64url HMAC-SHA256 signature>`, verified with the
 * Web Crypto API (`node:crypto`'s `webcrypto`, the same interface the Edge
 * runtime exposes) so this file would keep working unchanged if the app
 * ever grows real middleware. Kept deliberately small: one more dependency
 * is one more thing that can refuse to install or load on this host.
 */

const COOKIE_NAME = "wa_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Falls back to a secret generated once when the server process starts if
// SESSION_SECRET isn't set. That means every login is invalidated whenever
// the server restarts — a safe default (nobody can forge a session without
// knowing a secret that isn't written down anywhere) rather than shipping
// a hardcoded fallback key. Set SESSION_SECRET in production so logins
// survive restarts/redeploys.
const SECRET = process.env.SESSION_SECRET || webcrypto.randomUUID() + webcrypto.randomUUID();

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return webcrypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return Buffer.from(binary, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

export interface SessionPayload {
  userId: string;
  role: "admin" | "client";
  exp: number;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await webcrypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await getKey();
    const encoder = new TextEncoder();
    const valid = await webcrypto.subtle.verify("HMAC", key, base64UrlDecode(sigB64), encoder.encode(payloadB64));
    if (!valid) return null;

    const json = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "client") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionCookie(userId: string, role: "admin" | "client"): Promise<void> {
  const token = await signSession({ userId, role, exp: Date.now() + SESSION_DURATION_MS });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
