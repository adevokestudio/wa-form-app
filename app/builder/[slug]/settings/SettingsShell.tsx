"use client";

import { useState } from "react";
import type { FormDefinition } from "@/lib/formSchema";
import GeneralPanel from "./GeneralPanel";
import NotificationsPanel from "./NotificationsPanel";
import SeoPanel from "./SeoPanel";
import TeamPanel from "./TeamPanel";
import IntegrationsPanel from "./IntegrationsPanel";

type SettingsTab = "general" | "notifications" | "seo" | "team" | "integrations";

const NAV_ITEMS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications" },
  { id: "seo", label: "SEO" },
  { id: "team", label: "Team" },
  { id: "integrations", label: "Integrations" },
];

export default function SettingsShell({ initialForm }: { initialForm: FormDefinition }) {
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <div className="flex items-start gap-6">
      <nav className="w-44 flex-shrink-0 rounded-lg border border-gray-200 bg-white p-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
              tab === item.id ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {tab === "general" && <GeneralPanel initialForm={initialForm} />}
        {tab === "notifications" && <NotificationsPanel />}
        {tab === "seo" && <SeoPanel initialForm={initialForm} />}
        {tab === "team" && <TeamPanel initialForm={initialForm} />}
        {tab === "integrations" && <IntegrationsPanel initialForm={initialForm} />}
      </div>
    </div>
  );
}
