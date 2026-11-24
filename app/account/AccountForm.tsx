"use client";

import { useState } from "react";
import type { PublicUser } from "@/lib/usersStore";

export default function AccountForm({ user }: { user: PublicUser }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Account</h1>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Signed in as</h2>
        <p className="text-sm text-gray-600">{user.name}</p>
        <p className="text-xs text-gray-400">{user.email}</p>
      </section>

      <WhatsappSection initialNumber={user.whatsappNumber} />
      {user.catalogEnabled && <PaymentSection user={user} />}
      <PasswordSection />
    </main>
  );
}

function PaymentSection({ user }: { user: PublicUser }) {
  const [paypalMeUsername, setPaypalMeUsername] = useState(user.paypalMeUsername);
  const [payHereMerchantId, setPayHereMerchantId] = useState(user.payHereMerchantId);
  const [payHereMerchantSecret, setPayHereMerchantSecret] = useState("");
  const [payHereSecretSet, setPayHereSecretSet] = useState(user.payHereSecretSet);
  const [payHereSandbox, setPayHereSandbox] = useState(user.payHereSandbox);
  const [bankTransferDetails, setBankTransferDetails] = useState(user.bankTransferDetails);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paypalMeUsername,
          payHereMerchantId,
          payHereMerchantSecret: payHereMerchantSecret || undefined,
          payHereSandbox,
          bankTransferDetails,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage("Saved.");
        if (payHereMerchantSecret) {
          setPayHereSecretSet(true);
          setPayHereMerchantSecret("");
        }
      } else {
        setMessage(data?.error || "Couldn't save — try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Payment settings</h2>
      <p className="mb-4 text-xs text-gray-400">
        Used by the WhatsApp Catalogue/Cart feature on your forms. Money from PayPal and PayHere orders goes
        straight to your own accounts below — this app never holds or handles your funds.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">PayPal.Me username</span>
          <input
            value={paypalMeUsername}
            onChange={(e) => setPaypalMeUsername(e.target.value)}
            placeholder="yourname"
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">
            Free to set up at paypal.me if you don&apos;t have one yet. Note: PayPal can&apos;t receive Sri
            Lankan Rupees directly — orders will be billed in your PayPal.Me link&apos;s own currency.
          </span>
        </label>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">PayHere</p>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Merchant ID</span>
              <input
                value={payHereMerchantId}
                onChange={(e) => setPayHereMerchantId(e.target.value)}
                placeholder="121XXXX"
                className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">Merchant Secret</span>
              <input
                type="password"
                value={payHereMerchantSecret}
                onChange={(e) => setPayHereMerchantSecret(e.target.value)}
                placeholder={payHereSecretSet ? "••••••••  (already set — leave blank to keep it)" : "Not set yet"}
                className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">
                Found in your PayHere account under Side Menu → Integrations. You&apos;ll also need to add this
                site&apos;s domain there (approval can take up to 24 hours) before real payments will work.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={payHereSandbox}
                onChange={(e) => setPayHereSandbox(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-gray-700">Test mode</span>
                <br />
                <span className="text-xs text-gray-400">
                  Leave this on while you&apos;re setting up — no real money moves. Turn it off only once
                  you&apos;ve tested a checkout and you&apos;re ready to accept real payments.
                </span>
              </span>
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm border-t border-gray-100 pt-4">
          <span className="font-medium text-gray-700">Bank transfer details</span>
          <textarea
            value={bankTransferDetails}
            onChange={(e) => setBankTransferDetails(e.target.value)}
            rows={3}
            placeholder={"Bank name\nAccount name\nAccount number\nBranch"}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-400">
            Shown to a customer who chooses &quot;Direct bank transfer&quot; at checkout.
          </span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save payment settings"}
        </button>
        {message && <p className="text-xs text-gray-500">{message}</p>}
      </div>
    </section>
  );
}

function WhatsappSection({ initialNumber }: { initialNumber: string }) {
  const [whatsappNumber, setWhatsappNumber] = useState(initialNumber);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber }),
      });
      const data = await res.json().catch(() => null);
      setMessage(res.ok ? "Saved." : data?.error || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">WhatsApp number</h2>
      <p className="mb-3 text-xs text-gray-400">
        Used as the default number for any new form you create. Existing forms keep whatever number they already
        have — change those individually in each form&apos;s Settings → Team tab.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="94771234567"
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-500">{message}</p>}
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage("Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage(data?.error || "Couldn't update your password.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Change password</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Current password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">New password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Confirm new password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="mt-1 self-start rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Updating…" : "Update password"}
        </button>
        {message && <p className="text-xs text-gray-500">{message}</p>}
      </form>
    </section>
  );
}
