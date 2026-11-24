import { createHash } from "node:crypto";

/**
 * PayHere Checkout API integration (Sri Lanka's common payment gateway).
 *
 * This is a browser form POST, not a redirect with query parameters — the
 * customer's browser submits a hidden HTML form straight to one of these
 * two URLs (the `www` on the live one matters; PayHere's own docs warn
 * that leaving it off causes error PH-0022):
 *
 *   https://www.payhere.lk/pay/checkout        (live)
 *   https://sandbox.payhere.lk/pay/checkout    (sandbox / test mode)
 *
 * The hash below proves the request came from us (not a tampered browser
 * request) without ever sending the merchant secret itself to the
 * customer's browser — it's generated here, server-side, from the client's
 * own PayHere Merchant ID + Merchant Secret (lib/usersStore.ts), exactly
 * per PayHere's documented formula:
 *
 *   hash = upper(md5( merchant_id + order_id + amount + currency + upper(md5(merchant_secret)) ))
 *
 * PayHere also posts a server-to-server notification after payment
 * (notify_url) with its own signature (md5sig) using the same scheme —
 * see verifyPayhereNotifySignature, used by app/api/payhere/notify/route.ts
 * to mark an order paid automatically once it's confirmed.
 */

function md5Upper(input: string): string {
  return createHash("md5").update(input).digest("hex").toUpperCase();
}

/** PayHere requires exactly two decimal places and no thousands separator
 * (e.g. "1500.00") in both the checkout form and the hash — a mismatch
 * here is the most common cause of PayHere's generic "Unauthorized
 * Payment Request" error, so every amount goes through this one place. */
export function formatPayhereAmount(amount: number): string {
  return amount.toFixed(2);
}

export function payhereCheckoutUrl(sandbox: boolean): string {
  return sandbox ? "https://sandbox.payhere.lk/pay/checkout" : "https://www.payhere.lk/pay/checkout";
}

export function buildPayhereHash(params: {
  merchantId: string;
  orderId: string;
  amount: number;
  currency: string;
  merchantSecret: string;
}): string {
  const amountStr = formatPayhereAmount(params.amount);
  const secretHash = md5Upper(params.merchantSecret);
  return md5Upper(`${params.merchantId}${params.orderId}${amountStr}${params.currency}${secretHash}`);
}

/** The full set of fields a hidden form needs to POST to PayHere's
 * checkout URL for a one-time payment. `return_url`/`cancel_url` send the
 * customer back to the public form page; PayHere's own docs note those
 * carry no payment-status parameters, so `notify_url` (verified
 * server-to-server) is the only source of truth for whether it was paid. */
export function buildPayhereCheckoutFields(params: {
  merchantId: string;
  merchantSecret: string;
  orderId: string;
  amount: number;
  currency: string;
  itemsDescription: string;
  buyer: { name: string; phone: string; address?: string };
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): Record<string, string> {
  const [firstName, ...rest] = params.buyer.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName || "Customer";

  return {
    merchant_id: params.merchantId,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    order_id: params.orderId,
    items: params.itemsDescription.slice(0, 200),
    currency: params.currency,
    amount: formatPayhereAmount(params.amount),
    first_name: firstName || "Customer",
    last_name: lastName,
    // PayHere requires a validly-formatted email even though this app
    // doesn't collect one at checkout — a fixed placeholder keeps the
    // request valid without inventing a fake-looking real address.
    email: "orders@whatsform.me",
    phone: params.buyer.phone || "0000000000",
    address: params.buyer.address?.slice(0, 200) || "Not provided",
    city: "Colombo",
    country: "Sri Lanka",
    hash: buildPayhereHash({
      merchantId: params.merchantId,
      orderId: params.orderId,
      amount: params.amount,
      currency: params.currency,
      merchantSecret: params.merchantSecret,
    }),
  };
}

/** Verifies PayHere's notify_url webhook signature against the client's
 * own merchant secret. Use the exact `payhere_amount` STRING PayHere
 * posted (not a reformatted number) — their docs are explicit that the
 * value must be used as received. */
export function verifyPayhereNotifySignature(params: {
  merchantId: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
  merchantSecret: string;
  receivedSig: string;
}): boolean {
  const secretHash = md5Upper(params.merchantSecret);
  const expected = md5Upper(
    `${params.merchantId}${params.orderId}${params.payhereAmount}${params.payhereCurrency}${params.statusCode}${secretHash}`
  );
  return expected === params.receivedSig.toUpperCase();
}
