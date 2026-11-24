import { NextRequest, NextResponse } from "next/server";
import { canAccessForm, getCurrentUser } from "@/lib/auth";
import { withApiError } from "@/lib/apiRoute";
import { duplicateForm, getForm } from "@/lib/formsStore";

export const POST = withApiError(async (
  _request: NextRequest,
  context: RouteContext<"/api/forms/[slug]/duplicate">
) => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { slug } = await context.params;
  const existing = await getForm(slug);
  if (!existing || !canAccessForm(user, existing)) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const copy = await duplicateForm(slug);
  if (!copy) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, form: copy }, { status: 201 });
});
