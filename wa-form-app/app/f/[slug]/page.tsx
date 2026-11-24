import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import { getTakenValuesForLabel } from "@/lib/submissionsStore";
import DynamicForm from "./DynamicForm";

/**
 * The public, respondent-facing form. Field list, labels, the destination
 * WhatsApp number, routing rules, and integrations all come from the form
 * definition the builder saved (see /builder/[slug]) instead of being
 * hardcoded, per step 5 of the "Getting started this week" plan.
 */

/** Settings → SEO, wired for real: title/description/robots come from the
 * form owner's SEO settings rather than being hardcoded or ignored. */
export async function generateMetadata({
  params,
}: PageProps<"/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const form = await getForm(slug);
  if (!form) return {};

  const seo = form.seo ?? {};
  return {
    title: seo.metaTitle?.trim() || form.name,
    description: seo.metaDescription?.trim() || undefined,
    robots: seo.indexable ? undefined : { index: false, follow: false },
    openGraph: seo.metaImageUrl ? { images: [seo.metaImageUrl] } : undefined,
  };
}

export default async function PublicFormPage({
  params,
}: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const form = await getForm(slug);

  if (!form) {
    notFound();
  }

  if (form.enabled === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-50 px-4 text-center">
        <h1 className="text-xl font-semibold text-gray-900">This form isn&apos;t accepting responses</h1>
        <p className="text-sm text-gray-500">Check back later, or contact whoever shared this link with you.</p>
      </main>
    );
  }

  // For Booking / Appointment Slot Picker fields, look up which slots are
  // already taken so they can be grayed out (best-effort — see
  // getTakenValuesForLabel's note on matching by label).
  const takenSlotsByFieldId: Record<string, string[]> = {};
  for (const field of form.fields) {
    if (field.type === "booking") {
      takenSlotsByFieldId[field.id] = await getTakenValuesForLabel(form.slug, field.label);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">{form.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill this in and it&apos;ll open WhatsApp with your message ready to send.
        </p>
      </div>

      <DynamicForm
        formSlug={form.slug}
        formName={form.name}
        destinationNumber={form.whatsappNumber}
        fields={form.fields}
        routingRules={form.routingRules}
        showQrFallback={form.showQrFallback ?? true}
        takenSlotsByFieldId={takenSlotsByFieldId}
        submitButtonText={form.submitButtonText}
      />
    </main>
  );
}
