"use client";

import { useState } from "react";
import {
  makeRuleId,
  type ConditionOperator,
  type FormDefinition,
  type RoutingRule,
  type TeamMode,
} from "@/lib/formSchema";
import SettingsSection from "./SettingsSection";

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
];

export default function TeamPanel({ initialForm }: { initialForm: FormDefinition }) {
  const [teamMode, setTeamMode] = useState<TeamMode>(
    initialForm.teamMode ?? (initialForm.routingRules?.length ? "conditional" : "single")
  );
  const [whatsappNumber, setWhatsappNumber] = useState(initialForm.whatsappNumber);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(initialForm.routingRules ?? []);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const answerFields = initialForm.fields.filter((f) => f.type !== "title");

  function addRoutingRule() {
    if (answerFields.length === 0) return;
    setRoutingRules((prev) => [
      ...prev,
      { id: makeRuleId(), fieldId: answerFields[0].id, operator: "equals", value: "", whatsappNumber: "" },
    ]);
  }

  function updateRoutingRule(id: string, patch: Partial<RoutingRule>) {
    setRoutingRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRoutingRule(id: string) {
    setRoutingRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamMode,
          whatsappNumber,
          routingRules: teamMode === "conditional" ? routingRules : initialForm.routingRules ?? [],
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
      title="Team"
      description="Choose how a submission picks which WhatsApp number it opens."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <ModeCard
            title="Single"
            description="Every submission opens the same WhatsApp number."
            active={teamMode === "single"}
            onClick={() => setTeamMode("single")}
          />
          <ModeCard
            title="Distribute"
            description="Round-robin across a team of numbers."
            comingSoon
          />
          <ModeCard
            title="Conditional"
            description="Route to a different number based on an answer."
            active={teamMode === "conditional"}
            onClick={() => setTeamMode("conditional")}
          />
        </div>

        {teamMode === "single" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">WhatsApp number</span>
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="94771234567"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {teamMode === "conditional" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Default WhatsApp number</span>
              <input
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="94771234567"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">Used when none of the rules below match.</span>
            </label>

            {answerFields.length === 0 ? (
              <p className="text-xs text-gray-400">Add a question in the Build tab first, then come back here to route on it.</p>
            ) : (
              <>
                {routingRules.length === 0 && <p className="text-xs text-gray-400">No routing rules yet.</p>}
                <div className="flex flex-col gap-2">
                  {routingRules.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-2">
                      <span className="text-xs text-gray-500">If</span>
                      <select
                        value={rule.fieldId}
                        onChange={(e) => updateRoutingRule(rule.id, { fieldId: e.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        {answerFields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={rule.operator}
                        onChange={(e) =>
                          updateRoutingRule(rule.id, { operator: e.target.value as ConditionOperator })
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        {CONDITION_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={rule.value}
                        onChange={(e) => updateRoutingRule(rule.id, { value: e.target.value })}
                        placeholder="value"
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-gray-500">→ send to</span>
                      <input
                        value={rule.whatsappNumber}
                        onChange={(e) => updateRoutingRule(rule.id, { whatsappNumber: e.target.value })}
                        placeholder="94711111111"
                        className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeRoutingRule(rule.id)}
                        aria-label="Remove rule"
                        className="ml-auto text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addRoutingRule}
                  className="self-start rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-green-600 hover:text-green-700"
                >
                  + Add rule
                </button>
              </>
            )}
          </div>
        )}

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

function ModeCard({
  title,
  description,
  active,
  comingSoon,
  onClick,
}: {
  title: string;
  description: string;
  active?: boolean;
  comingSoon?: boolean;
  onClick?: () => void;
}) {
  if (comingSoon) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] text-gray-500">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${
        active ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span className={`text-sm font-semibold ${active ? "text-green-700" : "text-gray-900"}`}>{title}</span>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </button>
  );
}
