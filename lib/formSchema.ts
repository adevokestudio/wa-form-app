/**
 * The field types the drag-and-drop builder supports.
 *
 * "Basic" set (from the plan doc, minus Address/Location pin which still
 * need a maps library): text, choice, checkbox, dropdown, number, rating,
 * date, email, phone, title, image, video.
 *
 * "Advanced" set: file, voice, signature, booking, calculation, quote,
 * payment — each maps to one row of the plan doc's Advanced table.
 *
 * "image" and "video" are dedicated media-answer types alongside the
 * generic "file" (Advanced) — same underlying upload mechanism, just
 * scoped to one media kind and surfaced in Basic since attaching a photo or
 * clip is common enough not to need the Advanced tab.
 */
export type FieldType =
  | "text"
  | "choice"
  | "checkbox"
  | "dropdown"
  | "number"
  | "rating"
  | "date"
  | "email"
  | "phone"
  | "title"
  | "image"
  | "video"
  | "file"
  | "voice"
  | "signature"
  | "booking"
  | "calculation"
  | "quote"
  | "payment";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  /** Short one-line description shown on its "add a field" card in the
   * builder (Basic and Advanced tabs render these the same way). */
  description: string;
  hasOptions: boolean;
  isAnswerField: boolean; // false for "title", which is display-only
  advanced?: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  {
    type: "text",
    label: "Text Input",
    description: "A single-line text answer.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "choice",
    label: "Multiple Choice",
    description: "Respondent picks one option from a list.",
    hasOptions: true,
    isAnswerField: true,
  },
  {
    type: "checkbox",
    label: "Checkbox",
    description: "Respondent picks any number of options.",
    hasOptions: true,
    isAnswerField: true,
  },
  {
    type: "dropdown",
    label: "Dropdown",
    description: "Respondent picks one option from a dropdown.",
    hasOptions: true,
    isAnswerField: true,
  },
  {
    type: "number",
    label: "Number",
    description: "Collects a numeric answer.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "rating",
    label: "Rating",
    description: "A star rating scale.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "date",
    label: "Date",
    description: "Collects a date.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "email",
    label: "Email",
    description: "Collects an email address.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "phone",
    label: "Phone",
    description: "Collects a phone number.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "title",
    label: "Title / Heading",
    description: "A heading or section title — no answer collected.",
    hasOptions: false,
    isAnswerField: false,
  },
  {
    type: "image",
    label: "Image",
    description: "Lets the respondent attach a photo as their answer.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "video",
    label: "Video",
    description: "Lets the respondent attach a short video clip as their answer.",
    hasOptions: false,
    isAnswerField: true,
  },
  {
    type: "file",
    label: "File Upload",
    description: "Lets the respondent attach a file or photo as their answer.",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "voice",
    label: "Voice Note",
    description: "Lets the respondent record and attach a short voice note.",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "signature",
    label: "E-Signature",
    description: "Draw a signature for waivers and consent forms.",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "booking",
    label: "Booking / Appointment Slot",
    description: "Respondent picks from slots you define; already-taken ones gray out automatically.",
    hasOptions: true,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "calculation",
    label: "Calculation",
    description: "Computes a value from other fields (e.g. nights × rate).",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "quote",
    label: "Live Quote Calculator",
    description: "Like Calculation, styled as a prominent running total with a currency prefix.",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
  {
    type: "payment",
    label: "Payment Link",
    description: "Attach a Stripe/PayHere payment link, optionally with the amount appended.",
    hasOptions: false,
    isAnswerField: true,
    advanced: true,
  },
];

export type ConditionOperator = "equals" | "not_equals" | "contains";

/** Shows this field only when another field's answer matches. Powers
 * Conditional Logic. */
export interface FieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  /** Choices for choice / checkbox / dropdown / booking fields. For
   * "booking" these are the available slot labels. */
  options?: string[];
  /** Conditional Logic: hide this field unless the condition matches. */
  condition?: FieldCondition;
  /** For "calculation" / "quote": an expression like "{f1} * {f2}",
   * referencing other fields by id. See lib/formula.ts. */
  formula?: string;
  /** For "quote": a currency prefix shown before the computed total, e.g. "Rs. ". */
  currencyPrefix?: string;
  /** For "payment": the payment link URL (a Stripe/PayHere payment link
   * created in their dashboard — no API keys needed here). */
  paymentUrl?: string;
  /** For "payment": optionally append "?amount=<value>" from a
   * calculation/quote field's live value. */
  appendAmountFromFieldId?: string;
}

/** Conditional WhatsApp Routing: send to a different number when a rule
 * matches, evaluated top to bottom; the form's own whatsappNumber is the
 * fallback when nothing matches. */
export interface RoutingRule {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string;
  whatsappNumber: string;
}

/**
 * Post-submission integrations — these act on a response after it's
 * captured, rather than collecting part of the answer (see the
 * "Integrations (Advanced tab)" section of the plan doc). Google Sheet is
 * the first one wired up; Webhook / Google Analytics / Meta Pixel are
 * captured in the plan but not built yet.
 */
export interface FormIntegrations {
  googleSheet?: {
    enabled: boolean;
    /** The Apps Script Web App URL the user deploys on their own Sheet. */
    webAppUrl: string;
  };
}

/** Settings → SEO: real, wired into the public form page's <head> via
 * generateMetadata — not a stub. */
export interface FormSeoSettings {
  /** Whether search engines are allowed to index this form. Defaults to
   * false (most WhatsApp forms are shared via direct link, not search). */
  indexable?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  /** An absolute or root-relative image URL used for social/link previews. */
  metaImageUrl?: string;
}

/** Settings → Notifications: not built yet (would need a WhatsApp Business
 * API integration for outbound messages, and an email provider) — the
 * toggles save their state but the panel is presented as "Coming soon" in
 * the UI so this isn't overstated. */
export interface FormNotificationSettings {
  whatsapp?: boolean;
  email?: boolean;
}

/** Settings → Team: which destination-number strategy is active. "single"
 * uses the form's whatsappNumber for everyone; "conditional" uses
 * routingRules (Conditional WhatsApp Routing, already built); "distribute"
 * (round-robin across a team) isn't built yet. */
export type TeamMode = "single" | "distribute" | "conditional";

export interface FormDefinition {
  slug: string;
  name: string;
  whatsappNumber: string;
  fields: FormField[];
  integrations?: FormIntegrations;
  /** Conditional WhatsApp Routing rules (Advanced tab / Settings → Team). */
  routingRules?: RoutingRule[];
  /** QR Handoff (Desktop Fallback): show a QR code linking to the wa.me
   * chat when WhatsApp doesn't open automatically. Defaults to true. */
  showQrFallback?: boolean;
  /** Settings → General: when false, the public form page shows a "not
   * accepting responses" state instead of the form. Defaults to true. */
  enabled?: boolean;
  /** Settings → General: label on the public form's submit button.
   * Defaults to "Send via WhatsApp". */
  submitButtonText?: string;
  seo?: FormSeoSettings;
  notifications?: FormNotificationSettings;
  teamMode?: TeamMode;
}

export function fieldTypeMeta(type: FieldType): FieldTypeMeta {
  // The `?? ` fallback is defensive only — every FieldType has an entry
  // above — so it's found by type ("text") rather than array position,
  // which would silently break if FIELD_TYPES is ever reordered again.
  return FIELD_TYPES.find((f) => f.type === type) ?? FIELD_TYPES.find((f) => f.type === "text") ?? FIELD_TYPES[0];
}

export function makeFieldId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeRuleId(): string {
  return `rule_${Math.random().toString(36).slice(2, 10)}`;
}

/** Evaluates a single Conditional Logic / routing condition against the
 * current answer values (all compared as strings, case-insensitively for
 * "contains"). */
export function evaluateCondition(
  condition: { fieldId: string; operator: ConditionOperator; value: string },
  values: Record<string, string | string[] | undefined>
): boolean {
  const raw = values[condition.fieldId];
  const actual = Array.isArray(raw) ? raw.join(", ") : raw ?? "";

  switch (condition.operator) {
    case "equals":
      return actual.trim().toLowerCase() === condition.value.trim().toLowerCase();
    case "not_equals":
      return actual.trim().toLowerCase() !== condition.value.trim().toLowerCase();
    case "contains":
      return actual.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return true;
  }
}
