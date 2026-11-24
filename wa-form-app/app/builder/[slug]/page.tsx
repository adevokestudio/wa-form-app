import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import Builder from "./Builder";

export default async function BuilderPage({
  params,
}: PageProps<"/builder/[slug]">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  return <Builder initialForm={form} />;
}
