import { promises as fs } from "fs";
import path from "path";

/**
 * Shared JSON-file submissions store — pulled out of the API route so the
 * public form page can also read from it (needed for the Booking /
 * Appointment Slot Picker to know which slots are already taken). Same
 * "good enough for the MVP" caveat as the forms store: swap for a real
 * Postgres `submissions` table once accounts/auth exist.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");

export type SubmissionRecord = {
  formSlug: string;
  answers: Record<string, string>;
  submittedAt: string;
};

export async function readSubmissions(): Promise<SubmissionRecord[]> {
  try {
    const raw = await fs.readFile(SUBMISSIONS_FILE, "utf-8");
    return JSON.parse(raw) as SubmissionRecord[];
  } catch {
    return [];
  }
}

export async function appendSubmission(record: SubmissionRecord): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const existing = await readSubmissions();
  existing.push(record);
  await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify(existing, null, 2), "utf-8");
}

export async function listSubmissionsForForm(formSlug: string): Promise<SubmissionRecord[]> {
  const all = await readSubmissions();
  return all.filter((s) => s.formSlug === formSlug);
}

/**
 * Every value that's already been submitted under a given answer label for
 * a form — used to gray out already-booked slots on a Booking field. Labels
 * are how submissions are keyed today (see the Data model note in the plan
 * doc), so this matches on the field's current label; renaming a booking
 * field's label after it has responses will stop matching its old answers.
 */
export async function getTakenValuesForLabel(formSlug: string, label: string): Promise<string[]> {
  const submissions = await listSubmissionsForForm(formSlug);
  return submissions.map((s) => s.answers[label]).filter((v): v is string => Boolean(v));
}
