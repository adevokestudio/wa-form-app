import { requireAdmin } from "@/lib/auth";
import AppHeader from "../components/AppHeader";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader role={user.role} name={user.name} />
      {children}
    </div>
  );
}
