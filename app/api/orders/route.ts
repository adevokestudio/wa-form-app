import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withApiError } from "@/lib/apiRoute";
import { getForm } from "@/lib/formsStore";
import { getUserById } from "@/lib/usersStore";
import {
  appendOrder,
  listOrdersForOwner,
  makeOrderId,
  type OrderItem,
  type OrderPaymentMethod,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/ordersStore";
import { buildPaypalMeLink } from "@/lib/paypal";
import { buildPayhereCheckoutFields, payhereCheckoutUrl } from "@/lib/payhere";
import { buildWhatsAppLink } from "@/lib/whatsapp";

/**
 * Public endpoint behind the Catalogue/Cart checkout (app/f/[slug]/Catalog.tsx)
 * — no login required, the same way the regular form's /api/submissions
 * isn't. Prices and the total are always recomputed here from the form's
 * own product list; a customer's browser never gets to dictate what
 * something costs.
 */
export const POST = withApiError(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const formSlug = typeof body?.formSlug === "string" ? body.formSlug : "";
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const buyerInput = body?.buyer ?? {};
  const paymentMethod = typeof body?.paymentMethod === "string" ? (body.paymentMethod as OrderPaymentMethod) : null;

  const name = typeof buyerInput.name === "string" ? buyerInput.name.trim() : "";
  const phone = typeof buyerInput.phone === "string" ? buyerInput.phone.trim() : "";
  const address = typeof buyerInput.address === "string" ? buyerInput.address.trim() : undefined;
  const notes = typeof buyerInput.notes === "string" ? buyerInput.notes.trim() : undefined;

  if (!formSlug) {
    return NextResponse.json({ error: "Missing formSlug" }, { status: 400 });
  }
  if (!name || !phone) {
    return NextResponse.json({ error: "Enter your name and phone number." }, { status: 400 });
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: "Choose a payment method." }, { status: 400 });
  }

  const form = await getForm(formSlug);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const catalog = form.catalog;
  if (!catalog?.enabled) {
    return NextResponse.json({ error: "This form isn't accepting orders." }, { status: 400 });
  }
  if (!catalog.paymentMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: "That payment method isn't available for this order." }, { status: 400 });
  }

  const owner = form.ownerId ? await getUserById(form.ownerId) : null;
  if (!owner || !owner.catalogEnabled) {
    return NextResponse.json({ error: "This form isn't accepting orders." }, { status: 400 });
  }

  // Build the real line items server-side — only active products, at their
  // current price, never whatever a submitted item claims. Anything that
  // doesn't match a real, active product is silently dropped rather than
  // trusted.
  const items: OrderItem[] = [];
  for (const raw of rawItems) {
    const productId = typeof raw?.productId === "string" ? raw.productId : "";
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(raw?.quantity) || 0)));
    const product = catalog.products.find((p) => p.id === productId && p.active);
    if (!product || quantity < 1) continue;
    items.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const total = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const orderId = makeOrderId();
  const currency = catalog.currency || "LKR";

  let status: OrderStatus;
  let paymentLink: string | undefined;
  let payhereFields: Record<string, string> | undefined;
  let payhereActionUrl: string | undefined;

  switch (paymentMethod) {
    case "cod":
      status = "cod";
      break;

    case "bank_transfer":
      status = "pending_payment";
      break;

    case "paypal": {
      if (!owner.paypalMeUsername) {
        return NextResponse.json({ error: "PayPal isn't set up for this seller yet." }, { status: 400 });
      }
      status = "pending_payment";
      paymentLink = buildPaypalMeLink(owner.paypalMeUsername, total, currency);
      break;
    }

    case "payhere": {
      if (!owner.payHereMerchantId || !owner.payHereMerchantSecret) {
        return NextResponse.json({ error: "PayHere isn't set up for this seller yet." }, { status: 400 });
      }
      status = "pending_payment";
      const origin = request.nextUrl.origin;
      payhereActionUrl = payhereCheckoutUrl(owner.payHereSandbox);
      payhereFields = buildPayhereCheckoutFields({
        merchantId: owner.payHereMerchantId,
        merchantSecret: owner.payHereMerchantSecret,
        orderId,
        amount: total,
        currency,
        itemsDescription: items.map((i) => `${i.name} x${i.quantity}`).join(", "),
        buyer: { name, phone, address },
        returnUrl: `${origin}/f/${formSlug}?order=${orderId}&payhere=return`,
        cancelUrl: `${origin}/f/${formSlug}?order=${orderId}&payhere=cancel`,
        notifyUrl: `${origin}/api/payhere/notify`,
      });
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown payment method." }, { status: 400 });
  }

  const order: OrderRecord = {
    id: orderId,
    formSlug,
    ownerId: owner.id,
    items,
    total,
    currency,
    buyer: { name, phone, address, notes },
    paymentMethod,
    status,
    paymentLink,
    payhereOrderId: paymentMethod === "payhere" ? orderId : undefined,
    createdAt: new Date().toISOString(),
  };

  await appendOrder(order);

  const whatsappLines = [
    `New order: ${form.name}`,
    "",
    ...items.map((i) => `${i.name} x${i.quantity} — ${currency} ${(i.price * i.quantity).toFixed(2)}`),
    "",
    `Total: ${currency} ${total.toFixed(2)}`,
    `Payment method: ${paymentMethodLabel(paymentMethod)}`,
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    ...(address ? [`Address: ${address}`] : []),
    ...(notes ? [`Notes: ${notes}`] : []),
  ];
  const whatsappLink = buildWhatsAppLink(form.whatsappNumber, whatsappLines.join("\n"));

  return NextResponse.json(
    {
      ok: true,
      orderId,
      status,
      total,
      currency,
      paymentLink,
      payhereFields,
      payhereActionUrl,
      bankTransferDetails: paymentMethod === "bank_transfer" ? owner.bankTransferDetails : undefined,
      whatsappLink,
    },
    { status: 201 }
  );
});

function paymentMethodLabel(method: OrderPaymentMethod): string {
  switch (method) {
    case "paypal":
      return "PayPal";
    case "payhere":
      return "PayHere";
    case "bank_transfer":
      return "Direct bank transfer";
    case "cod":
      return "Cash on delivery";
  }
}

/** Lists orders for the signed-in account — a client's own, or (via
 * ?client=<id>) an admin viewing a specific client's — for the builder's
 * Orders tab. Mirrors /api/forms's resolveOwnerId pattern. */
export const GET = withApiError(async (request: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client");
  const ownerId = clientId && user.role === "admin" ? clientId : user.id;

  const orders = await listOrdersForOwner(ownerId);
  return NextResponse.json({ orders });
});
