import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { withApiError } from "@/lib/apiRoute";
import { deleteUser, getUserById, toPublicUser, updateUser } from "@/lib/usersStore";

export const PATCH = withApiError(async (request: NextRequest, context: RouteContext<"/api/admin/clients/[id]">) => {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await context.params;
  const target = await getUserById(id);
  if (!target || target.role !== "client") {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing patch body" }, { status: 400 });
  }

  if (typeof body.password === "string" && body.password && body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const updated = await updateUser(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    whatsappNumber: typeof body.whatsappNumber === "string" ? body.whatsappNumber : undefined,
    status: body.status === "active" || body.status === "disabled" ? body.status : undefined,
    password: typeof body.password === "string" && body.password ? body.password : undefined,
    // Admin-only "premium" switch for the Catalogue/Cart feature — this
    // route is already gated to admins by requireAdminApi above, so a
    // client can never grant this to themselves via /api/account.
    catalogEnabled: typeof body.catalogEnabled === "boolean" ? body.catalogEnabled : undefined,
  });

  if (!updated) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ ok: true, client: toPublicUser(updated) });
});

export const DELETE = withApiError(async (_request: NextRequest, context: RouteContext<"/api/admin/clients/[id]">) => {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await context.params;
  const target = await getUserById(id);
  if (!target || target.role !== "client") {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const ok = await deleteUser(id);
  if (!ok) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
