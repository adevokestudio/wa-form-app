import { notFound } from "next/navigation";
import { getForm } from "@/lib/formsStore";
import { listOrdersForForm } from "@/lib/ordersStore";
import OrdersTable from "./OrdersTable";

export default async function OrdersPage({
  params,
}: PageProps<"/builder/[slug]/orders">) {
  const { slug } = await params;
  const form = await getForm(slug);
  if (!form) notFound();

  const orders = await listOrdersForForm(slug);
  // Newest first.
  orders.reverse();

  return <OrdersTable orders={orders} currency={form.catalog?.currency || "LKR"} />;
}
