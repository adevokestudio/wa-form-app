import { requireUser } from "@/lib/auth";
import { listForms } from "@/lib/formsStore";
import { getUserById } from "@/lib/usersStore";
import Dashboard from "./Dashboard";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const params = await searchParams;
  const clientId = typeof params?.client === "string" ? params.client : undefined;

  const viewingClient = user.role === "admin" && clientId ? await getUserById(clientId) : null;
  const ownerId = viewingClient ? viewingClient.id : user.id;

  const forms = await listForms(ownerId);

  return (
    <Dashboard
      initialForms={forms}
      ownerQuery={viewingClient ? `?client=${viewingClient.id}` : ""}
      viewingClientName={viewingClient?.name}
    />
  );
}
