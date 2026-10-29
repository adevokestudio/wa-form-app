import { NextRequest, NextResponse } from "next/server";
import { createForm, listForms } from "@/lib/formsStore";

/** Backs the dashboard: list every form, and create a new (near-empty) one. */

export async function GET() {
  const forms = await listForms();
  return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  const form = await createForm(name);
  return NextResponse.json({ ok: true, form }, { status: 201 });
}
