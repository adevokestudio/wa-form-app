import { NextRequest, NextResponse } from "next/server";
import { canAccessForm, getCurrentUser } from "@/lib/auth";
import { withApiError } from "@/lib/apiRoute";
import { getForm } from "@/lib/formsStore";
import { getOrder, updateOrderStatus, type OrderStatus } from "@/lib/ordersStore";

const MANUALLY_SETTABLE_STATUSES: OrderStatus[] = ["paid", "cancelled", "pending_payment", "cod"];

/** Lets the form's owner (or an admin) manually mark an order paid or
 * cancelled — the primary mechanism for every payment method except
 * PayHere, which can also confirm itself automatically via its signed
 * notify_url webhook (app/api/payhere/notify/route.ts). */
export const PATCH = withApiError(async (request: NextRequest, context: RouteContext<"/api/orders/[id]">) => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const form = await getForm(order.formSlug);
  if (!form || !canAccessForm(user, form)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status as OrderStatus | undefined;
  if (!status || !MANUALLY_SETTABLE_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateOrderStatus(id, status);
  return NextResponse.json({ ok: true, order: updated });
});
