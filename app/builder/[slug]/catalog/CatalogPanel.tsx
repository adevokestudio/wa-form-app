"use client";

import { useState } from "react";
import {
  makeProductId,
  type CatalogPaymentMethod,
  type CatalogProduct,
  type CatalogSettings,
} from "@/lib/formSchema";

type MethodAvailability = Record<"paypal" | "payhere" | "bank_transfer", boolean>;

const METHOD_LABELS: Record<CatalogPaymentMethod, string> = {
  paypal: "PayPal",
  payhere: "PayHere",
  cod: "Cash on delivery",
  bank_transfer: "Direct bank transfer",
};

const DEFAULT_CATALOG: CatalogSettings = {
  enabled: false,
  currency: "LKR",
  products: [],
  paymentMethods: ["cod"],
};

async function uploadProductImage(file: File, formSlug: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("formSlug", formSlug);
  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

export default function CatalogPanel({
  slug,
  initialCatalog,
  paymentMethodsAvailable,
}: {
  slug: string;
  initialCatalog?: CatalogSettings;
  paymentMethodsAvailable: MethodAvailability;
}) {
  const [catalog, setCatalog] = useState<CatalogSettings>(initialCatalog ?? DEFAULT_CATALOG);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [adding, setAdding] = useState(false);

  function isAvailable(method: CatalogPaymentMethod): boolean {
    if (method === "cod") return true;
    return paymentMethodsAvailable[method];
  }

  function toggleMethod(method: CatalogPaymentMethod, checked: boolean) {
    setCatalog((prev) => ({
      ...prev,
      paymentMethods: checked
        ? [...prev.paymentMethods, method]
        : prev.paymentMethods.filter((m) => m !== method),
    }));
  }

  function upsertProduct(product: CatalogProduct) {
    setCatalog((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      return {
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      };
    });
    setEditing(null);
    setAdding(false);
  }

  function removeProduct(id: string) {
    if (!window.confirm("Delete this product?")) return;
    setCatalog((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/forms/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog }),
      });
      const data = await res.json().catch(() => null);
      setMessage(res.ok ? "Saved." : data?.error || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalog.enabled}
            onChange={(e) => setCatalog((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-gray-700">Enable the shopping cart on this form</span>
            <br />
            <span className="text-xs text-gray-400">
              When on, this form&apos;s public page shows your product catalogue with a cart and checkout,
              alongside its regular fields.
            </span>
          </span>
        </label>

        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Currency</span>
          <input
            value={catalog.currency}
            onChange={(e) => setCatalog((prev) => ({ ...prev, currency: e.target.value.toUpperCase().slice(0, 3) }))}
            placeholder="LKR"
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Payment methods at checkout</p>
          <div className="flex flex-col gap-2">
            {(["paypal", "payhere", "cod", "bank_transfer"] as CatalogPaymentMethod[]).map((method) => {
              const available = isAvailable(method);
              return (
                <label
                  key={method}
                  className={`flex items-center gap-2 text-sm ${available ? "" : "text-gray-400"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!available}
                    checked={catalog.paymentMethods.includes(method)}
                    onChange={(e) => toggleMethod(method, e.target.checked)}
                  />
                  {METHOD_LABELS[method]}
                  {!available && (
                    <span className="text-xs text-gray-400">— set this up in Account → Payment settings</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-5 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save catalogue settings"}
        </button>
        {message && <p className="mt-2 text-xs text-gray-500">{message}</p>}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Products ({catalog.products.length})</h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            + Add product
          </button>
        </div>

        {catalog.products.length === 0 ? (
          <p className="text-sm text-gray-400">No products yet — add your first one above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {catalog.products.map((product) => (
              <li
                key={product.id}
                className="flex items-center gap-3 rounded-md border border-gray-100 p-3"
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {product.name} {!product.active && <span className="text-xs text-gray-400">(hidden)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {catalog.currency} {product.price.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(product)}
                  className="text-sm font-medium text-gray-700 hover:text-green-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(adding || editing) && (
        <ProductModal
          slug={slug}
          product={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={upsertProduct}
        />
      )}
    </div>
  );
}

function ProductModal({
  slug,
  product,
  onClose,
  onSave,
}: {
  slug: string;
  product: CatalogProduct | null;
  onClose: () => void;
  onSave: (product: CatalogProduct) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [uploading, setUploading] = useState(false);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(file, slug);
      setImageUrl(url);
    } catch {
      /* best-effort — the product can be saved without an image */
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) return;

    onSave({
      id: product?.id ?? makeProductId(),
      name: name.trim(),
      description: description.trim() || undefined,
      price: parsedPrice,
      imageUrl: imageUrl || undefined,
      active,
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{product ? "Edit product" : "Add product"}</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Name</span>
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Price</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Photo (optional)</span>
              <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} className="text-sm" />
              {uploading && <span className="text-xs text-gray-500">Uploading…</span>}
              {imageUrl && !uploading && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visible in the catalogue
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save product
            </button>
          </div>
        </form>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 -z-10" />
    </div>
  );
}
