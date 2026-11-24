import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

// Checks the session cookie to decide whether to bounce an already-logged-in
// visitor straight to their dashboard — never pre-build this as static HTML.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params?.next === "string" ? params.next : undefined;

  // Already signed in — skip straight past the login form.
  const user = await getCurrentUser();
  if (user) {
    redirect(nextParam && nextParam.startsWith("/") ? nextParam : user.role === "admin" ? "/admin" : "/dashboard");
  }

  return <LoginForm next={nextParam} />;
}
