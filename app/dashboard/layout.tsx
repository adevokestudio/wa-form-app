import { requireUser } from "@/lib/auth";
import AppHeader from "../components/AppHeader";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader role={user.role} name={user.name} />
      {children}
    </div>
  );
}
