import React, { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Card, CardDetailsHelpers, CardFieldDef } from "../types";
import { useBoard } from "./context";

type Draft = Record<string, any>;

const toInput = (value: any, type?: CardFieldDef["type"]): string => {
  if (value === undefined || value === null) return "";
  if (type === "tags" || Array.isArray(value)) return (value as any[]).join(", ");
  return String(value);
};

const fromInput = (raw: string, type?: CardFieldDef["type"]): any => {
  if (type === "tags") {
    const list = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return list.length ? list : undefined;
  }
  if (type === "number") {
    if (raw.trim() === "") return undefined;
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  return raw === "" ? undefined : raw;
};

const isIsoDate = (v: string) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);

// Side panel to view and edit every field of a card. Closes on Escape, on the
// backdrop, or after saving; focus returns to where it was before opening.
export const CardDetailsPanel = ({
  card,
  onClose,
  renderCardDetails,
  renderCardDetailsExtra,
}: {
  card: Card;
  onClose: () => void;
  renderCardDetails?: (card: Card, helpers: CardDetailsHelpers<Card>) => ReactNode;
  renderCardDetailsExtra?: (card: Card) => ReactNode;
}) => {
  const {
    labels,
    kanban,
    priorities,
    cardFields = [],
    onCardUpdate,
    onCardEdit,
    onCardDelete,
  } = useBoard();
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const builtIn: (CardFieldDef & { multiline?: boolean })[] = [
    { key: "title", label: labels.fieldTitle, type: "text", required: true },
    { key: "description", label: labels.fieldDescription, type: "text", multiline: true },
    {
      key: "priority",
      label: labels.fieldPriority,
      type: "select",
      options: priorities.map((p) => ({ value: p.value, label: p.label ?? p.value })),
    },
    { key: "dueDate", label: labels.fieldDueDate, type: "date" },
    { key: "assignee", label: labels.fieldAssignee, type: "text" },
    { key: "tags", label: labels.fieldTags, type: "tags" },
  ];
  const fields = [
    ...builtIn,
    ...cardFields.filter((f) => !builtIn.some((b) => b.key === f.key)),
  ];

  const initialDraft = (): Draft => {
    const d: Draft = {};
    for (const f of fields) d[f.key] = toInput(card[f.key], f.type);
    return d;
  };
  const [draft, setDraft] = useState<Draft>(initialDraft);

  // Focus management: focus the panel on open, restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button"
    );
    (first ?? panelRef.current)?.focus();
    return () => {
      previous?.focus?.();
    };
  }, []);

  const update = (patch: Partial<Card>) => {
    if (!Object.keys(patch).length) return;
    kanban.updateCard(card.id, patch);
    onCardUpdate?.(card.id, patch);
    if (typeof patch.title === "string") onCardEdit?.(card.id, patch.title);
  };

  const remove = () => {
    kanban.deleteCard(card.id);
    onCardDelete?.(card.id);
    onClose();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!String(draft.title ?? "").trim()) return;
    const patch: Draft = {};
    for (const f of fields) {
      const next = fromInput(
        f.key === "title" ? String(draft[f.key]).trim() : draft[f.key],
        f.type
      );
      const prev = card[f.key];
      const same =
        Array.isArray(next) || Array.isArray(prev)
          ? JSON.stringify(next ?? []) === JSON.stringify(prev ?? [])
          : (next ?? "") === (prev ?? "");
      if (!same) patch[f.key] = next;
    }
    update(patch as Partial<Card>);
    onClose();
  };

  // Keep Tab focus inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const helpers: CardDetailsHelpers<Card> = { close: onClose, update, remove };

  const renderField = (f: CardFieldDef & { multiline?: boolean }) => {
    const id = `kb-field-${card.id}-${f.key}`;
    const value = draft[f.key] ?? "";
    const set = (v: string) => setDraft((d) => ({ ...d, [f.key]: v }));
    let control: ReactNode;
    if (f.type === "select") {
      control = (
        <select id={id} value={value} onChange={(e) => set(e.target.value)}>
          <option value="">{labels.none}</option>
          {(f.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {value && !(f.options || []).some((o) => o.value === value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      );
    } else if (f.multiline) {
      control = (
        <textarea id={id} rows={4} value={value} onChange={(e) => set(e.target.value)} />
      );
    } else {
      const type =
        f.type === "number"
          ? "number"
          : f.type === "date" && isIsoDate(value)
          ? "date"
          : "text";
      control = (
        <input
          id={id}
          type={type}
          value={value}
          required={f.key === "title"}
          onChange={(e) => set(e.target.value)}
          placeholder={f.type === "tags" ? labels.tagsHint : undefined}
        />
      );
    }
    return (
      <div className="kb-details-field" key={f.key} data-field={f.key}>
        <label htmlFor={id}>{f.label}</label>
        {control}
      </div>
    );
  };

  return (
    <div className="kb-details-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="kb-details-panel"
        role="dialog"
        aria-modal="true"
        aria-label={labels.cardDetails}
        data-testid="card-details"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="kb-details-header">
          <span className="kb-details-heading">{labels.cardDetails}</span>
          <button
            type="button"
            className="kb-details-close"
            aria-label={labels.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {renderCardDetails ? (
          <div className="kb-details-body">{renderCardDetails(card, helpers)}</div>
        ) : (
          <form className="kb-details-body" onSubmit={save}>
            {fields.map(renderField)}
            {renderCardDetailsExtra && (
              <div className="kb-details-extra">{renderCardDetailsExtra(card)}</div>
            )}
            <div className="kb-details-actions">
              {confirmingDelete ? (
                <span className="kb-details-confirm">
                  {labels.deleteConfirm}
                  <button type="button" className="kb-btn ghost" onClick={() => setConfirmingDelete(false)}>
                    {labels.cancel}
                  </button>
                  <button type="button" className="kb-btn danger" onClick={remove}>
                    {labels.delete}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="kb-btn ghost danger-text"
                  onClick={() => setConfirmingDelete(true)}
                >
                  {labels.delete}
                </button>
              )}
              <span className="kb-details-spacer" />
              <button type="button" className="kb-btn ghost" onClick={onClose}>
                {labels.cancel}
              </button>
              <button type="submit" className="kb-btn primary" data-testid="card-details-save">
                {labels.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// "Add column" tile shown at the end of the board (enableColumnManagement).
export const AddColumnTile = ({ onAdd }: { onAdd: (title: string) => void }) => {
  const { labels } = useBoard();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle("");
    setAdding(false);
  };
  return (
    <div className="kb-add-column">
      {adding ? (
        <form onSubmit={submit} className="kb-add-column-form kb-pop-in">
          <input
            autoFocus
            value={title}
            placeholder={labels.newColumnTitle}
            aria-label={labels.newColumnTitle}
            data-testid="add-column-input"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <div className="add-card-buttons">
            <button type="submit" disabled={!title.trim()}>
              {labels.addColumn}
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              {labels.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="kb-add-column-button"
          data-testid="add-column"
          onClick={() => setAdding(true)}
        >
          + {labels.addColumn}
        </button>
      )}
    </div>
  );
};
