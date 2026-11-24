import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * Handles uploads from File Upload, Voice Note, and E-Signature fields.
 *
 * Storage: writes straight into public/uploads/<formSlug>/ so the file is
 * immediately reachable at a plain URL (no separate serving route needed).
 * This is dev-local storage — the same "good enough for the MVP, swap for
 * real object storage later" pattern as the JSON forms/submissions stores.
 * On most serverless hosts (Vercel included) the filesystem is read-only
 * at runtime except /tmp, so this needs to move to Supabase Storage/S3
 * before a real deployment; noted in the plan doc.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const formSlug = formData.get("formSlug");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof formSlug !== "string" || !formSlug) {
    return NextResponse.json({ error: "Missing formSlug" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const slugDir = path.join(UPLOADS_ROOT, sanitizeSegment(formSlug));
  await fs.mkdir(slugDir, { recursive: true });

  const filename = `${Date.now()}-${sanitizeSegment(file.name || "upload")}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(slugDir, filename), buffer);

  const url = `/uploads/${sanitizeSegment(formSlug)}/${filename}`;
  return NextResponse.json({ url });
}
