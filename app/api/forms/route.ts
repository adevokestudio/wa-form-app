import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withApiError } from "@/lib/apiRoute";
import { createForm, listForms } from "@/lib/formsStore";
import { getUserById } from "@/lib/usersStore";

/** Backs the dashboard: list every form for the signed-in account (or, for
 * an admin viewing a specific client via ?client=<id>, that client's
 * forms), and create a new (near-empty) one for that same account. */

async function resolveOwnerId(request: NextRequest): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const clientId = request.nextUrl.searchParams.get("client");
  if (clientId && user.role === "admin") return clientId;

  return user.id;
}

export const GET = withApiError(async (request: NextRequest) => {
  const ownerId = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const forms = await listForms(ownerId);
  return NextResponse.json({ forms });
});

export const POST = withApiError(async (request: NextRequest) => {
  const ownerId = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  const owner = await getUserById(ownerId);
  const form = await createForm(name, ownerId, owner?.whatsappNumber ?? "");
  return NextResponse.json({ ok: true, form }, { status: 201 });
});
