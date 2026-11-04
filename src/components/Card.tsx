import React, { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "../types";
import { getDueStatus, slugify } from "../core";
import { useBoard } from "./context";
import {
  CalendarIcon,
  CollapseExpandIcon,
  DeleteIcon,
  EditIcon,
  OpenIcon,
  PlusIcon,
} from "../icons";

// Sortable wrapper: makes its child card draggable via pointer, touch and
// keyboard (Space to pick up, arrows to move, Space/Enter to drop, Esc to
// cancel). The whole card is the drag handle; small movements are ignored so
// clicks on inner buttons still work.
export const SortableCard = ({
  id,
  title,
  virtualized,
  selected,
  onSelect,
  onOpen,
  children,
}: {
  id: string;
  title: string;
  virtualized?: boolean;
  selected?: boolean;
  onSelect?: (e: MouseEvent) => void;
  onOpen?: () => void;
  children: (isDragging: boolean) => ReactNode;
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // In virtualized columns the row is positioned by the virtualizer, so we skip
  // dnd-kit's sort transform/transition (which would fight it).
  const style: React.CSSProperties = virtualized
    ? { opacity: isDragging ? 0.4 : undefined }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card-id={id}
      className={`sortable-card-wrapper ${selected ? "selected" : ""}`}
      {...attributes}
      {...listeners}
      aria-label={title}
      aria-selected={onSelect ? !!selected : undefined}
      onClick={onSelect}
      // v2 custom cards may still set `draggable`: cancel the browser's native
      // HTML5 drag so it can't hijack the pointer from dnd-kit.
      onDragStart={(e) => e.preventDefault()}
      onDoubleClick={
        onOpen
          ? (e) => {
              // Don't hijack double-clicks inside inputs / buttons.
              if ((e.target as HTMLElement).closest("button, input, textarea, select, a")) return;
              // Drop the word selection the double-click just made.
              window.getSelection?.()?.removeAllRanges();
              onOpen();
            }
          : undefined
      }
    >
      {children(isDragging)}
    </div>
  );
};

interface DefaultCardProps {
  card: Card;
  isDone?: boolean;
  isExpanded?: boolean;
  toggleExpand?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onOpen?: (id: string) => void;
  isDragging?: boolean; // true for the source card while it is being dragged
  isOverlay?: boolean; // true when rendered inside the DragOverlay preview
}

// Built-in card: title, actions, priority badge, due-date chip, expandable
// details (description, tags, schema fields) and avatar.
export const DefaultCard = ({
  card,
  isDone,
  isExpanded,
  toggleExpand,
  onDelete,
  onEdit,
  onOpen,
  isDragging,
  isOverlay,
}: DefaultCardProps) => {
  const {
    labels,
    priorities,
    cardFields,
    renderAvatar,
    highlightDueDates,
    dueSoonDays,
    mounted,
  } = useBoard();
  const { id, title, priority, dueDate, tags, description, avatarPath } = card;

  const schemaFields = (cardFields || []).filter(
    (f) => card[f.key] !== undefined && card[f.key] !== ""
  );
  const hasDetails =
    priority ||
    dueDate ||
    description ||
    (tags && tags.length > 0) ||
    schemaFields.length > 0;

  // Priority: built-in levels are styled by class; custom ones with a colour
  // get it through the --kb-pri-color variable.
  const priorityDef = priority
    ? priorities.find((p) => p.value === priority)
    : undefined;
  const prioritySlug = priority ? slugify(priority) : "";
  const priorityStyle = priorityDef?.color
    ? ({ ["--kb-pri-color" as any]: priorityDef.color } as React.CSSProperties)
    : undefined;
  const priorityClass = priority
    ? `kb-pri-${prioritySlug}${priorityDef?.color ? " kb-pri-custom" : ""}`
    : "";

  // Due status is computed after mount only, so server and client markup match.
  const dueStatus =
    mounted && highlightDueDates && !isDone
      ? getDueStatus(dueDate, dueSoonDays)
      : null;
  const dueLabel =
    dueStatus === "overdue"
      ? labels.overdue
      : dueStatus === "today"
      ? labels.dueToday
      : labels.dueSoon;

  return (
    <div
      className={`card ${priorityClass} ${dueStatus ? `kb-due-${dueStatus}` : ""} ${
        isExpanded ? "expanded" : ""
      } ${isDragging ? "dragging" : ""} ${isOverlay ? "overlay" : ""}`}
      style={priorityStyle}
      role="article"
      aria-label={`Card: ${title}`}
    >
      <div className="card-header">
        <h3 className="card-title">
          {isExpanded || title.length <= 100
            ? title
            : `${title.substring(0, 100)}...`}
        </h3>

        <div className="card-actions">
          {onOpen && (
            <button
              className="card-action-button open"
              onClick={() => onOpen(id)}
              aria-label={labels.openCard}
              type="button"
            >
              <OpenIcon />
            </button>
          )}
          {onEdit && (
            <button
              className="card-action-button edit"
              onClick={() => onEdit(id)}
              aria-label={labels.editCard}
              type="button"
            >
              <EditIcon />
            </button>
          )}
          {onDelete && (
            <button
              className="card-action-button delete"
              onClick={() => onDelete(id)}
              aria-label={labels.deleteCard}
              type="button"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      </div>

      {(priority || dueStatus) && (
        <div className="priority-badge-container">
          {priority && (
            <span
              className={`priority-badge ${prioritySlug}${
                priorityDef?.color ? " custom" : ""
              }`}
            >
              {priorityDef?.label ?? priority}
            </span>
          )}
          {dueStatus && (
            <span
              className={`kb-due-chip ${dueStatus}`}
              data-testid={`due-${id}`}
              title={`${labels.due}: ${dueDate}`}
            >
              <CalendarIcon />
              {dueLabel}
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="card-details kb-expand-in">
          {description && (
            <div className="card-description">
              <p>{description}</p>
            </div>
          )}

          {dueDate && (
            <div className="card-detail">
              <span className="detail-label">{labels.due}:</span>
              <span className="detail-value">{dueDate}</span>
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="card-tags">
              {tags.map((tag) => (
                <span key={tag} className="card-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {schemaFields.map((f) => {
            const value = card[f.key];
            return (
              <div className="card-detail" key={f.key} data-field={f.key}>
                <span className="detail-label">{f.label}:</span>
                <span className="detail-value">
                  {f.type === "tags" && Array.isArray(value)
                    ? value.join(", ")
                    : f.type === "select"
                    ? f.options?.find((o) => o.value === value)?.label ??
                      String(value)
                    : String(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="card-footer">
        {renderAvatar
          ? renderAvatar(avatarPath)
          : avatarPath && <DefaultAvatar avatarPath={avatarPath} />}

        {hasDetails && toggleExpand && (
          <button
            onClick={() => toggleExpand(id)}
            className="expand-toggle"
            aria-label={isExpanded ? labels.collapseCard : labels.expandCard}
            type="button"
          >
            <CollapseExpandIcon isExpanded={isExpanded} />
          </button>
        )}
      </div>
    </div>
  );
};

export const DefaultAvatar = ({ avatarPath }: { avatarPath?: string }) => {
  if (!avatarPath) return null;
  return (
    <div className="avatar-container">
      <img src={avatarPath} alt="" className="avatar" loading="lazy" />
    </div>
  );
};

// Built-in "Add card" control: a button that expands into a title form.
export const DefaultAddCard = ({ column }: { column: string }) => {
  const { kanban, labels, onCardAdd, onTaskAddedCallback } = useBoard();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const card = kanban.addCard(column, { title });
    setNewTitle("");
    setIsAdding(false);
    onCardAdd?.(card, column);
    onTaskAddedCallback?.(title);
  };

  return isAdding ? (
    <div className="add-card-motion-container">
      <form onSubmit={handleSubmit} className="add-card-form kb-pop-in">
        <div className="add-card-input-container">
          <input
            type="text"
            className="add-card-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={labels.addCardPlaceholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsAdding(false);
            }}
            aria-label={labels.newCardTitle}
            maxLength={200}
          />
        </div>
        <div className="add-card-buttons">
          <button type="submit" disabled={!newTitle.trim()}>
            {labels.addCard}
          </button>
          <button type="button" onClick={() => setIsAdding(false)}>
            {labels.cancel}
          </button>
        </div>
      </form>
    </div>
  ) : (
    <button
      type="button"
      className="add-card"
      onClick={() => setIsAdding(true)}
      aria-label={labels.addCardAriaLabel}
    >
      <PlusIcon /> {labels.addCard}
    </button>
  );
};
