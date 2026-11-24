"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { buildMessage, buildWhatsAppLink, resolveDestinationNumber, type AnswerEntry } from "@/lib/whatsapp";
import { evaluateCondition, type FormField, type RoutingRule } from "@/lib/formSchema";
import { evaluateFormula, formatFormulaResult } from "@/lib/formula";

type DynamicFormProps = {
  formSlug: string;
  formName: string;
  destinationNumber: string;
  fields: FormField[];
  routingRules?: RoutingRule[];
  showQrFallback?: boolean;
  takenSlotsByFieldId?: Record<string, string[]>;
  /** Settings → General: custom label for the submit button. Defaults to
   * "Send via WhatsApp". */
  submitButtonText?: string;
};

type Values = Record<string, string | string[] | undefined>;

async function uploadFile(file: File, formSlug: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("formSlug", formSlug);
  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

/** Resolves the string value to use for a field, computing Calculation /
 * Live Quote Calculator fields live from the formula instead of reading raw
 * input. */
function resolveFieldValue(field: FormField, values: Values): string {
  if (field.type === "calculation" || field.type === "quote") {
    const result = evaluateFormula(field.formula ?? "", values);
    return formatFormulaResult(result, field.type === "quote" ? field.currencyPrefix : undefined);
  }
  const raw = values[field.id];
  return Array.isArray(raw) ? raw.join(", ") : raw ?? "";
}

/** Like resolveFieldValue, but for a Payment field's `amount` URL param:
 * always a plain number (no currency symbol / thousands separator) when the
 * source is a Calculation / Quote field, otherwise the raw answer as-is. */
function resolvePaymentAmount(field: FormField, values: Values): string {
  if (field.type === "calculation" || field.type === "quote") {
    const result = evaluateFormula(field.formula ?? "", values);
    if (result === null || Number.isNaN(result)) return "";
    return String(Math.round(result * 100) / 100);
  }
  const raw = values[field.id];
  return Array.isArray(raw) ? raw.join(", ") : raw ?? "";
}

export default function DynamicForm({
  formSlug,
  formName,
  destinationNumber,
  fields,
  routingRules,
  showQrFallback = true,
  takenSlotsByFieldId = {},
  submitButtonText,
}: DynamicFormProps) {
  const [values, setValues] = useState<Values>({});
  const [submitting, setSubmitting] = useState(false);
  const [fallback, setFallback] = useState<{ link: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  function setValue(id: string, value: string | string[]) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string, option: string, checked: boolean) {
    setValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, [id]: next };
    });
  }

  // Conditional Logic: a field with a condition only shows (and only
  // counts toward the answers) once its condition is satisfied.
  const visibleFields = fields.filter((f) => !f.condition || evaluateCondition(f.condition, values));

  useEffect(() => {
    // Only ever consumed while `fallback` is truthy (see the render below),
    // so there's nothing to reset when it isn't — avoids calling setState
    // synchronously in the effect body for the "no fallback yet" case.
    if (!fallback) return;
    let cancelled = false;
    QRCode.toDataURL(fallback.link, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        /* QR generation failing just means no QR image — the link/copy fallback still works */
      });
    return () => {
      cancelled = true;
    };
  }, [fallback]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFallback(null);

    const answers: AnswerEntry[] = visibleFields
      .filter((f) => f.type !== "title")
      .map((f) => ({ label: f.label, value: resolveFieldValue(f, values) }));

    const answersRecord = Object.fromEntries(answers.map((a) => [a.label, a.value]));

    fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formSlug, answers: answersRecord }),
    }).catch(() => {
      /* logging is best-effort for the MVP */
    });

    // Conditional WhatsApp Routing: pick the destination number from the
    // rules (keyed by field id) before building the link.
    const destination = resolveDestinationNumber({ whatsappNumber: destinationNumber, routingRules }, values);

    const text = buildMessage(formName, answers);
    const link = buildWhatsAppLink(destination, text);

    setFallback({ link, text });
    setSubmitting(false);

    // Open WhatsApp in a new tab/window rather than navigating the current
    // tab away. Using window.location.assign here would unload this page
    // immediately, which meant the "Didn't open WhatsApp?" panel below
    // (including the QR Handoff code) could never actually be seen — it was
    // rendered and then instantly destroyed by the navigation. window.open
    // keeps this tab alive so the fallback UI (manual link, QR code, and
    // copyable message) is genuinely usable if the popup is blocked or
    // WhatsApp doesn't open on its own.
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    if (!fallback) return;
    try {
      await navigator.clipboard.writeText(fallback.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard access can fail silently; the text is still selectable */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {visibleFields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            allFields={fields}
            values={values}
            formSlug={formSlug}
            takenSlots={takenSlotsByFieldId[field.id] ?? []}
            onChange={(v) => setValue(field.id, v)}
            onToggleCheckbox={(option, checked) => toggleCheckbox(field.id, option, checked)}
          />
        ))}

        {visibleFields.length > 0 && (
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {submitting ? "Sending…" : submitButtonText?.trim() || "Send via WhatsApp"}
          </button>
        )}
      </form>

      {fallback && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 font-medium">Didn&apos;t open WhatsApp?</p>
          <p className="mb-2">
            Tap the button again, or{" "}
            <a href={fallback.link} className="underline">
              open this link
            </a>{" "}
            manually. You can also copy the message below and send it yourself:
          </p>

          {showQrFallback && qrDataUrl && (
            <div className="mb-3 flex flex-col items-center gap-1">
              {/* QR Handoff (Desktop Fallback): scan on a phone to finish there */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Scan to open this chat on your phone" className="h-40 w-40" />
              <span className="text-[11px] text-amber-700">Scan with your phone to open WhatsApp there</span>
            </div>
          )}

          <pre className="mb-2 whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-800">
            {fallback.text}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium hover:bg-amber-100"
          >
            {copied ? "Copied!" : "Copy message"}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  allFields,
  values,
  formSlug,
  takenSlots,
  onChange,
  onToggleCheckbox,
}: {
  field: FormField;
  allFields: FormField[];
  values: Values;
  formSlug: string;
  takenSlots: string[];
  onChange: (value: string) => void;
  onToggleCheckbox: (option: string, checked: boolean) => void;
}) {
  const value = values[field.id];
  const inputClasses =
    "rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

  switch (field.type) {
    case "title":
      return <h2 className="text-lg font-medium text-gray-900">{field.label}</h2>;

    case "text":
      return (
        <LabeledField label={field.label}>
          <input
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        </LabeledField>
      );

    case "email":
      return (
        <LabeledField label={field.label}>
          <input
            type="email"
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        </LabeledField>
      );

    case "phone":
      return (
        <LabeledField label={field.label}>
          <input
            type="tel"
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="07X XXX XXXX"
            className={inputClasses}
          />
        </LabeledField>
      );

    case "number":
      return (
        <LabeledField label={field.label}>
          <input
            type="number"
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        </LabeledField>
      );

    case "date":
      return (
        <LabeledField label={field.label}>
          <input
            type="date"
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        </LabeledField>
      );

    case "dropdown":
      return (
        <LabeledField label={field.label}>
          <select
            required={field.required}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          >
            <option value="" disabled>
              Select…
            </option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </LabeledField>
      );

    case "choice":
      return (
        <LabeledField label={field.label}>
          <div className="flex flex-col gap-1">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name={field.id}
                  required={field.required}
                  checked={value === option}
                  onChange={() => onChange(option)}
                />
                {option}
              </label>
            ))}
          </div>
        </LabeledField>
      );

    case "checkbox":
      return (
        <LabeledField label={field.label}>
          <div className="flex flex-col gap-1">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => onToggleCheckbox(option, e.target.checked)}
                />
                {option}
              </label>
            ))}
          </div>
        </LabeledField>
      );

    case "rating": {
      const current = Number(value) || 0;
      return (
        <LabeledField label={field.label}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className={`text-2xl leading-none ${n <= current ? "text-amber-400" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>
        </LabeledField>
      );
    }

    case "booking":
      return (
        <LabeledField label={field.label}>
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((slot) => {
              const taken = takenSlots.includes(slot);
              const selected = value === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={taken}
                  onClick={() => onChange(slot)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    taken
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through"
                      : selected
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-gray-300 text-gray-700 hover:border-green-600"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
          {(field.options ?? []).length === 0 && (
            <p className="text-xs text-gray-400">No slots configured yet.</p>
          )}
        </LabeledField>
      );

    case "calculation":
    case "quote": {
      const result = evaluateFormula(field.formula ?? "", values);
      const display = formatFormulaResult(result, field.type === "quote" ? field.currencyPrefix : undefined);
      return (
        <LabeledField label={field.label}>
          <div
            className={
              field.type === "quote"
                ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-lg font-semibold text-green-800"
                : "rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            }
          >
            {display || "—"}
          </div>
        </LabeledField>
      );
    }

    case "payment": {
      const amountFieldId = field.appendAmountFromFieldId;
      let href = field.paymentUrl ?? "";
      if (amountFieldId) {
        // The referenced field may be a Calculation / Live Quote Calculator
        // field, whose value is derived from a formula rather than stored in
        // `values` — use the raw computed number for the URL param (never
        // the display string, which can carry a currency symbol / comma
        // grouping that payment processors won't expect).
        const amountSourceField = allFields.find((f) => f.id === amountFieldId);
        const amount = amountSourceField ? resolvePaymentAmount(amountSourceField, values) : "";
        if (amount && href) {
          href += (href.includes("?") ? "&" : "?") + `amount=${encodeURIComponent(amount)}`;
        }
      }
      return (
        <LabeledField label={field.label}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onChange(href)}
              className="inline-block w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Pay now ↗
            </a>
          ) : (
            <p className="text-xs text-gray-400">No payment link configured yet.</p>
          )}
        </LabeledField>
      );
    }

    case "image":
      return (
        <FileUploadField
          field={field}
          formSlug={formSlug}
          value={value as string}
          onChange={onChange}
          accept="image/*"
          preview="image"
        />
      );

    case "video":
      return (
        <FileUploadField
          field={field}
          formSlug={formSlug}
          value={value as string}
          onChange={onChange}
          accept="video/*"
          preview="video"
        />
      );

    case "file":
      return <FileUploadField field={field} formSlug={formSlug} value={value as string} onChange={onChange} />;

    case "voice":
      return <VoiceNoteField field={field} formSlug={formSlug} value={value as string} onChange={onChange} />;

    case "signature":
      return <SignatureField field={field} formSlug={formSlug} value={value as string} onChange={onChange} />;

    default:
      return null;
  }
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function FileUploadField({
  field,
  formSlug,
  value,
  onChange,
  accept,
  preview = "link",
}: {
  field: FormField;
  formSlug: string;
  value: string | undefined;
  onChange: (value: string) => void;
  /** Hints the device's file picker to a media kind (e.g. opens the camera
   * roll for "image/*"); the upload itself accepts whatever the browser
   * lets through, since this is a UI hint, not server-side validation. */
  accept?: string;
  /** How to show the already-uploaded value: an inline thumbnail for
   * "image", a small playable clip for "video", or a plain "view" link
   * (the generic File Upload field's existing behavior). */
  preview?: "image" | "video" | "link";
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    try {
      const url = await uploadFile(file, formSlug);
      onChange(url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <LabeledField label={field.label}>
      <input
        type="file"
        accept={accept}
        required={field.required && !value}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="text-sm"
      />
      {status === "uploading" && <span className="text-xs text-gray-500">Uploading…</span>}
      {status === "error" && <span className="text-xs text-red-600">Upload failed — try again.</span>}
      {value && status !== "uploading" && preview === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-24 w-24 rounded-md border border-gray-200 object-cover" />
      )}
      {value && status !== "uploading" && preview === "video" && (
        <video src={value} controls className="h-32 max-w-full rounded-md border border-gray-200" />
      )}
      {value && status !== "uploading" && preview === "link" && (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 underline">
          File attached — view
        </a>
      )}
    </LabeledField>
  );
}

function VoiceNoteField({
  field,
  formSlug,
  value,
  onChange,
}: {
  field: FormField;
  formSlug: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("uploading");
        try {
          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
          const url = await uploadFile(file, formSlug);
          onChange(url);
          setStatus("idle");
        } catch {
          setStatus("error");
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setStatus("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <LabeledField label={field.label}>
      <div className="flex items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:border-green-600"
          >
            ● Record
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-md border border-red-400 px-3 py-1.5 text-sm text-red-600"
          >
            ■ Stop
          </button>
        )}
        {status === "uploading" && <span className="text-xs text-gray-500">Uploading…</span>}
        {status === "error" && <span className="text-xs text-red-600">Couldn&apos;t record — check mic access.</span>}
      </div>
      {(previewUrl || value) && status !== "uploading" && (
        <audio controls src={previewUrl ?? value} className="mt-1 h-8 w-full" />
      )}
    </LabeledField>
  );
}

function SignatureField({
  field,
  formSlug,
  value,
  onChange,
}: {
  field: FormField;
  formSlug: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  function getContext() {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const ctx = getContext();
    const { x, y } = pointerPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange("");
  }

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("uploading");
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("error");
        return;
      }
      try {
        const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
        const url = await uploadFile(file, formSlug);
        onChange(url);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    }, "image/png");
  }

  return (
    <LabeledField label={field.label}>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none rounded-md border border-gray-300 bg-white"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:border-gray-500"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasDrawn || status === "uploading"}
          className="rounded-md border border-green-600 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          {status === "uploading" ? "Saving…" : "Save signature"}
        </button>
        {value && status !== "uploading" && <span className="text-xs text-green-700">Saved ✓</span>}
        {status === "error" && <span className="text-xs text-red-600">Couldn&apos;t save — try again.</span>}
      </div>
    </LabeledField>
  );
}
