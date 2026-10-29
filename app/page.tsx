import { listForms } from "@/lib/formsStore";
import Dashboard from "./Dashboard";

export default async function Home() {
  const forms = await listForms();
  return <Dashboard initialForms={forms} />;
}
