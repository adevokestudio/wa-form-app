import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/apiRoute";
import { getOrderByPayhereOrderId, updateOrderStatus } from "@/lib/ordersStore";
import { getUserById } from "@/lib/usersStore";
import { verifyPayhereNotifySignature } from "@/lib/payhere";

/**
 * PayHere's server-to-server payment notification (`notify_url`) — the
 * only reliable source of truth for whether a PayHere order was actually
 * paid (the customer-facing return_url carries no payment status, per
 * PayHere's own docs). This is the one payment method in this app that
 * can confirm itself automatically; every other method (PayPal.Me, COD,
 * bank transfer) has no equivalent signal and stays manual.
 *
 * Always responds 200 — PayHere isn't a browser waiting on JSON, and
 * there's nothing it should retry over (an unmatched or invalid
 * notification is either a stale/duplicate call or a forged one, neither
 * of which gets fixed by PayHere trying again).
 */
export const POST = withApiError(async (request: NextRequest) => {
  const form = await request.formData();
  const merchantId = String(form.get("merchant_id") ?? "");
  const orderId = String(form.get("order_id") ?? "");
  const payhereAmount = String(form.get("payhere_amount") ?? "");
  const payhereCurrency = String(form.get("payhere_currency") ?? "");
  const statusCode = String(form.get("status_code") ?? "");
  const receivedSig = String(form.get("md5sig") ?? "");

  const order = await getOrderByPayhereOrderId(orderId);
  if (!order) {
    console.error("PayHere notify: no matching order for order_id", orderId);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const owner = await getUserById(order.ownerId);
  if (!owner || !owner.payHereMerchantSecret || owner.payHereMerchantId !== merchantId) {
    console.error("PayHere notify: merchant mismatch for order", orderId);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const valid = verifyPayhereNotifySignature({
    merchantId,
    orderId,
    payhereAmount,
    payhereCurrency,
    statusCode,
    merchantSecret: owner.payHereMerchantSecret,
    receivedSig,
  });

  if (!valid) {
    console.error("PayHere notify: signature mismatch for order", orderId);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // 2 = success. (0 pending, -1 canceled, -2 failed, -3 chargedback — none
  // of those should mark an order paid; a chargeback on an already-paid
  // order is left for manual handling rather than silently flipping it
  // back, since that's a rarer, higher-stakes case.)
  if (statusCode === "2") {
    await updateOrderStatus(order.id, "paid");
  }

  return NextResponse.json({ ok: true }, { status: 200 });
});
