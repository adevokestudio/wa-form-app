"use client";

import { useState } from "react";
import type { FormDefinition, FormIntegrations } from "@/lib/formSchema";
import SettingsSection from "./SettingsSection";

const GOOGLE_APPS_SCRIPT_CODE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var keys = Object.keys(data.answers || {});

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Submitted At'].concat(keys));
  }

  var row = [data.submittedAt || new Date().toISOString()];
  keys.forEach(function (k) { row.push(data.answers[k]); });
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function IntegrationsPanel({ initialForm }: { initialForm: FormDefinition }) {
  const [integrations, setIntegrations] = useState<FormIntegrations>(initialForm.integrations ?? {});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations }),
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
    <SettingsSection title="Integrations" description="Send every submission somewhere else automatically.">
      <div className="flex flex-col gap-4">
        <GoogleSheetCard integrations={integrations} onChange={setIntegrations} />
        <ComingSoonCard title="Custom Script" description="Add custom code that runs on the form page." />
        <ComingSoonCard title="Webhook" description="Send each submission to an external server URL as it comes in." />
        <ComingSoonCard title="Google Analytics" description="Send form view/start/submit events to GA4." />
        <ComingSoonCard title="Meta Pixel" description="Send form events to Meta Pixel for ad tracking and retargeting." />

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

function GoogleSheetCard({
  integrations,
  onChange,
}: {
  integrations: FormIntegrations;
  onChange: (next: FormIntegrations) => void;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const sheet = integrations.googleSheet ?? { enabled: false, webAppUrl: "" };

  function patch(p: Partial<{ enabled: boolean; webAppUrl: string }>) {
    onChange({ ...integrations, googleSheet: { ...sheet, ...p } });
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard access can fail silently; the code is still selectable */
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Google Sheet</h3>
          <p className="text-xs text-gray-500">Sends every response to a Google Sheet you own, in real time.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={sheet.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>

      {sheet.enabled && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Apps Script Web App URL</span>
            <input
              value={sheet.webAppUrl}
              onChange={(e) => patch({ webAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowSetup((v) => !v)}
            className="self-start text-xs font-medium text-green-700 underline"
          >
            {showSetup ? "Hide setup instructions" : "How do I get this URL?"}
          </button>

          {showSetup && (
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-700">
              <ol className="mb-2 list-decimal space-y-1 pl-4">
                <li>Open (or create) the Google Sheet you want responses in.</li>
                <li>
                  Go to <span className="font-mono">Extensions → Apps Script</span>, delete any placeholder
                  code, and paste in the script below.
                </li>
                <li>
                  Click <span className="font-mono">Deploy → New deployment</span>, choose type{" "}
                  <span className="font-mono">Web app</span>, set &quot;Who has access&quot; to{" "}
                  <span className="font-mono">Anyone</span>, and deploy.
                </li>
                <li>Copy the Web App URL it gives you and paste it above.</li>
              </ol>
              <div className="relative">
                <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-[11px] text-gray-100">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
                <button
                  type="button"
                  onClick={copyScript}
                  className="absolute right-2 top-2 rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-gray-500">
                Each submission arrives as a new row. Columns are set from the fields your form has when
                the first response comes in — reordering or renaming fields later won&apos;t rewrite
                existing columns.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 opacity-70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-500">
          Coming soon
        </span>
      </div>
    </div>
  );
}
