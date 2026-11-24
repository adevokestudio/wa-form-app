import { requireUser } from "@/lib/auth";
import AccountForm from "./AccountForm";

export default async function AccountPage() {
  const user = await requireUser("/account");
  return <AccountForm user={user} />;
}
