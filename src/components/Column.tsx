import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";
import type { Card, Column } from "../types";
import { COLUMN_DROP_PREFIX, LANE_SEP } from "../core";
import { useBoard } from "./context";
import { DefaultAddCard, DefaultCard, SortableCard } from "./Card";
import { ChevronIcon, DeleteIcon, EditIcon, GripIcon } from "../icons";

export type ColumnDragHandle = { attributes: any; listeners: any };

// v2's renderCard received a native drag-start handler. Dragging is handled by
// the card wrapper now, so this is a no-op kept for backward compatibility.
export const legacyDragStart = () => {};

// Default per-column loading placeholder (skeleton cards).
const ColumnLoadingState = () => (
  <div className="column-loading" aria-busy="true" aria-live="polite">
    {[0, 1, 2].map((i) => (
      <div className="column-skeleton-card" key={i} />
    ))}
  </div>
);

// Calls onLoadMore when scrolled into view (and on click, as a fallback).
// Observer-triggered requests are de-duplicated until the column's card count
// or loading state changes; an explicit click always goes through.
const LoadMoreTrigger = ({ column, count }: { column: Column; count: number }) => {
  const { onLoadMore, labels } = useBoard();
  const ref = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const loading = !!column.isLoadingMore;

  useEffect(() => {
    pending.current = false;
  }, [loading, count]);

  useEffect(() => {
    const el = ref.current;
    if (!el || loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (pending.current || !entries.some((e) => e.isIntersecting)) return;
      pending.current = true;
      onLoadMore?.(column.key);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, count, onLoadMore, column.key]);

  return (
    <button
      ref={ref}
      type="button"
      className="kb-load-more"
      onClick={() => {
        if (loading) return;
        pending.current = true;
        onLoadMore?.(column.key);
      }}
      disabled={loading}
      aria-busy={loading}
      data-testid={`load-more-${column.key}`}
    >
      {loading ? labels.loadingMore : labels.loadMore}
    </button>
  );
};

// Column header: drag grip, title (renamable), counter, collapse / delete.
const ColumnHeader = ({
  column,
  count,
  totalCount,
  isLimitExceeded,
  dragHandle,
}: {
  column: Column;
  count: number;
  totalCount: number;
  isLimitExceeded: boolean;
  dragHandle?: ColumnDragHandle;
}) => {
  const {
    labels,
    renderColumnHeader,
    enableColumnCollapse,
    enableColumnManagement,
    isCollapsed,
    toggleCollapse,
    renameColumn,
    deleteColumn,
  } = useBoard();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const collapsed = isCollapsed(column.key);

  const startRename = () => {
    setDraft(column.title);
    setRenaming(true);
  };
  const commitRename = () => {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== column.title) renameColumn(column.key, next);
  };

  const custom = renderColumnHeader?.(column, {
    count,
    limit: column.limit,
    isLimitExceeded,
    isCollapsed: collapsed,
    toggleCollapse: () => toggleCollapse(column.key),
  });

  return (
    <>
      <div
        className="column-title"
        style={column.color ? { backgroundColor: column.color } : undefined}
      >
        {dragHandle && (
          <button
            type="button"
            className="column-drag-handle"
            aria-label={labels.reorderColumn(column.title)}
            data-testid={`column-grip-${column.key}`}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripIcon />
          </button>
        )}
        {custom !== undefined ? (
          <div className="column-title-custom">{custom}</div>
        ) : renaming ? (
          <input
            className="column-rename-input"
            value={draft}
            autoFocus
            aria-label={labels.renameColumn(column.title)}
            data-testid={`column-rename-input-${column.key}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <div
            className="column-title-text"
            onDoubleClick={enableColumnManagement ? startRename : undefined}
          >
            {column.title}
          </div>
        )}
        {custom === undefined && (
          <div className="column-counter-container">
            {enableColumnManagement && !renaming && (
              <span className="column-manage-actions">
                <button
                  type="button"
                  className="column-action"
                  aria-label={labels.renameColumn(column.title)}
                  data-testid={`column-rename-${column.key}`}
                  onClick={startRename}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="column-action"
                  aria-label={labels.deleteColumn(column.title)}
                  data-testid={`column-delete-${column.key}`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <DeleteIcon />
                </button>
              </span>
            )}
            <span className={`counter ${isLimitExceeded ? "exceeded" : ""}`}>
              {count}
              {column.limit !== undefined && `/${column.limit}`}
            </span>
            {enableColumnCollapse && (
              <button
                type="button"
                className="column-action"
                aria-label={labels.collapseColumn(column.title)}
                aria-expanded
                data-testid={`column-collapse-${column.key}`}
                onClick={() => toggleCollapse(column.key)}
              >
                <ChevronIcon direction="left" />
              </button>
            )}
          </div>
        )}
      </div>
      {confirmingDelete && (
        <div
          className="delete-confirm column-delete-confirm"
          role="alertdialog"
          aria-label={labels.deleteColumn(column.title)}
          data-testid={`column-delete-confirm-${column.key}`}
        >
          <span className="delete-confirm-text">
            {labels.deleteColumnConfirm(column.title, totalCount)}
          </span>
          <div className="delete-confirm-actions">
            <button
              type="button"
              className="delete-confirm-cancel"
              onClick={() => setConfirmingDelete(false)}
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              className="delete-confirm-delete"
              onClick={() => {
                setConfirmingDelete(false);
                deleteColumn(column.key);
              }}
            >
              {labels.delete}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Narrow strip shown for a collapsed column. Still a drop target: cards
// dropped on it are appended to the column.
const CollapsedColumn = ({
  column,
  count,
  setNodeRef,
  isOver,
}: {
  column: Column;
  count: number;
  setNodeRef: (el: HTMLElement | null) => void;
  isOver: boolean;
}) => {
  const { labels, toggleCollapse } = useBoard();
  return (
    <div
      ref={setNodeRef}
      className={`kanban-column collapsed ${isOver ? "active" : ""}`}
      data-testid={`column-${column.key}`}
      data-collapsed="true"
    >
      <button
        type="button"
        className="collapsed-column-toggle"
        style={column.color ? { backgroundColor: column.color } : undefined}
        aria-label={labels.expandColumn(column.title)}
        aria-expanded={false}
        data-testid={`column-collapse-${column.key}`}
        onClick={() => toggleCollapse(column.key)}
      >
        <ChevronIcon direction="right" />
        <span className="collapsed-column-count">{count}</span>
        <span className="collapsed-column-title">{column.title}</span>
      </button>
    </div>
  );
};

interface ColumnProps {
  column: Column;
  filteredCards: Card[];
  columnDragHandle?: ColumnDragHandle;
  laneValue?: string; // swimlane value; scopes the column's droppable id
}

export const ColumnComponent = ({
  column: columnData,
  filteredCards,
  columnDragHandle,
  laneValue,
}: ColumnProps) => {
  const board = useBoard();
  const {
    labels,
    cards,
    setCards,
    renderCard,
    renderAddCard,
    renderColumnLoading,
    onCardEdit,
    onCardUpdate,
    onCardDelete,
    columnForAddCard,
    emptyColumnMessage,
    deleteConfirmation,
    undoDuration,
    enableCardDetails,
    openDetails,
    virtualizeColumnsOver,
    virtualItemEstimatedHeight,
    enableMultiSelect,
    selectedIds,
    onToggleSelect,
    isCollapsed,
    wipBlockedColumn,
  } = board;
  const column = columnData.key;
  const limit = columnData.limit;

  // Column-level droppable so empty columns and gaps still accept drops. In
  // swimlane mode the id also encodes the lane.
  const droppableId =
    laneValue !== undefined
      ? `${COLUMN_DROP_PREFIX}${laneValue}${LANE_SEP}${column}`
      : `${COLUMN_DROP_PREFIX}${column}`;
  const collapsed = isCollapsed(column);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: droppableId,
    // Lets the board's collision detection prefer a collapsed strip that is
    // directly under the pointer.
    data: { collapsed },
  });

  const shouldVirtualize =
    virtualizeColumnsOver !== undefined &&
    !columnData.isLoading &&
    filteredCards.length > virtualizeColumnsOver;
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {}
  );
  // Id of the card awaiting an inline delete confirmation ("confirm" mode).
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  // Card removed from view but not yet committed ("undo" mode).
  const [pendingDelete, setPendingDelete] = useState<{
    card: Card;
    index: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timer on unmount to avoid updates after unmount.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  if (collapsed) {
    return (
      <CollapsedColumn
        column={columnData}
        count={filteredCards.length}
        setNodeRef={setDroppableRef}
        isOver={isOver}
      />
    );
  }

  const isLimitExceeded = limit !== undefined && filteredCards.length > limit;
  const showAddCard = columnData.allowAddCard ?? columnForAddCard === column;

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Immediately remove a card and notify the consumer.
  // State is updated before callbacks fire, so persistence layers snapshot the
  // pre-mutation state for rollback.
  const commitDelete = (cardId: string) => {
    setCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
    onCardDelete?.(cardId);
  };

  // Flush an in-flight "undo" deletion (commit it now).
  const flushPendingDelete = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setPendingDelete((pending) => {
      if (pending) onCardDelete?.(pending.card.id);
      return null;
    });
  };

  const handleDeleteCard = (cardId: string) => {
    if (deleteConfirmation === "confirm") {
      setConfirmingDeleteId(cardId);
      return;
    }

    if (deleteConfirmation === "undo") {
      // Commit any previous pending delete before starting a new one.
      flushPendingDelete();

      const index = cards.findIndex((card) => card.id === cardId);
      const card = cards[index];
      if (!card) return;

      // Remove from view immediately, but defer onCardDelete.
      setCards((prevCards) => prevCards.filter((c) => c.id !== cardId));
      setPendingDelete({ card, index });

      undoTimerRef.current = setTimeout(() => {
        undoTimerRef.current = null;
        onCardDelete?.(card.id);
        setPendingDelete(null);
      }, undoDuration);
      return;
    }

    commitDelete(cardId);
  };

  // Restore the card removed in "undo" mode back to its original position.
  const handleUndoDelete = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setPendingDelete((pending) => {
      if (!pending) return null;
      setCards((prevCards) => {
        const copy = [...prevCards];
        copy.splice(Math.min(pending.index, copy.length), 0, pending.card);
        return copy;
      });
      return null;
    });
  };

  const handleConfirmDelete = (cardId: string) => {
    setConfirmingDeleteId(null);
    commitDelete(cardId);
  };

  const handleEditClick = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setNewTitle(currentTitle);
  };

  const handleSaveEdit = (cardId: string) => {
    const title = newTitle.trim();
    if (title === "") return;
    const current = cards.find((c) => c.id === cardId);
    const changed = !current || current.title !== title;
    setEditingCardId(null);
    if (changed) {
      setCards((prevCards) =>
        prevCards.map((card) => (card.id === cardId ? { ...card, title } : card))
      );
    }
    // onCardEdit fires on every save (as in v2); onCardUpdate only on change.
    onCardEdit?.(cardId, title);
    if (changed) onCardUpdate?.(cardId, { title });
  };

  const handleKeyDown = (e: React.KeyboardEvent, cardId: string) => {
    if (e.key === "Enter") handleSaveEdit(cardId);
    else if (e.key === "Escape") setEditingCardId(null);
  };

  // Inner content of a single card slot (card or edit box, plus any inline
  // delete confirmation). Shared by the normal and virtualized list paths.
  const renderSlotContent = (card: Card) => {
    const selected = enableMultiSelect && selectedIds.has(card.id);
    return (
      <>
        {editingCardId === card.id ? (
          <div className="card-edit" data-card-id={card.id}>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={() => handleSaveEdit(card.id)}
              onKeyDown={(e) => handleKeyDown(e, card.id)}
              aria-label={labels.editCardTitle}
            />
          </div>
        ) : (
          <SortableCard
            id={card.id}
            title={card.title}
            virtualized={shouldVirtualize}
            selected={selected}
            onSelect={
              enableMultiSelect
                ? (e) =>
                    onToggleSelect(
                      card.id,
                      e,
                      filteredCards.map((c) => c.id)
                    )
                : undefined
            }
            onOpen={enableCardDetails ? () => openDetails(card.id) : undefined}
          >
            {(isDragging) =>
              renderCard ? (
                renderCard(card, legacyDragStart, expandedCards[card.id], toggleExpand, {
                  isDragging,
                  edit: () => handleEditClick(card.id, card.title),
                  delete: () => handleDeleteCard(card.id),
                  openDetails: () => openDetails(card.id),
                  isSelected: selected,
                })
              ) : (
                <DefaultCard
                  card={card}
                  isDone={columnData.isDone}
                  isExpanded={expandedCards[card.id]}
                  isDragging={isDragging}
                  toggleExpand={() => toggleExpand(card.id)}
                  onDelete={() => handleDeleteCard(card.id)}
                  onEdit={() => handleEditClick(card.id, card.title)}
                  onOpen={
                    enableCardDetails ? () => openDetails(card.id) : undefined
                  }
                />
              )
            }
          </SortableCard>
        )}
        {confirmingDeleteId === card.id && (
          <div
            className="delete-confirm"
            role="alertdialog"
            aria-label={labels.deleteConfirm}
            data-testid={`delete-confirm-${card.id}`}
          >
            <span className="delete-confirm-text">{labels.deleteConfirm}</span>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="delete-confirm-cancel"
                onClick={() => setConfirmingDeleteId(null)}
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                className="delete-confirm-delete"
                onClick={() => handleConfirmDelete(card.id)}
              >
                {labels.delete}
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  // WIP notice, undo toast, load-more and add-card — shared by both list paths.
  const columnFooter = (
    <>
      {columnData.hasMore && (
        <LoadMoreTrigger
          column={columnData}
          count={cards.filter((c) => c.status === column).length}
        />
      )}
      {wipBlockedColumn === column && limit !== undefined && (
        <div
          className="wip-limit-notification show"
          role="status"
          data-testid={`wip-blocked-${column}`}
        >
          {labels.wipReached(limit)}
        </div>
      )}
      {pendingDelete && (
        <div
          className="undo-toast"
          role="status"
          aria-live="polite"
          data-testid={`undo-toast-${column}`}
        >
          <span className="undo-toast-text">{labels.cardDeleted}</span>
          <button
            type="button"
            className="undo-toast-button"
            onClick={handleUndoDelete}
          >
            {labels.undo}
          </button>
        </div>
      )}
      <div className="add-card-container">
        {showAddCard &&
          (renderAddCard ? (
            renderAddCard(column, setCards)
          ) : (
            <DefaultAddCard column={column} />
          ))}
      </div>
    </>
  );

  const totalCount = cards.filter((c) => c.status === column).length;

  return (
    <div
      className={`kanban-column ${isOver ? "active" : ""} ${
        isLimitExceeded ? "limit-exceeded" : ""
      }`}
      data-testid={`column-${column}`}
    >
      <ColumnHeader
        column={columnData}
        count={filteredCards.length}
        totalCount={totalCount}
        isLimitExceeded={isLimitExceeded}
        dragHandle={columnDragHandle}
      />
      {shouldVirtualize ? (
        <SortableContext
          items={filteredCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <VirtualCardSlots
            setDroppableRef={setDroppableRef}
            isOver={isOver}
            cards={filteredCards}
            estimatedHeight={virtualItemEstimatedHeight}
            renderSlotContent={renderSlotContent}
          />
          <div className="column-footer">{columnFooter}</div>
        </SortableContext>
      ) : (
        <div
          ref={setDroppableRef}
          className={`column-content ${isOver ? "active" : ""}`}
        >
          {columnData.isLoading ? (
            <div data-testid={`column-loading-${column}`}>
              {renderColumnLoading ? (
                renderColumnLoading(columnData)
              ) : (
                <ColumnLoadingState />
              )}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="column-empty-state">
              {columnData.emptyMessage ?? emptyColumnMessage}
            </div>
          ) : (
            <SortableContext
              items={filteredCards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredCards.map((card) => (
                <div className="card-slot" key={card.id}>
                  {renderSlotContent(card)}
                </div>
              ))}
            </SortableContext>
          )}
          {columnFooter}
        </div>
      )}
    </div>
  );
};

// Windowed card list for very large columns. Only the visible rows are
// rendered; each is absolutely positioned by the virtualizer. The parent's
// SortableContext still lists every card id so dnd-kit knows the full order.
// The card being dragged is always kept mounted, so auto-scrolling the column
// during a drag never unmounts the drag source.
const VirtualCardSlots = ({
  setDroppableRef,
  isOver,
  cards,
  estimatedHeight,
  renderSlotContent,
}: {
  setDroppableRef: (el: HTMLElement | null) => void;
  isOver: boolean;
  cards: Card[];
  estimatedHeight: number;
  renderSlotContent: (card: Card) => ReactNode;
}) => {
  const { activeCardId } = useBoard();
  // Own the scroll element so its ref is set before the virtualizer's effects
  // run; also register it as the column droppable so drops on empty space and
  // auto-scroll work.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setRefs = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setDroppableRef(el);
  };

  const activeIndex = activeCardId
    ? cards.findIndex((c) => c.id === activeCardId)
    : -1;
  const rangeExtractor = useCallback(
    (range: Range) => {
      const base = defaultRangeExtractor(range);
      if (activeIndex === -1 || base.includes(activeIndex)) return base;
      return [...base, activeIndex].sort((a, b) => a - b);
    },
    [activeIndex]
  );

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedHeight,
    overscan: 6,
    rangeExtractor,
  });

  return (
    <div
      ref={setRefs}
      className={`column-content virtualized ${isOver ? "active" : ""}`}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const card = cards[vi.index];
          return (
            <div
              key={card.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="card-slot virtual"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderSlotContent(card)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
