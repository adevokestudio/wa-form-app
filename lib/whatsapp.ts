/**
 * Helpers for the "click-to-WhatsApp" delivery mechanic.
 *
 * The core idea: instead of sending messages through the WhatsApp Business
 * API, we build a `wa.me` deep link with the form answers pre-filled as the
 * message text. When the respondent opens that link, their own WhatsApp app
 * opens with the chat ready to send — the message genuinely comes from their
 * own number once they tap Send.
 *
 * See the "How the click-to-WhatsApp mechanic works" section of the
 * development plan doc for the full write-up of trade-offs and limitations.
 */

import { evaluateCondition, type FormDefinition } from "./formSchema";

export type FormAnswers = Record<string, string>;

/** An ordered label/value pair, used where field order must be preserved
 * exactly regardless of whether two fields share a label. */
export type AnswerEntry = { label: string; value: string };

/**
 * WhatsApp's practical limit on pre-filled message length varies by client,
 * but staying comfortably under ~1000 characters avoids truncation issues
 * across mobile, WhatsApp Web, and desktop.
 */
export const WHATSAPP_MESSAGE_SOFT_LIMIT = 1000;

/**
 * Turns a phone number into the digits-only international format wa.me
 * expects (no "+", spaces, dashes, or leading zeros after the country code).
 */
export function normalizeWhatsAppNumber(rawNumber: string): string {
  return rawNumber.replace(/[^\d]/g, "");
}

/**
 * Builds the message body from the form's answers, in field order, as
 * "Label: value" lines under a heading naming the form. Accepts either an
 * ordered array (preferred — guarantees order even with duplicate labels)
 * or a plain record for convenience.
 */
export function buildMessage(formName: string, answers: FormAnswers | AnswerEntry[]): string {
  const lines = [`New submission: ${formName}`, ""];
  const entries: AnswerEntry[] = Array.isArray(answers)
    ? answers
    : Object.entries(answers).map(([label, value]) => ({ label, value }));

  for (const { label, value } of entries) {
    if (!value) continue;
    lines.push(`${label}: ${value}`);
  }

  return lines.join("\n");
}

/**
 * Builds the full wa.me URL for a destination number and message.
 * Truncates the message if it would exceed the soft limit, so a long form
 * never silently fails to open WhatsApp.
 */
export function buildWhatsAppLink(destinationNumber: string, message: string): string {
  const number = normalizeWhatsAppNumber(destinationNumber);

  const safeMessage =
    message.length > WHATSAPP_MESSAGE_SOFT_LIMIT
      ? message.slice(0, WHATSAPP_MESSAGE_SOFT_LIMIT - 1) + "…"
      : message;

  const encoded = encodeURIComponent(safeMessage);
  return `https://wa.me/${number}?text=${encoded}`;
}

/**
 * Conditional WhatsApp Routing: picks the destination number for a
 * submission by checking the form's routing rules in order against the
 * current answer values (keyed by field id — see evaluateCondition).
 * Falls back to the form's own whatsappNumber when no rule matches, or
 * when there are no rules at all.
 */
export function resolveDestinationNumber(
  form: Pick<FormDefinition, "whatsappNumber" | "routingRules">,
  valuesByFieldId: Record<string, string | string[] | undefined>
): string {
  for (const rule of form.routingRules ?? []) {
    if (evaluateCondition(rule, valuesByFieldId) && rule.whatsappNumber) {
      return rule.whatsappNumber;
    }
  }
  return form.whatsappNumber;
}
