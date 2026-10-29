"use client";

import { useState } from "react";
import type { FormDefinition } from "@/lib/formSchema";
import SettingsSection from "./SettingsSection";

export default function SeoPanel({ initialForm }: { initialForm: FormDefinition }) {
  const seo = initialForm.seo ?? {};
  const [indexable, setIndexable] = useState(seo.indexable ?? false);
  const [metaTitle, setMetaTitle] = useState(seo.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(seo.metaDescription ?? "");
  const [metaImageUrl, setMetaImageUrl] = useState(seo.metaImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo: {
            indexable,
            metaTitle: metaTitle.trim() || undefined,
            metaDescription: metaDescription.trim() || undefined,
            metaImageUrl: metaImageUrl.trim() || undefined,
          },
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

  return (
    <SettingsSection
      title="SEO"
      description="Controls how this form's link appears in search engines and when shared in chat apps."
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm">
          <span>
            <span className="block font-medium text-gray-700">Search engine indexing</span>
            <span className="text-xs text-gray-500">Most forms are shared via direct link, so this is off by default.</span>
          </span>
          <input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Meta title</span>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder={initialForm.name}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Meta description</span>
          <input
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="A short line describing this form"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Meta image URL</span>
          <input
            value={metaImageUrl}
            onChange={(e) => setMetaImageUrl(e.target.value)}
            placeholder="https://example.com/preview.png"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">Shown when the link is shared on WhatsApp, Facebook, etc.</span>
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
