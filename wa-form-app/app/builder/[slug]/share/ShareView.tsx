"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function ShareView({ slug, enabled }: { slug: string; enabled: boolean }) {
  // Start with the relative path so the server-rendered markup and the
  // client's first render match exactly (no `window` access at render
  // time). Once mounted, upgrade it to the full origin URL — the setState
  // is deferred inside a .then() microtask (not a synchronous call in the
  // effect body) so it satisfies the same lint rule the QR effect below
  // does, and it also means this update only ever happens post-hydration.
  const [publicUrl, setPublicUrl] = useState(() => `/f/${slug}`);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setPublicUrl(`${window.location.origin}/f/${slug}`);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(publicUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        /* QR generation failing just means no QR image — the link/copy still works */
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard access can fail silently; the link is still selectable */
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-lg border border-gray-200 bg-white p-8 text-center">
      {!enabled && (
        <p className="w-full rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This form is currently disabled — turn it back on in Settings → General before sharing it.
        </p>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-900">Share this form</h2>
        <p className="mt-1 text-xs text-gray-500">Anyone with this link can fill it in and send it to you on WhatsApp.</p>
      </div>

      <div className="flex w-full items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {publicUrl}
        </code>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="QR code linking to this form" className="h-40 w-40" />
      )}

      <a
        href={publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Open form ↗
      </a>
    </div>
  );
}
