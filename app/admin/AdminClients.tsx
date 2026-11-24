"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicUser } from "@/lib/usersStore";

export default function AdminClients({ initialClients }: { initialClients: PublicUser[] }) {
  const [clients, setClients] = useState(initialClients);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshFromServer() {
    const res = await fetch("/api/admin/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients);
    }
  }

  async function handleDelete(client: PublicUser) {
    if (!window.confirm(`Delete ${client.name}? Their forms will stay, but they won't be able to log in.`)) return;
    const res = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
    if (res.ok) setClients((prev) => prev.filter((c) => c.id !== client.id));
  }

  async function handleToggleStatus(client: PublicUser) {
    const nextStatus = client.status === "active" ? "disabled" : "active";
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status: nextStatus } : c)));
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setShowAdd(true);
          }}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          + Add client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No clients yet — add your first one to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">WhatsApp number</th>
                <th className="px-4 py-2 font-medium">Catalogue</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                  <td className="px-4 py-3 text-gray-600">{client.email}</td>
                  <td className="px-4 py-3 text-gray-600">{client.whatsappNumber || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        client.catalogEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {client.catalogEnabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        client.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {client.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-sm">
                      <Link
                        href={`/dashboard?client=${client.id}`}
                        className="font-medium text-gray-700 hover:text-green-700"
                      >
                        View forms
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setEditing(client);
                        }}
                        className="font-medium text-gray-700 hover:text-green-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(client)}
                        className="font-medium text-gray-700 hover:text-green-700"
                      >
                        {client.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client)}
                        className="font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onError={setError}
          onCreated={(client) => {
            setClients((prev) => [...prev, client]);
            setShowAdd(false);
          }}
        />
      )}

      {editing && (
        <EditClientModal
          client={editing}
          onClose={() => setEditing(null)}
          onError={setError}
          onSaved={async () => {
            setEditing(null);
            await refreshFromServer();
          }}
        />
      )}

      {error && (
        <p className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </p>
      )}
    </main>
  );
}

function AddClientModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (client: PublicUser) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, whatsappNumber, catalogEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "Couldn't create that client.");
        return;
      }
      onCreated(data.client);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Add a client</h2>
        <div className="flex flex-col gap-3">
          <Field label="Client / business name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ceylon Wild Safaris"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Login email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Temporary password">
            <input
              required
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="WhatsApp number" hint="Used as the default number for this client's new forms.">
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="94771234567"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogEnabled}
              onChange={(e) => setCatalogEnabled(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-gray-700">Enable WhatsApp Catalogue (premium)</span>
              <br />
              <span className="text-xs text-gray-400">
                Lets this client build a product catalogue with a cart, and accept PayPal, PayHere, cash on
                delivery, or bank transfer at checkout.
              </span>
            </span>
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
            disabled={saving}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditClientModal({
  client,
  onClose,
  onSaved,
  onError,
}: {
  client: PublicUser;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(client.name);
  const [whatsappNumber, setWhatsappNumber] = useState(client.whatsappNumber);
  const [newPassword, setNewPassword] = useState("");
  const [catalogEnabled, setCatalogEnabled] = useState(client.catalogEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          whatsappNumber,
          password: newPassword || undefined,
          catalogEnabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onError(data?.error || "Couldn't save those changes.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Edit {client.name}</h2>
        <p className="mb-4 text-xs text-gray-400">{client.email}</p>
        <div className="flex flex-col gap-3">
          <Field label="Client / business name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="WhatsApp number">
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Reset password" hint="Leave blank to keep their current password.">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (optional)"
              minLength={8}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogEnabled}
              onChange={(e) => setCatalogEnabled(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-gray-700">Enable WhatsApp Catalogue (premium)</span>
              <br />
              <span className="text-xs text-gray-400">
                Lets this client build a product catalogue with a cart, and accept PayPal, PayHere, cash on
                delivery, or bank transfer at checkout.
              </span>
            </span>
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
            disabled={saving}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 -z-10" />
    </div>
  );
}
