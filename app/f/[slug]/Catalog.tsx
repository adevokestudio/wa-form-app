"use client";

import { useState } from "react";
import type { CatalogPaymentMethod, CatalogProduct } from "@/lib/formSchema";

const METHOD_LABELS: Record<CatalogPaymentMethod, string> = {
  paypal: "PayPal",
  payhere: "PayHere (cards & local bank)",
  cod: "Cash on delivery",
  bank_transfer: "Direct bank transfer",
};

type CartState = Record<string, number>;

type OrderResult = {
  status: string;
  paymentLink?: string;
  bankTransferDetails?: string;
  whatsappLink: string;
};

export default function Catalog({
  formSlug,
  currency,
  products,
  paymentMethods,
}: {
  formSlug: string;
  currency: string;
  products: CatalogProduct[];
  paymentMethods: CatalogPaymentMethod[];
}) {
  const [cart, setCart] = useState<CartState>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<CatalogPaymentMethod | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);

  const lineItems = Object.entries(cart)
    .map(([productId, quantity]) => ({ product: products.find((p) => p.id === productId), quantity }))
    .filter((entry): entry is { product: CatalogProduct; quantity: number } => Boolean(entry.product) && entry.quantity > 0);

  const total = lineItems.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  const cartCount = lineItems.reduce((sum, { quantity }) => sum + quantity, 0);

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(99, quantity)) }));
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!method || lineItems.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formSlug,
          items: lineItems.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          buyer: { name, phone, address, notes },
          paymentMethod: method,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Couldn't place that order — try again.");
        return;
      }

      // WhatsApp handoff first (opens a new tab, doesn't unload this page)
      // so it isn't lost if a PayHere payment then navigates this tab away.
      window.open(data.whatsappLink, "_blank", "noopener,noreferrer");

      if (method === "paypal" && data.paymentLink) {
        window.open(data.paymentLink, "_blank", "noopener,noreferrer");
      } else if (method === "payhere" && data.payhereFields && data.payhereActionUrl) {
        submitPayhereForm(data.payhereActionUrl, data.payhereFields);
        return; // navigating away — nothing left to show on this page
      }

      setResult({
        status: data.status,
        paymentLink: data.paymentLink,
        bankTransferDetails: data.bankTransferDetails,
        whatsappLink: data.whatsappLink,
      });
      setCart({});
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-900">
        <p className="mb-2 font-semibold">Order placed!</p>
        <p className="mb-2">We&apos;ve opened WhatsApp with your order details — tap Send to confirm it.</p>
        {result.paymentLink && (
          <p className="mb-2">
            Didn&apos;t see the payment tab open?{" "}
            <a href={result.paymentLink} target="_blank" rel="noopener noreferrer" className="underline">
              Pay now
            </a>
            .
          </p>
        )}
        {result.bankTransferDetails && (
          <div className="mb-2 rounded-md bg-white p-3 text-gray-800">
            <p className="mb-1 font-medium">Bank transfer details:</p>
            <pre className="whitespace-pre-wrap text-xs">{result.bankTransferDetails}</pre>
          </div>
        )}
        {result.status === "cod" && <p>Pay cash when your order arrives.</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <div key={product.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-3">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="mb-2 h-28 w-full rounded-md object-cover" />
            ) : (
              <div className="mb-2 h-28 w-full rounded-md bg-gray-100" />
            )}
            <p className="text-sm font-medium text-gray-900">{product.name}</p>
            {product.description && <p className="mb-1 text-xs text-gray-500">{product.description}</p>}
            <p className="mb-2 text-sm font-semibold text-gray-900">
              {currency} {product.price.toFixed(2)}
            </p>
            <div className="mt-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(product.id, (cart[product.id] ?? 0) - 1)}
                disabled={!cart[product.id]}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{cart[product.id] ?? 0}</span>
              <button
                type="button"
                onClick={() => setQuantity(product.id, (cart[product.id] ?? 0) + 1)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {cartCount > 0 && !checkingOut && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <span>
            {cartCount} item{cartCount === 1 ? "" : "s"} — {currency} {total.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setCheckingOut(true)}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Checkout
          </button>
        </div>
      )}

      {checkingOut && cartCount > 0 && (
        <form onSubmit={handleCheckout} className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">
            {lineItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between">
                <span>
                  {product.name} x{quantity}
                </span>
                <span>
                  {currency} {(product.price * quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
              <span>Total</span>
              <span>
                {currency} {total.toFixed(2)}
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Phone</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07X XXX XXXX"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Delivery address (optional)</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Notes (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Payment method</span>
            {paymentMethods.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="method" required checked={method === m} onChange={() => setMethod(m)} />
                {METHOD_LABELS[m]}
              </label>
            ))}
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !method}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {submitting ? "Placing order…" : "Place order"}
          </button>
        </form>
      )}
    </div>
  );
}

/** PayHere's Checkout API is an actual browser form POST, not a redirect
 * with query parameters — this builds and submits that hidden form,
 * navigating the current tab to PayHere's hosted checkout page. */
function submitPayhereForm(actionUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
