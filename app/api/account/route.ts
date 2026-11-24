import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById, toPublicUser, updateUser, verifyPassword } from "@/lib/usersStore";

/** A user updating their own profile — WhatsApp number and/or password.
 * Changing the password requires the current one; nothing here lets a
 * caller touch anyone's account but their own. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing request body" }, { status: 400 });
  }

  const patch: { whatsappNumber?: string; password?: string } = {};

  if (typeof body.whatsappNumber === "string") {
    patch.whatsappNumber = body.whatsappNumber;
  }

  if (typeof body.newPassword === "string" && body.newPassword) {
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const fullUser = await getUserById(user.id);
    if (!fullUser || !(await verifyPassword(fullUser, body.currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }

    patch.password = body.newPassword;
  }

  const updated = await updateUser(user.id, patch);
  if (!updated) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({ ok: true, user: toPublicUser(updated) });
}
