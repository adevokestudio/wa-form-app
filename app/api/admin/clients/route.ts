import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { createUser, listClients, toPublicUser } from "@/lib/usersStore";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const clients = await listClients();
  return NextResponse.json({ clients: clients.map(toPublicUser) });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const whatsappNumber = typeof body?.whatsappNumber === "string" ? body.whatsappNumber.trim() : "";

  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Name, a valid email, and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  try {
    const user = await createUser({ name, email, password, whatsappNumber, role: "client" });
    return NextResponse.json({ ok: true, client: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't create that client." },
      { status: 400 }
    );
  }
}
