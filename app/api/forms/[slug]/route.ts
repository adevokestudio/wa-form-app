import { NextRequest, NextResponse } from "next/server";
import { deleteForm, getForm, patchForm, saveForm } from "@/lib/formsStore";
import type { FormDefinition } from "@/lib/formSchema";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/forms/[slug]">
) {
  const { slug } = await context.params;
  const form = await getForm(slug);

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ form });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/forms/[slug]">
) {
  const { slug } = await context.params;
  const body = await request.json();

  if (!body || !Array.isArray(body.fields)) {
    return NextResponse.json({ error: "Missing fields[]" }, { status: 400 });
  }

  // Merge onto whatever is already stored (rather than constructing a fresh
  // object) so fields the builder's "Save form" doesn't know about — e.g.
  // Settings-page state like seo/notifications/enabled/teamMode — survive a
  // builder save instead of being silently wiped out.
  const existing = await getForm(slug);

  const definition: FormDefinition = {
    ...existing,
    slug,
    name: typeof body.name === "string" && body.name.trim() ? body.name : "Untitled form",
    whatsappNumber: typeof body.whatsappNumber === "string" ? body.whatsappNumber : "",
    fields: body.fields,
    integrations: body.integrations && typeof body.integrations === "object" ? body.integrations : undefined,
    routingRules: Array.isArray(body.routingRules) ? body.routingRules : undefined,
    showQrFallback: typeof body.showQrFallback === "boolean" ? body.showQrFallback : undefined,
  };

  await saveForm(definition);
  return NextResponse.json({ ok: true, form: definition });
}

/** Partial update — used by the Settings pages (General, SEO, Notifications,
 * Team) and the dashboard's Rename action, each of which only touches its
 * own slice of the form rather than resending everything. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/forms/[slug]">
) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing patch body" }, { status: 400 });
  }

  const form = await patchForm(slug, body);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, form });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/forms/[slug]">
) {
  const { slug } = await context.params;
  const ok = await deleteForm(slug);

  if (!ok) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
