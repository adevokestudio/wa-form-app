import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";
import { ensureBootstrapAdmin, getUserByEmail, verifyPassword } from "@/lib/usersStore";

export async function POST(request: NextRequest) {
  await ensureBootstrapAdmin();

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  if (user.status !== "active") {
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }

  await createSessionCookie(user.id, user.role);

  return NextResponse.json({ ok: true, role: user.role });
}
