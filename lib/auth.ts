import { redirect } from "next/navigation";
import type { FormDefinition } from "./formSchema";
import { readSession } from "./session";
import { ensureBootstrapAdmin, getUserById, type PublicUser, toPublicUser } from "./usersStore";

/** Returns the logged-in user (or null), and makes sure the one-time
 * bootstrap admin exists first — cheap (a single in-memory COUNT query)
 * and safe to call on every request. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  await ensureBootstrapAdmin();

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
