"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FIELD_TYPES,
  fieldTypeMeta,
  makeFieldId,
  type ConditionOperator,
  type FieldType,
  type FieldTypeMeta,
  type FormDefinition,
  type FormField,
} from "@/lib/formSchema";
import { evaluateFormula, formatFormulaResult } from "@/lib/formula";
import { buildMessage, type AnswerEntry } from "@/lib/whatsapp";

/** Id of the always-present droppable that wraps the canvas list, used as
 * the drop target when a palette item is dropped onto empty space rather
 * than directly on an existing field card. */
const CANVAS_DROPZONE_ID = "canvas-dropzone";

/** Palette drag ids are namespaced ("palette:<type>") so onDragEnd can tell
 * "adding a new field type" apart from "reordering an existing field" —
 * field ids (from makeFieldId()) never collide with this prefix. */
function paletteDragId(type: FieldType) {
  return `palette:${type}`;
}

type ActiveDrag = { kind: "palette"; type: FieldType } | { kind: "field"; field: FormField };

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
];

const BASIC_FIELD_TYPES = FIELD_TYPES.filter((f) => !f.advanced);
const ADVANCED_FIELD_TYPES = FIELD_TYPES.filter((f) => f.advanced);

/** Short glyph shown next to a field type, in both the Add Questions panel
 * and each field's card on the canvas — plain text/symbols rather than an
 * icon library, but consistent everywhere so a type is always recognizable
 * at a glance. */
const FIELD_ICON: Record<FieldType, string> = {
  title: "H",
  text: "T",
  email: "@",
  phone: "☎",
  number: "#",
  date: "▦",
  choice: "◉",
  checkbox: "☑",
  dropdown: "▾",
  rating: "★",
  image: "▨",
  video: "▶",
  file: "⇩",
  voice: "●",
  signature: "✍",
  booking: "▦+",
  calculation: "∑",
  quote: "$",
  payment: "Pay",
};

type BuilderProps = {
  initialForm: FormDefinition;
};

export default function Builder({ initialForm }: BuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialForm.fields);
  const [showPicker, setShowPicker] = useState(fields.length === 0);
  const [pickerTab, setPickerTab] = useState<"basic" | "advanced">("basic");
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addFieldAt(type: FieldType, index: number) {
    const meta = fieldTypeMeta(type);
    const newField: FormField = {
      id: makeFieldId(),
      type,
      label: meta.label,
      required: meta.isAnswerField,
      options: meta.hasOptions ? ["Option 1", "Option 2"] : undefined,
    };
    setFields((prev) => {
      const next = [...prev];
      next.splice(index, 0, newField);
      return next;
    });
  }

  function addField(type: FormField["type"]) {
    addFieldAt(type, fields.length);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function duplicateField(id: string) {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index < 0) return prev;
      const copy: FormField = { ...prev[index], id: makeFieldId() };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (typeof active.id === "string" && active.id.startsWith("palette:")) {
      const type = active.data.current?.fieldType as FieldType | undefined;
      if (type) setActiveDrag({ kind: "palette", type });
      return;
    }
    const field = fields.find((f) => f.id === active.id);
    if (field) setActiveDrag({ kind: "field", field });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;

    // Dragging a field type in from the Add Questions panel — insert a new
    // field either before whatever field it was dropped on, or at the end
    // if it was dropped on empty canvas space.
    if (typeof active.id === "string" && active.id.startsWith("palette:")) {
      const type = active.data.current?.fieldType as FieldType | undefined;
      if (!type) return;
      let insertIndex = fields.length;
      if (over.id !== CANVAS_DROPZONE_ID) {
        const idx = fields.findIndex((f) => f.id === over.id);
        if (idx >= 0) insertIndex = idx;
      }
      addFieldAt(type, insertIndex);
      return;
    }

    // Otherwise it's an existing field being reordered.
    if (active.id === over.id) return;
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/forms/${initialForm.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: initialForm.name,
          whatsappNumber: initialForm.whatsappNumber,
          fields,
          integrations: initialForm.integrations,
          routingRules: initialForm.routingRules,
          showQrFallback: initialForm.showQrFallback,
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
    <DndContext
      // dnd-kit generates its accessibility hint id (aria-describedby) by
      // counting how many DndContext instances have been created, using a
      // counter that lives for the lifetime of the process. In dev, the
      // server keeps that counter running across every page load it has
      // served, while a fresh browser tab always starts its own copy at
      // zero — so after the dev server has been up for a while, the two
      // drift apart and React logs a hydration mismatch on every
      // draggable/sortable field. Passing an explicit id here makes dnd-kit
      // skip the counter and use this fixed value on both sides instead.
      id="wa-form-builder-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-4">
        {showPicker && (
          <AddQuestionsPanel
            tab={pickerTab}
            onTabChange={setPickerTab}
            onAdd={addField}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* Canvas: given as much width as possible, especially once the
         * picker is closed — this is the "ample space to create" half of
         * the create/preview layout. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              {fields.length} question{fields.length === 1 ? "" : "s"}
            </h2>
            {!showPicker && (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                + Add Question
              </button>
            )}
          </div>

          <CanvasDropzone>
            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
                No questions yet — drag a question type here, or click one in the panel on the left.
              </div>
            ) : (
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {fields.map((field) => (
                    <FieldCard
                      key={field.id}
                      field={field}
                      allFields={fields}
                      onChange={(patch) => updateField(field.id, patch)}
                      onRemove={() => removeField(field.id)}
                      onDuplicate={() => duplicateField(field.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            )}
          </CanvasDropzone>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save form"}
            </button>
            {savedAt && <span className="text-xs text-gray-500">{savedAt}</span>}
          </div>
        </div>

        {/* Preview: a persistent side panel rather than a collapsible
         * accordion, so building and previewing happen side by side — the
         * "ample space to ... preview" half of the layout. */}
        <PreviewPanel formName={initialForm.name} fields={fields} />
      </div>

      <DragOverlay>
        {activeDrag?.kind === "palette" && <PaletteDragPreview type={activeDrag.type} />}
        {activeDrag?.kind === "field" && (
          <div className="rounded-lg border border-green-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 shadow-lg">
            {activeDrag.field.label || fieldTypeMeta(activeDrag.field.type).label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Wraps the field list (or its empty state) so a field type dragged in
 * from the Add Questions panel has somewhere to land even when it isn't
 * dropped directly on an existing field card. */
function CanvasDropzone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[6rem] rounded-lg transition-colors ${isOver ? "bg-green-50 ring-2 ring-green-300 ring-offset-2" : ""}`}
    >
      {children}
    </div>
  );
}

function PaletteDragPreview({ type }: { type: FieldType }) {
  const meta = fieldTypeMeta(type);
  return (
    <div className="flex items-center gap-3 rounded-md border border-green-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 shadow-lg">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
        {FIELD_ICON[type]}
      </span>
      {meta.label}
    </div>
  );
}

function AddQuestionsPanel({
  tab,
  onTabChange,
  onAdd,
  onClose,
}: {
  tab: "basic" | "advanced";
  onTabChange: (tab: "basic" | "advanced") => void;
  onAdd: (type: FormField["type"]) => void;
  onClose: () => void;
}) {
  const types = tab === "basic" ? BASIC_FIELD_TYPES : ADVANCED_FIELD_TYPES;

  return (
    <aside className="w-72 flex-shrink-0 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Add Questions</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <div className="flex border-b border-gray-100 px-4">
        <TabButton active={tab === "basic"} onClick={() => onTabChange("basic")}>
          Basic
        </TabButton>
        <TabButton active={tab === "advanced"} onClick={() => onTabChange("advanced")}>
          Advanced
        </TabButton>
      </div>

      <ul className="max-h-[28rem] overflow-y-auto py-1">
        {types.map((meta) => (
          <PaletteRow key={meta.type} meta={meta} onAdd={onAdd} />
        ))}
      </ul>
    </aside>
  );
}

/** One row in the Add Questions panel — click to add instantly, or press
 * and drag the row (or its handle) onto the canvas to drop it at a
 * specific position. The drag handle on the right mirrors WhatsForm's
 * layout so it reads as draggable at a glance. */
function PaletteRow({
  meta,
  onAdd,
}: {
  meta: FieldTypeMeta;
  onAdd: (type: FormField["type"]) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDragId(meta.type),
    data: { type: "palette", fieldType: meta.type },
  });

  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => onAdd(meta.type)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAdd(meta.type);
          }
        }}
        title={meta.description}
        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
          {FIELD_ICON[meta.type]}
        </span>
        <span className="min-w-0 flex-1 truncate">{meta.label}</span>
        <span className="flex-shrink-0 cursor-grab select-none text-gray-300" aria-hidden="true">
          ⠿
        </span>
      </div>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function FieldCard({
  field,
  allFields,
  onChange,
  onRemove,
  onDuplicate,
}: {
  field: FormField;
  allFields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const meta = fieldTypeMeta(field.type);
  const [expanded, setExpanded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-gray-200 bg-white ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
          {FIELD_ICON[field.type]}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {field.required && <span className="text-red-500">*</span>}
          <span className="truncate text-sm font-medium text-gray-900">{field.label || meta.label}</span>
          <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
            {meta.label}
          </span>
        </button>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label="Edit field"
            title="Edit"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate field"
            title="Duplicate"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove field"
            title="Delete"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            🗑
          </button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="cursor-grab select-none rounded p-1.5 text-gray-400 hover:text-gray-600"
          >
            ⠿
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <FieldConfig field={field} allFields={allFields} onChange={onChange} />
        </div>
      )}
    </li>
  );
}

/** The editable configuration for a field — label, options, per-type
 * settings (formula, payment link, etc.) and Conditional Logic. Shown
 * inside a FieldCard once it's expanded. */
function FieldConfig({
  field,
  allFields,
  onChange,
}: {
  field: FormField;
  allFields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
}) {
  const meta = fieldTypeMeta(field.type);
  const [showCondition, setShowCondition] = useState(Boolean(field.condition));

  const otherFields = allFields.filter((f) => f.id !== field.id && f.type !== "title");
  const numericFields = allFields.filter(
    (f) => f.id !== field.id && (f.type === "number" || f.type === "calculation" || f.type === "quote")
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="flex-1 text-xs">
          <span className="mb-1 block font-medium text-gray-600">Label</span>
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <span
          className="mt-4 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400"
          title="Reference this field in a formula as {this id}"
        >
          {`{${field.id}}`}
        </span>
      </div>

      {meta.hasOptions && (
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-600">Options</span>
          <textarea
            value={(field.options ?? []).join("\n")}
            onChange={(e) =>
              onChange({ options: e.target.value.split("\n").filter((o) => o.trim().length > 0) })
            }
            rows={Math.max(2, (field.options ?? []).length)}
            placeholder={field.type === "booking" ? "One slot per line, e.g. Mon 9:00 AM" : "One option per line"}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs"
          />
        </label>
      )}

      {(field.type === "calculation" || field.type === "quote") && (
        <div className="flex flex-col gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-600">
              Formula — reference other fields by the {"{id}"} shown next to them
            </span>
            <input
              value={field.formula ?? ""}
              onChange={(e) => onChange({ formula: e.target.value })}
              placeholder="{f1} * {f2}"
              className="rounded border border-gray-300 px-2 py-1 font-mono text-xs"
            />
          </label>
          {field.type === "quote" && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-600">Currency prefix</span>
              <input
                value={field.currencyPrefix ?? ""}
                onChange={(e) => onChange({ currencyPrefix: e.target.value })}
                placeholder="Rs. "
                className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </label>
          )}
          {otherFields.length > 0 && (
            <p className="text-[11px] text-gray-400">
              Fields available: {otherFields.map((f) => `{${f.id}} = ${f.label}`).join(", ")}
            </p>
          )}
        </div>
      )}

      {field.type === "payment" && (
        <div className="flex flex-col gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-600">Payment link URL (Stripe/PayHere, etc.)</span>
            <input
              value={field.paymentUrl ?? ""}
              onChange={(e) => onChange({ paymentUrl: e.target.value })}
              placeholder="https://buy.stripe.com/..."
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-600">Append amount from (optional)</span>
            <select
              value={field.appendAmountFromFieldId ?? ""}
              onChange={(e) => onChange({ appendAmountFromFieldId: e.target.value || undefined })}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">None</option>
              {numericFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {meta.isAnswerField && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            Required
          </label>

          {otherFields.length > 0 && field.type !== "title" && (
            <button
              type="button"
              onClick={() => {
                if (showCondition && field.condition) onChange({ condition: undefined });
                setShowCondition((v) => !v);
              }}
              className="text-green-700 underline"
            >
              {field.condition ? "Edit condition" : "Show only if…"}
            </button>
          )}
        </div>
      )}

      {showCondition && otherFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2 text-xs">
          <span className="text-gray-500">Show this field only if</span>
          <select
            value={field.condition?.fieldId ?? otherFields[0].id}
            onChange={(e) =>
              onChange({
                condition: {
                  fieldId: e.target.value,
                  operator: field.condition?.operator ?? "equals",
                  value: field.condition?.value ?? "",
                },
              })
            }
            className="rounded border border-gray-300 px-2 py-1"
          >
            {otherFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={field.condition?.operator ?? "equals"}
            onChange={(e) =>
              onChange({
                condition: {
                  fieldId: field.condition?.fieldId ?? otherFields[0].id,
                  operator: e.target.value as ConditionOperator,
                  value: field.condition?.value ?? "",
                },
              })
            }
            className="rounded border border-gray-300 px-2 py-1"
          >
            {CONDITION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <input
            value={field.condition?.value ?? ""}
            onChange={(e) =>
              onChange({
                condition: {
                  fieldId: field.condition?.fieldId ?? otherFields[0].id,
                  operator: field.condition?.operator ?? "equals",
                  value: e.target.value,
                },
              })
            }
            placeholder="value"
            className="w-28 rounded border border-gray-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={() => {
              onChange({ condition: undefined });
              setShowCondition(false);
            }}
            className="text-gray-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/** WhatsApp Message Preview — a persistent right-hand panel (not a
 * collapsible accordion) so the form can be built and previewed side by
 * side, using placeholder sample values so it updates live as
 * fields/labels/order change in the builder. */
function PreviewPanel({ formName, fields }: { formName: string; fields: FormField[] }) {
  const answers: AnswerEntry[] = fields
    .filter((f) => f.type !== "title")
    .map((f) => ({ label: f.label, value: sampleValueForField(f) }));

  const preview = buildMessage(formName || "Untitled form", answers);

  return (
    <aside className="sticky top-4 w-80 flex-shrink-0 rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">WhatsApp Message Preview</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          What the pre-filled message will look like, using sample answers.
        </p>
      </div>
      <div className="p-4">
        {fields.length === 0 ? (
          <p className="text-xs text-gray-400">Add a question to see the preview.</p>
        ) : (
          <pre className="whitespace-pre-wrap rounded-md bg-[#e7ffdb] p-3 font-sans text-sm text-gray-800">
            {preview}
          </pre>
        )}
      </div>
    </aside>
  );
}

function sampleValueForField(field: FormField): string {
  switch (field.type) {
    case "text":
      return "Sample text";
    case "email":
      return "name@example.com";
    case "phone":
      return "0771234567";
    case "number":
      return "2";
    case "date":
      return "2026-10-04";
    case "choice":
    case "dropdown":
    case "booking":
      return field.options?.[0] ?? "Option 1";
    case "checkbox":
      return (field.options ?? []).slice(0, 2).join(", ") || "Option 1, Option 2";
    case "rating":
      return "5";
    case "image":
      return "https://example.com/uploads/sample.jpg";
    case "video":
      return "https://example.com/uploads/sample.mp4";
    case "file":
      return "https://example.com/uploads/sample.pdf";
    case "voice":
      return "https://example.com/uploads/voice-note.webm";
    case "signature":
      return "https://example.com/uploads/signature.png";
    case "calculation":
    case "quote":
      return formatFormulaResult(evaluateFormula(field.formula ?? "", {}), field.type === "quote" ? field.currencyPrefix : undefined) || "0";
    case "payment":
      return field.paymentUrl || "https://buy.stripe.com/...";
    default:
      return "";
  }
}
