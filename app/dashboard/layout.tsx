import { requireUser } from "@/lib/auth";
import AppHeader from "../components/AppHeader";

// Every page here depends on who's logged in — never pre-build it as a
// static page shared by every visitor.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader role={user.role} name={user.name} />
      {children}
    </div>
  );
}
