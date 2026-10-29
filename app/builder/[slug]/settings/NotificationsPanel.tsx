"use client";

import SettingsSection from "./SettingsSection";

/** Not built yet — outbound WhatsApp notifications need a WhatsApp Business
 * API integration (this app only does click-to-WhatsApp, initiated by the
 * respondent's own device), and email needs an email provider wired in.
 * Shown as disabled toggles with an explanation rather than pretending
 * they work, matching the ComingSoonCard pattern used in Integrations.
 * Takes no props — there's nothing per-form to configure yet. */
export default function NotificationsPanel() {
  return (
    <SettingsSection
      title="Notifications"
      description="Get alerted the moment a new response comes in, outside of WhatsApp itself."
    >
      <div className="flex flex-col gap-3">
        <ToggleRow
          title="WhatsApp notifications"
          description="Needs a WhatsApp Business API connection — this app currently uses click-to-WhatsApp only, sent from the respondent's own number."
        />
        <ToggleRow
          title="Email notifications"
          description="Needs an email provider connected to your account."
        />
      </div>
    </SettingsSection>
  );
}

function ToggleRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3 opacity-70">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-500">
            Coming soon
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <input type="checkbox" disabled className="cursor-not-allowed" />
    </div>
  );
}
