import { NextResponse } from "next/server";

/**
 * Wraps an API route handler so an unexpected error — a database problem,
 * a filesystem problem, anything we didn't explicitly check for — comes
 * back as a plain JSON response instead of Next's default HTML error page.
 *
 * Without this, the browser's `fetch(...).then(r => r.json())` calls throw
 * on that HTML page (it isn't valid JSON), and every login form / dashboard
 * action on the site shows the same unhelpful "something went wrong, check
 * your connection" message no matter what actually broke. With it, the real
 * error message reaches the screen (and `console.error` logs the full error
 * server-side too), so a production problem can be diagnosed from a single
 * screenshot instead of needing to go digging through server logs.
 */
export function withApiError<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("API route error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
    }
  };
}
