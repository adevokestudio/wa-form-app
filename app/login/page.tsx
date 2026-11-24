import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

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
