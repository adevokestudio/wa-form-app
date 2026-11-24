import { promises as fs } from "fs";
import path from "path";
import type { FormDefinition, FormField } from "./formSchema";
import { makeFieldId } from "./formSchema";
import { listAllUsers } from "./usersStore";

/**
 * Server-only JSON-file store for form definitions.
 *
 * Same reasoning as the submissions store: no database yet, but the builder
 * and the public form page both need to read/write the same data, so it
 * can't just live in client-side React state. Swap this for real Postgres
 * reads/writes (see the Data model section of the plan doc) once accounts
 * exist — the function signatures below are written to make that swap a
 * drop-in change.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FORMS_FILE = path.join(DATA_DIR, "forms.json");

const DEFAULT_FORMS: FormDefinition[] = [
  {
    slug: "test",
    name: "Booking Enquiry",
    whatsappNumber: process.env.NEXT_PUBLIC_TEST_FORM_WHATSAPP_NUMBER || "94700000000",
    fields: [
      { id: "f1", type: "text", label: "Name", required: true },
      { id: "f2", type: "phone", label: "Phone", required: true },
      { id: "f3", type: "text", label: "Message", required: true },
    ],
  },
];

async function readAll(): Promise<FormDefinition[]> {
  let forms: FormDefinition[];
  try {
    const raw = await fs.readFile(FORMS_FILE, "utf-8");
    forms = JSON.parse(raw) as FormDefinition[];
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FORMS_FILE, JSON.stringify(DEFAULT_FORMS, null, 2), "utf-8");
    forms = DEFAULT_FORMS;
  }

  // One-time migration: forms created before client accounts existed have
  // no ownerId. Once an admin account exists, fold them into the admin's
  // own dashboard rather than leaving them unreachable by anyone.
  const orphans = forms.filter((f) => !f.ownerId);
  if (orphans.length > 0) {
    const users = await listAllUsers();
    const admin = users.find((u) => u.role === "admin");
    if (admin) {
      forms = forms.map((f) => (f.ownerId ? f : { ...f, ownerId: admin.id }));
      await writeAll(forms);
    }
  }

  return forms;
}

/** Every form belonging to one account — a client's own forms, or (for the
 * admin's own dashboard, as opposed to viewing a specific client) the
 * admin's own/unassigned forms. */
export async function listForms(ownerId: string): Promise<FormDefinition[]> {
  const forms = await readAll();
  return forms.filter((f) => f.ownerId === ownerId);
}

export async function getForm(slug: string): Promise<FormDefinition | null> {
  const forms = await readAll();
  return forms.find((f) => f.slug === slug) ?? null;
}

async function writeAll(forms: FormDefinition[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FORMS_FILE, JSON.stringify(forms, null, 2), "utf-8");
}

export async function saveForm(definition: FormDefinition): Promise<void> {
  const forms = await readAll();
  const index = forms.findIndex((f) => f.slug === definition.slug);

  if (index >= 0) {
    forms[index] = definition;
  } else {
    forms.push(definition);
  }

  await writeAll(forms);
}

/** Partial update — used by the dashboard's Rename action and the Settings
 * pages, which each only touch a few fields rather than resending the whole
 * form the way the builder's "Save form" button does. */
export async function patchForm(
  slug: string,
  patch: Partial<Omit<FormDefinition, "slug">>
): Promise<FormDefinition | null> {
  const forms = await readAll();
  const index = forms.findIndex((f) => f.slug === slug);
  if (index < 0) return null;

  forms[index] = { ...forms[index], ...patch };
  await writeAll(forms);
  return forms[index];
}

export async function deleteForm(slug: string): Promise<boolean> {
  const forms = await readAll();
  const next = forms.filter((f) => f.slug !== slug);
  if (next.length === forms.length) return false;
  await writeAll(next);
  return true;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "form"
  );
}

async function uniqueSlug(base: string, taken: Set<string>): Promise<string> {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

/** Creates a new, near-empty form (just a title field) — used by the
 * dashboard's "+ New WhatsForm" button. `ownerId` is the account (client,
 * or admin viewing their own dashboard) it belongs to; its WhatsApp number
 * is pre-filled from that account's own number so each client's forms
 * reach their own phone by default, with per-form overrides still
 * available in Settings → Team. */
export async function createForm(
  name: string,
  ownerId: string,
  defaultWhatsappNumber = ""
): Promise<FormDefinition> {
  const forms = await readAll();
  const taken = new Set(forms.map((f) => f.slug));
  const slug = await uniqueSlug(slugify(name || "Untitled form"), taken);

  const definition: FormDefinition = {
    slug,
    name: name.trim() || "Untitled form",
    ownerId,
    whatsappNumber: defaultWhatsappNumber,
    fields: [{ id: makeFieldId(), type: "title", label: name.trim() || "Untitled form" }],
    enabled: true,
    teamMode: "single",
  };

  forms.push(definition);
  await writeAll(forms);
  return definition;
}

/** Copies a form under a new slug, including its fields, routing rules and
 * settings — remapping field ids so formulas, conditions, payment
 * amount-references and routing rules still point at the right (new)
 * fields instead of the original form's ids. */
export async function duplicateForm(slug: string): Promise<FormDefinition | null> {
  const forms = await readAll();
  const source = forms.find((f) => f.slug === slug);
  if (!source) return null;

  const taken = new Set(forms.map((f) => f.slug));
  const newSlug = await uniqueSlug(`${source.slug}-copy`, taken);

  const idMap = new Map<string, string>();
  for (const field of source.fields) idMap.set(field.id, makeFieldId());

  function remapFormula(formula: string | undefined): string | undefined {
    if (!formula) return formula;
    return formula.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, oldId: string) =>
      idMap.has(oldId) ? `{${idMap.get(oldId)}}` : match
    );
  }

  const fields: FormField[] = source.fields.map((field) => ({
    ...field,
    id: idMap.get(field.id) ?? field.id,
    condition: field.condition
      ? { ...field.condition, fieldId: idMap.get(field.condition.fieldId) ?? field.condition.fieldId }
      : undefined,
    formula: remapFormula(field.formula),
    appendAmountFromFieldId: field.appendAmountFromFieldId
      ? idMap.get(field.appendAmountFromFieldId) ?? field.appendAmountFromFieldId
      : undefined,
  }));

  const routingRules = (source.routingRules ?? []).map((rule) => ({
    ...rule,
    id: `rule_${Math.random().toString(36).slice(2, 10)}`,
    fieldId: idMap.get(rule.fieldId) ?? rule.fieldId,
  }));

  const duplicate: FormDefinition = {
    ...source,
    slug: newSlug,
    name: `${source.name} (copy)`,
    fields,
    routingRules,
  };

  forms.push(duplicate);
  await writeAll(forms);
  return duplicate;
}
