/**
 * PayPal.Me payment links — chosen over PayPal's REST/Checkout API because
 * it needs nothing but a free username each client sets up themselves at
 * paypal.me: no API keys, no OAuth app, no secret for this app to hold.
 * The tradeoff (per PayPal's own help pages) is that PayPal.Me gives no
 * callback or webhook, so there's no way to detect completion
 * automatically — an order paid this way stays "pending_payment" until
 * the client checks their own PayPal account and marks it paid.
 *
 * Note for Sri Lanka-based clients: PayPal does not support receiving
 * money in Sri Lankan Rupees, so a PayPal.Me link should generally be
 * generated in a currency PayPal does support (USD is the safest
 * default) rather than the catalogue's own LKR prices — worth flagging to
 * a client setting this up for the first time.
 */
export function buildPaypalMeLink(username: string, amount: number, currency: string): string {
  const handle = username.trim().replace(/^@/, "").replace(/\/+$/, "");
  const amountStr = amount.toFixed(2);
  return `https://paypal.me/${encodeURIComponent(handle)}/${amountStr}${currency}`;
}
