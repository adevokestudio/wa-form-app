import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import TopNav from "./TopNav";

export default async function BuilderLayout({
  params,
  children,
}: LayoutProps<"/builder/[slug]">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav slug={form.slug} formName={form.name} />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
