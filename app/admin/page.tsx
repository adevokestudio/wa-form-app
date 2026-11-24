import { listClients, toPublicUser } from "@/lib/usersStore";
import AdminClients from "./AdminClients";

export default async function AdminPage() {
  const clients = await listClients();
  return <AdminClients initialClients={clients.map(toPublicUser)} />;
}
