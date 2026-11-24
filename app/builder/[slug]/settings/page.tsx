import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import SettingsShell from "./SettingsShell";

export default async function SettingsPage({
  params,
}: PageProps<"/builder/[slug]/settings">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  return <SettingsShell initialForm={form} />;
}
