import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

/** For admin-only API routes: returns a ready-to-return 401/403 response
 * when the caller isn't an admin, or null when it's fine to proceed —
 * `const denied = await requireAdminApi(); if (denied) return denied;` */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return null;
}
