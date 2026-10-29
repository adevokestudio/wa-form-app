"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { FormDefinition } from "@/lib/formSchema";

export default function Dashboard({ initialForms }: { initialForms: FormDefinition[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [openMenuSlug, setOpenMenuSlug] = useState<string | null>(null);
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (res.ok && data.form?.slug) {
        router.push(`/builder/${data.form.slug}`);
      }
    } finally {
      setCreating(false);
      setShowCreate(false);
      setNewName("");
    }
  }

  async function handleDelete(slug: string) {
    setOpenMenuSlug(null);
    if (!window.confirm("Delete this form? This can't be undone.")) return;
    const res = await fetch(`/api/forms/${slug}`, { method: "DELETE" });
    if (res.ok) setForms((prev) => prev.filter((f) => f.slug !== slug));
  }

  async function handleDuplicate(slug: string) {
    setOpenMenuSlug(null);
    const res = await fetch(`/api/forms/${slug}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.form) setForms((prev) => [...prev, data.form]);
  }

  function startRename(form: FormDefinition) {
    setOpenMenuSlug(null);
    setRenamingSlug(form.slug);
    setRenameValue(form.name);
  }

  async function confirmRename() {
    if (!renamingSlug) return;
    const slug = renamingSlug;
    const name = renameValue.trim() || "Untitled form";
    setRenamingSlug(null);
    const res = await fetch(`/api/forms/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setForms((prev) => prev.map((f) => (f.slug === slug ? { ...f, name } : f)));
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Your forms</h1>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            + New Form
          </button>
        </div>

        {forms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No forms yet — create your first one to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {forms.map((form) => (
              <FormCard
                key={form.slug}
                form={form}
                menuOpen={openMenuSlug === form.slug}
                onToggleMenu={() => setOpenMenuSlug((prev) => (prev === form.slug ? null : form.slug))}
                onCloseMenu={() => setOpenMenuSlug(null)}
                onDelete={() => handleDelete(form.slug)}
                onDuplicate={() => handleDuplicate(form.slug)}
                onRename={() => startRename(form)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">New form</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Form name</span>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Booking Enquiry"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {renamingSlug && (
        <Modal onClose={() => setRenamingSlug(null)}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Rename form</h2>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenamingSlug(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRename}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function FormCard({
  form,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onDelete,
  onDuplicate,
  onRename,
}: {
  form: FormDefinition;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{form.name}</h3>
          <a
            href={`/f/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-green-700 hover:underline"
          >
            /f/{form.slug} ↗
          </a>
        </div>
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Form actions"
          className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ⋮
        </button>
      </div>

      {form.enabled === false && (
        <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          Disabled
        </span>
      )}

      <div className="mt-4 flex gap-4 text-sm">
        <Link href={`/builder/${form.slug}`} className="font-medium text-gray-700 hover:text-green-700">
          Edit
        </Link>
        <Link href={`/builder/${form.slug}/share`} className="font-medium text-gray-700 hover:text-green-700">
          Share
        </Link>
        <Link href={`/builder/${form.slug}/responses`} className="font-medium text-gray-700 hover:text-green-700">
          Responses
        </Link>
      </div>

      {menuOpen && (
        <div
          className="absolute right-3 top-10 z-10 w-40 rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
          onMouseLeave={onCloseMenu}
        >
          <Link
            href={`/builder/${form.slug}/settings`}
            className="block px-3 py-1.5 text-gray-700 hover:bg-gray-50"
            onClick={onCloseMenu}
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={onDuplicate}
            className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onRename}
            className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
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
