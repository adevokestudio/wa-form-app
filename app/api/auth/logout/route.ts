import { NextResponse } from "next/server";
import { withApiError } from "@/lib/apiRoute";
import { clearSessionCookie } from "@/lib/session";

export const POST = withApiError(async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
