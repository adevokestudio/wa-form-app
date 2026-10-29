import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import ShareView from "./ShareView";

export default async function SharePage({
  params,
}: PageProps<"/builder/[slug]/share">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  return <ShareView slug={form.slug} enabled={form.enabled ?? true} />;
}
