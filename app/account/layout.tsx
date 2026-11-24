import { requireUser } from "@/lib/auth";
import AppHeader from "../components/AppHeader";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader role={user.role} name={user.name} />
      {children}
    </div>
  );
}
