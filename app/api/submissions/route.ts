import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/formsStore";
import { appendSubmission, readSubmissions, type SubmissionRecord } from "@/lib/submissionsStore";

/**
 * Temporary submission logging.
 *
 * This is a placeholder for step 4 of the "Getting started this week" plan:
 * it gives the form owner a record of every submission independent of
 * whether the respondent actually tapped Send in WhatsApp. Right now it just
 * appends to a local JSON file so the MVP has *something* durable to point
 * at; swap this out for a real Supabase `submissions` insert (see the Data
 * model section of the plan doc) once the account/auth layer exists.
 */

/**
 * Forwards a submission to the form's Google Sheet integration, if enabled.
 *
 * This deliberately doesn't use the Google Sheets API directly — that would
 * need OAuth, a Google Cloud project, and somewhere to store per-account
 * refresh tokens, none of which exist yet (no accounts/DB layer). Instead
 * the form owner deploys a small Apps Script "Web App" on their own Sheet
 * (see the builder's Integrations panel for the exact code + steps), and we
 * just POST the answers to that URL. No OAuth, no secrets on our end.
 *
 * Best-effort: a failure here never breaks the submission itself, since the
 * respondent's WhatsApp handoff already happened client-side independent of
 * this request finishing.
 */
async function forwardToGoogleSheet(record: SubmissionRecord) {
  const form = await getForm(record.formSlug);
  const sheet = form?.integrations?.googleSheet;
  if (!sheet?.enabled || !sheet.webAppUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    await fetch(sheet.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`Google Sheet forward failed for form "${record.formSlug}":`, err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { formSlug, answers } = body ?? {};

  if (!formSlug || typeof answers !== "object") {
    return NextResponse.json({ error: "Missing formSlug or answers" }, { status: 400 });
  }

  const record: SubmissionRecord = {
    formSlug,
    answers,
    submittedAt: new Date().toISOString(),
  };

  await appendSubmission(record);
  await forwardToGoogleSheet(record);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const submissions = await readSubmissions();
  return NextResponse.json({ submissions });
}
