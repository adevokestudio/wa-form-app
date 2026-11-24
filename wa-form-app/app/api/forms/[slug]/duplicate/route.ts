import { NextRequest, NextResponse } from "next/server";
import { duplicateForm } from "@/lib/formsStore";

export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/forms/[slug]/duplicate">
) {
  const { slug } = await context.params;
  const copy = await duplicateForm(slug);

  if (!copy) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, form: copy }, { status: 201 });
}
