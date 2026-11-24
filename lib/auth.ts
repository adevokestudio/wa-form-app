import { redirect } from "next/navigation";
import type { FormDefinition } from "./formSchema";
import { readSession } from "./session";
import { getUserById, type PublicUser, toPublicUser } from "./usersStore";

/**
 * Returns the logged-in user (or null). Reads the session cookie first,
 * before touching the database at all — Next.js tries rendering every
 * page once at build time to see whether it can be pre-built as static
 * HTML, and reading the session cookie is what tells it "no, this page
 * depends on the visitor, render it fresh every time" and stops right
 * there. Anything placed before that cookie read (a database write, for
 * instance) would run for real during that build-time trial render —
 * which is exactly what used to happen here before the bootstrap-admin
 * creation moved out of this function (see ensureBootstrapAdmin's own
 * comment in usersStore.ts).
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user || user.status !== "active") return null;

  return toPublicUser(user);
}

/** For any page/layout that requires being logged in, regardless of role.
 * Redirects to /login (preserving where the visitor was headed) when not. */
export async function requireUser(nextPath?: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${query}`);
  }
  return user;
}

/** For admin-only pages (the client management area). Sends a logged-in
 * non-admin back to their own dashboard rather than the login page. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}

/** Admins can see/edit every client's forms; a client can only see/edit
 * their own. Used by the forms API routes before reading or changing a
 * specific form. */
export function canAccessForm(user: PublicUser, form: Pick<FormDefinition, "ownerId">): boolean {
  return user.role === "admin" || form.ownerId === user.id;
}
