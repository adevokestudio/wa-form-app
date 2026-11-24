"use client";

import { useEffect, useState } from "react";
import type { FormDefinition } from "@/lib/formSchema";
import SettingsSection from "./SettingsSection";

export default function GeneralPanel({ initialForm }: { initialForm: FormDefinition }) {
  const [name, setName] = useState(initialForm.name);
  const [submitButtonText, setSubmitButtonText] = useState(initialForm.submitButtonText ?? "");
  const [enabled, setEnabled] = useState(initialForm.enabled ?? true);
  const [showQrFallback, setShowQrFallback] = useState(initialForm.showQrFallback ?? true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Start with the relative path so server and first-client render match
  // exactly, then upgrade to the full origin URL post-mount (deferred in a
  // microtask so it isn't a synchronous setState-in-effect).
  const [publicUrl, setPublicUrl] = useState(() => `/f/${initialForm.slug}`);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setPublicUrl(`${window.location.origin}/f/${initialForm.slug}`);
    });
    return () => {
      cancelled = true;
    };
  }, [initialForm.slug]);

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Untitled form",
          submitButtonText: submitButtonText.trim() || undefined,
          enabled,
          showQrFallback,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSavedAt("Save failed — try again");
    } finally {
      setSaving(false);
    }
  }

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
    <SettingsSection title="General">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Form name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Form link</span>
          <div className="flex items-center gap-2">
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
          <span className="text-xs text-gray-400">The link can&apos;t be changed after the form is created.</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Submit button text</span>
          <input
            value={submitButtonText}
            onChange={(e) => setSubmitButtonText(e.target.value)}
            placeholder="Send via WhatsApp"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm">
          <span>
            <span className="block font-medium text-gray-700">Enable form</span>
            <span className="text-xs text-gray-500">When off, the public link shows a &quot;not accepting responses&quot; message.</span>
          </span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>

        <label className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm">
          <span>
            <span className="block font-medium text-gray-700">QR Handoff (Desktop Fallback)</span>
            <span className="text-xs text-gray-500">
              If WhatsApp doesn&apos;t open automatically, show a QR code so the respondent can finish on their phone.
            </span>
          </span>
          <input type="checkbox" checked={showQrFallback} onChange={(e) => setShowQrFallback(e.target.checked)} />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="self-start rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {savedAt && <span className="text-xs text-gray-500">{savedAt}</span>}
        </div>
      </div>
    </SettingsSection>
  );
}
