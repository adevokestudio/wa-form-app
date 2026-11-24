import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import { getUserById } from "@/lib/usersStore";
import CatalogPanel from "./CatalogPanel";

export default async function CatalogPage({
  params,
}: PageProps<"/builder/[slug]/catalog">) {
  const { slug } = await params;
  const form = await getForm(slug);
  if (!form) notFound();

  const owner = form.ownerId ? await getUserById(form.ownerId) : null;
  // Belt-and-braces: TopNav already hides this tab's link when the
  // feature is off, but someone could still type the URL directly.
  if (!owner?.catalogEnabled) notFound();

  return (
    <CatalogPanel
      slug={form.slug}
      initialCatalog={form.catalog}
      paymentMethodsAvailable={{
        paypal: Boolean(owner.paypalMeUsername),
        payhere: Boolean(owner.payHereMerchantId) && Boolean(owner.payHereMerchantSecret),
        bank_transfer: Boolean(owner.bankTransferDetails),
      }}
    />
  );
}
