import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type {
  BaseCard,
  Card,
  Column,
  KanbanBoardProps,
  PriorityDef,
} from "./types";
import {
  COLUMN_DROP_PREFIX,
  COLUMN_SORT_PREFIX,
  LANE_SEP,
  computeReorder,
  computeSwimlaneReorder,
  filterCards,
  laneOf,
} from "./core";
import { resolveLabels } from "./labels";
import { useKanban } from "./useKanban";
import { BoardContext } from "./components/context";
import type { BoardContextValue } from "./components/context";
import { ColumnComponent } from "./components/Column";
import { legacyDragStart } from "./components/Column";
import type { ColumnDragHandle } from "./components/Column";
import { useInjectedStyles } from "./injectStyles";
import { DefaultCard } from "./components/Card";
import { AddColumnTile, CardDetailsPanel } from "./components/CardDetails";
import { SearchIcon } from "./icons";

const DEFAULT_PRIORITIES: PriorityDef[] = [
  { value: "Low" },
  { value: "Medium" },
  { value: "High" },
];

// Collision strategy:
// - Column drags snap to sibling column sortables only.
// - Swimlane card drags use pointer-based hit-testing so a card lands in the
//   lane actually under the pointer (closestCorners misfires across stacked
//   lanes).
// - A collapsed column under the pointer always wins.
// - Plain card drags use closestCorners.
const makeBoardCollisionDetection =
  (swimlaneMode: boolean): CollisionDetection =>
  (args) => {
    if (String(args.active.id).startsWith(COLUMN_SORT_PREFIX)) {
      const columnContainers = args.droppableContainers.filter((c) =>
        String(c.id).startsWith(COLUMN_SORT_PREFIX)
      );
      return closestCenter({ ...args, droppableContainers: columnContainers });
    }
    const hits = pointerWithin(args);
    // A collapsed column is a narrow strip: when the pointer is on it, it wins
    // over nearby cards that closestCorners would otherwise pick.
    const collapsedHit = hits.find(
      (h) => h.data?.droppableContainer?.data?.current?.collapsed
    );
    if (collapsedHit) return [collapsedHit];
    if (swimlaneMode) {
      return hits.length ? hits : closestCenter(args);
    }
    return closestCorners(args);
  };

// Sortable wrapper for a whole column (drag-to-reorder). The column moves via
// the wrapper's transform; the drag handle (grip) lives in the column header.
const SortableColumn = ({
  id,
  children,
}: {
  id: string;
  children: (handle: ColumnDragHandle) => ReactNode;
}) => {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    height: "fit-content",
  };
  return (
    <div ref={setNodeRef} style={style} className="sortable-column-wrapper">
      {children({ attributes, listeners })}
    </div>
  );
};

const LoadingSpinner = ({ label }: { label: string }) => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>{label}</p>
  </div>
);

function KanbanBoardImpl(props: KanbanBoardProps<Card>) {
  const {
    columns: columnsProp,
    columnForAddCard,
    initialCards,
    cards: controlledCards,
    onCardsChange,
    className,
    style,
    dir,
    labels: labelOverrides,
    onCardMove,
    onCardReorder,
    injectStyles = true,
    styleNonce,
    searchFields,
    onCardEdit,
    onCardUpdate,
    onCardDelete,
    onCardAdd,
    onTaskAddedCallback,
    createCardId,
    renderCard,
    renderAvatar,
    renderAddCard,
    renderColumnHeader,
    priorities = DEFAULT_PRIORITIES,
    highlightDueDates = true,
    dueSoonDays = 2,
    enableCardDetails = false,
    renderCardDetails,
    renderCardDetailsExtra,
    isLoading = false,
    loadingComponent,
    emptyColumnMessage,
    renderColumnLoading,
    onLoadMore,
    deleteConfirmation = "immediate",
    undoDuration = 5000,
    cardFields,
    swimlaneBy,
    swimlanes,
    enableColumnReorder = false,
    onColumnsReorder,
    enableColumnCollapse = false,
    onColumnCollapseChange,
    enableColumnManagement = false,
    onColumnsChange,
    onColumnAdd,
    onColumnRename,
    onColumnDelete,
    enableMultiSelect = false,
    onBulkMove,
    onBulkDelete,
    virtualizeColumnsOver,
    virtualItemEstimatedHeight = 120,
    enableSearch = false,
    enableFiltering = false,
    filterConfigs = [],
    onFilterChange,
    renderSearchInput,
    renderFilterMenu,
  } = props;

  const labels = useMemo(() => resolveLabels(labelOverrides), [labelOverrides]);

  const kanban = useKanban<Card>({
    columns: columnsProp,
    initialCards,
    cards: controlledCards,
    onCardsChange,
    onColumnsChange,
    createCardId,
    preserveColumnOrder: enableColumnReorder,
  });
  const { cards, setCards, columns } = kanban;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Becomes true after the first client render; used for time-dependent UI
  // (due-date highlighting) so server and client markup match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ---- Search & filters ----
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const searchKey = searchFields ? searchFields.join("\u0000") : "";
  const filteredCards = useMemo(
    () => filterCards(cards, searchTerm, filters, searchFields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, searchTerm, filters, searchKey]
  );
  useInjectedStyles(injectStyles, styleNonce);

  const handleFilterChange = (field: string, value: string | null) => {
    const newFilters = { ...filters, [field]: value || null };
    if (!value) delete newFilters[field];
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  // ---- Column collapse ----
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const isCollapsed = useCallback(
    (key: string) => {
      if (!enableColumnCollapse) return false;
      if (key in collapsedMap) return collapsedMap[key];
      return !!columnsRef.current.find((c) => c.key === key)?.collapsed;
    },
    [enableColumnCollapse, collapsedMap]
  );
  const toggleCollapse = useCallback(
    (key: string) => {
      const next = !isCollapsed(key);
      setCollapsedMap((prev) => ({ ...prev, [key]: next }));
      onColumnCollapseChange?.(key, next);
    },
    [isCollapsed, onColumnCollapseChange]
  );

  // ---- Column management ----
  const renameColumn = useCallback(
    (key: string, title: string) => {
      kanban.renameColumn(key, title);
      onColumnRename?.(key, title);
    },
    [kanban, onColumnRename]
  );
  const deleteColumn = useCallback(
    (key: string) => {
      const removed = kanban.deleteColumn(key);
      onColumnDelete?.(key, removed);
    },
    [kanban, onColumnDelete]
  );
  const addColumn = (title: string) => {
    const created = kanban.addColumn({ title });
    onColumnAdd?.(created);
  };

  // ---- Card details ----
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null);
  const openDetails = useCallback(
    (id: string) => {
      if (enableCardDetails) setDetailsCardId(id);
    },
    [enableCardDetails]
  );
  const detailsCard = detailsCardId
    ? cards.find((c) => c.id === detailsCardId) ?? null
    : null;

  // ---- Drag and drop (pointer, touch, keyboard via dnd-kit) ----
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [wipBlockedColumn, setWipBlockedColumn] = useState<string | null>(null);
  const wipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    // Mouse: small distance so clicks on card buttons don't start a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: short press-and-hold to begin a drag (lets touch scrolling work).
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeCard = activeCardId
    ? cards.find((c) => c.id === activeCardId) ?? null
    : null;

  // ---- Multi-select ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  const handleToggleSelect = useCallback(
    (cardId: string, e: React.MouseEvent, columnCardIds: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastSelectedRef.current) {
          const a = columnCardIds.indexOf(lastSelectedRef.current);
          const b = columnCardIds.indexOf(cardId);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(columnCardIds[i]);
            return next;
          }
        }
        if (e.metaKey || e.ctrlKey) {
          next.has(cardId) ? next.delete(cardId) : next.add(cardId);
        } else {
          next.clear();
          next.add(cardId);
        }
        return next;
      });
      lastSelectedRef.current = cardId;
    },
    []
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkMove = (newStatus: string) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setCards((prev) => {
      const moved = prev.filter((c) => selectedIds.has(c.id));
      const rest = prev.filter((c) => !selectedIds.has(c.id));
      return [...rest, ...moved.map((c) => ({ ...c, status: newStatus }))];
    });
    onBulkMove?.(ids, newStatus);
    clearSelection();
  };

  const bulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setCards((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    onBulkDelete?.(ids);
    clearSelection();
  };

  const flashWipBlocked = (columnKey: string) => {
    setWipBlockedColumn(columnKey);
    if (wipTimerRef.current) clearTimeout(wipTimerRef.current);
    wipTimerRef.current = setTimeout(() => setWipBlockedColumn(null), 2000);
  };

  useEffect(() => {
    return () => {
      if (wipTimerRef.current) clearTimeout(wipTimerRef.current);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    // Column drags aren't tracked for the card overlay.
    if (String(event.active.id).startsWith(COLUMN_SORT_PREFIX)) return;
    setActiveCardId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;

    // Column reorder.
    if (String(active.id).startsWith(COLUMN_SORT_PREFIX)) {
      if (!String(over.id).startsWith(COLUMN_SORT_PREFIX)) return;
      const from = String(active.id).slice(COLUMN_SORT_PREFIX.length);
      const to = String(over.id).slice(COLUMN_SORT_PREFIX.length);
      if (from === to) return;
      const keys = columnsRef.current.map((c) => c.key);
      const nextKeys = arrayMove(keys, keys.indexOf(from), keys.indexOf(to));
      kanban.moveColumn(from, to);
      onColumnsReorder?.(nextKeys);
      return;
    }

    const result = swimlaneBy
      ? computeSwimlaneReorder(
          cardsRef.current,
          columnsRef.current,
          String(active.id),
          String(over.id),
          swimlaneBy
        )
      : computeReorder(
          cardsRef.current,
          columnsRef.current,
          String(active.id),
          String(over.id)
        );
    if (!result) return;
    if ("wipBlockedColumn" in result) {
      flashWipBlocked(result.wipBlockedColumn);
      return;
    }

    // As in v2, onCardMove fires when a card changes column (or swimlane);
    // reorders within the same column go to onCardReorder.
    const cardId = String(active.id);
    const before = cardsRef.current.find((c) => c.id === cardId);
    const after = result.nextCards.find((c) => c.id === cardId);
    const crossed =
      before?.status !== result.destColumn ||
      (!!swimlaneBy &&
        !!before &&
        !!after &&
        laneOf(before, swimlaneBy) !== laneOf(after, swimlaneBy));
    setCards(result.nextCards);
    if (crossed) onCardMove?.(cardId, result.destColumn, result.position);
    else onCardReorder?.(cardId, result.destColumn, result.position);
  };

  const handleDragCancel = () => setActiveCardId(null);

  // Screen-reader announcements for keyboard / assistive-tech dragging, using
  // card and column titles rather than ids.
  const titleOf = (id: string | number) =>
    cardsRef.current.find((c) => c.id === String(id))?.title ?? String(id);
  const targetTitle = (overId: string | number) => {
    const id = String(overId);
    let columnKey: string | undefined;
    if (id.startsWith(COLUMN_DROP_PREFIX)) {
      const rest = id.slice(COLUMN_DROP_PREFIX.length);
      const sep = rest.indexOf(LANE_SEP);
      columnKey = sep === -1 ? rest : rest.slice(sep + LANE_SEP.length);
    } else {
      columnKey = cardsRef.current.find((c) => c.id === id)?.status;
    }
    return (
      columnsRef.current.find((c) => c.key === columnKey)?.title ?? columnKey ?? id
    );
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => labels.announcePickUp(titleOf(active.id)),
    onDragOver: ({ active, over }) =>
      over
        ? labels.announceOver(titleOf(active.id), targetTitle(over.id))
        : labels.announceNotOver(titleOf(active.id)),
    onDragEnd: ({ active, over }) =>
      over
        ? labels.announceDrop(titleOf(active.id), targetTitle(over.id))
        : labels.announceDropBack(titleOf(active.id)),
    onDragCancel: ({ active }) => labels.announceCancel(titleOf(active.id)),
  };

  const collisionDetection = useMemo(
    () => makeBoardCollisionDetection(!!swimlaneBy),
    [swimlaneBy]
  );

  const contextValue: BoardContextValue = {
    labels,
    kanban,
    cards,
    setCards,
    mounted,
    renderCard,
    renderAvatar,
    renderAddCard,
    renderColumnHeader,
    renderColumnLoading,
    onCardEdit,
    onCardUpdate,
    onCardDelete,
    onCardAdd,
    onTaskAddedCallback,
    createCardId,
    columnForAddCard,
    emptyColumnMessage: emptyColumnMessage ?? labels.emptyColumn,
    deleteConfirmation,
    undoDuration,
    cardFields,
    priorities,
    highlightDueDates,
    dueSoonDays,
    enableCardDetails,
    openDetails,
    virtualizeColumnsOver,
    virtualItemEstimatedHeight,
    enableMultiSelect,
    selectedIds,
    onToggleSelect: handleToggleSelect,
    enableColumnCollapse,
    isCollapsed,
    toggleCollapse,
    enableColumnManagement,
    renameColumn,
    deleteColumn,
    onLoadMore,
    activeCardId,
    wipBlockedColumn,
  };

  const rootClass = `kanban-board-container ${className || ""}`;

  if (isLoading) {
    return (
      <div className={rootClass} style={style} dir={dir}>
        {loadingComponent || <LoadingSpinner label={labels.loadingBoard} />}
      </div>
    );
  }

  const renderColumn = (
    column: Column,
    columnDragHandle?: ColumnDragHandle,
    laneValue?: string
  ) => (
    <ColumnComponent
      column={column}
      filteredCards={filteredCards.filter(
        (card) =>
          card.status === column.key &&
          (laneValue === undefined ||
            !swimlaneBy ||
            laneOf(card, swimlaneBy) === laneValue)
      )}
      columnDragHandle={columnDragHandle}
      laneValue={laneValue}
    />
  );

  // Derive swimlanes (explicit, or from card field values + an ungrouped lane).
  const laneList: { value: string; label: string }[] = (() => {
    if (!swimlaneBy) return [];
    if (swimlanes && swimlanes.length) return swimlanes;
    const seen = new Set<string>();
    const lanes: { value: string; label: string }[] = [];
    let hasUngrouped = false;
    for (const c of cards) {
      const v = laneOf(c, swimlaneBy);
      if (v === "") {
        hasUngrouped = true;
        continue;
      }
      if (!seen.has(v)) {
        seen.add(v);
        lanes.push({ value: v, label: v });
      }
    }
    if (hasUngrouped) lanes.push({ value: "", label: labels.ungrouped });
    return lanes;
  })();

  const activeIsDone = activeCard
    ? !!columns.find((c) => c.key === activeCard.status)?.isDone
    : false;

  return (
    <BoardContext.Provider value={contextValue}>
      <div className={rootClass} style={style} dir={dir}>
        {(enableSearch || (enableFiltering && filterConfigs.length > 0)) && (
          <div className="kanban-search">
            {enableSearch &&
              (renderSearchInput ? (
                renderSearchInput(searchTerm, setSearchTerm)
              ) : (
                <div className="search-input-wrapper">
                  <SearchIcon />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={labels.searchPlaceholder}
                    aria-label={labels.searchAriaLabel}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="clear-search"
                      onClick={() => setSearchTerm("")}
                      aria-label={labels.clearSearch}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

            {enableFiltering && filterConfigs.length > 0 && (
              <div className="filter-controls">
                {filterConfigs.map((config) => (
                  <div key={config.field} className="filter-select-container">
                    {renderFilterMenu ? (
                      renderFilterMenu(
                        config,
                        filters[config.field] || null,
                        handleFilterChange
                      )
                    ) : (
                      <>
                        <label
                          htmlFor={`filter-${config.field}`}
                          className="filter-label"
                        >
                          {config.label}:
                        </label>
                        <select
                          id={`filter-${config.field}`}
                          value={filters[config.field] || ""}
                          onChange={(e) =>
                            handleFilterChange(
                              config.field,
                              e.target.value || null
                            )
                          }
                          aria-label={labels.filterBy(config.label)}
                        >
                          <option value="">{labels.filterAll(config.label)}</option>
                          {config.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="clear-filters"
                  onClick={clearAllFilters}
                  disabled={Object.keys(filters).length === 0}
                  aria-label={labels.clearFilters}
                >
                  {labels.clearFilters}
                </button>
              </div>
            )}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {swimlaneBy ? (
            <div className="kanban-swimlanes">
              {laneList.map((lane) => (
                <div
                  className="swimlane"
                  key={lane.value || "__ungrouped"}
                  data-testid={`swimlane-${lane.value || "ungrouped"}`}
                >
                  <div className="swimlane-header">
                    <span className="swimlane-title">{lane.label}</span>
                    <span className="swimlane-count">
                      {cards.filter((c) => laneOf(c, swimlaneBy) === lane.value).length}
                    </span>
                  </div>
                  <div className="kanban-board">
                    {columns.map((column) => (
                      <React.Fragment key={`${lane.value}-${column.key}`}>
                        {renderColumn(column, undefined, lane.value)}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="kanban-board">
              {enableColumnReorder ? (
                <SortableContext
                  items={columns.map((c) => COLUMN_SORT_PREFIX + c.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  {columns.map((column) => (
                    <SortableColumn key={column.key} id={COLUMN_SORT_PREFIX + column.key}>
                      {(handle) => renderColumn(column, handle)}
                    </SortableColumn>
                  ))}
                </SortableContext>
              ) : (
                columns.map((column) => (
                  <React.Fragment key={column.key}>{renderColumn(column)}</React.Fragment>
                ))
              )}
              {enableColumnManagement && <AddColumnTile onAdd={addColumn} />}
            </div>
          )}
          {enableMultiSelect && selectedIds.size > 0 && (
            <div
              className="bulk-action-bar"
              role="toolbar"
              aria-label={labels.bulkActions}
              data-testid="bulk-bar"
            >
              <span className="bulk-count" data-testid="bulk-count">
                {labels.selectedCount(selectedIds.size)}
              </span>
              <span className="bulk-move-label">{labels.moveTo}</span>
              {columns.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  className="bulk-btn"
                  data-testid={`bulk-move-${col.key}`}
                  onClick={() => bulkMove(col.key)}
                >
                  {col.title}
                </button>
              ))}
              <button
                type="button"
                className="bulk-btn danger"
                data-testid="bulk-delete"
                onClick={bulkDelete}
              >
                {labels.delete}
              </button>
              <button
                type="button"
                className="bulk-btn ghost"
                data-testid="bulk-clear"
                onClick={clearSelection}
              >
                {labels.clear}
              </button>
            </div>
          )}
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className={`card-drag-overlay ${className || ""}`} dir={dir}>
                {renderCard ? (
                  renderCard(activeCard, legacyDragStart, false, () => {}, {
                    isDragging: true,
                    edit: () => {},
                    delete: () => {},
                    openDetails: () => {},
                    isSelected: selectedIds.has(activeCard.id),
                  })
                ) : (
                  <DefaultCard card={activeCard} isDone={activeIsDone} isOverlay />
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {detailsCard && (
          <CardDetailsPanel
            key={detailsCard.id}
            card={detailsCard}
            onClose={() => setDetailsCardId(null)}
            renderCardDetails={renderCardDetails}
            renderCardDetailsExtra={renderCardDetailsExtra}
          />
        )}
      </div>
    </BoardContext.Provider>
  );
}

/**
 * Drag-and-drop Kanban board. Pass your own card type for full type safety:
 * `<KanbanBoard<MyCard> columns={...} initialCards={myCards} />`.
 */
export function KanbanBoard<TCard extends BaseCard = Card>(
  props: KanbanBoardProps<TCard>
) {
  return <KanbanBoardImpl {...(props as unknown as KanbanBoardProps<Card>)} />;
}

// Props for the explicit controlled variant: `cards` and `onCardsChange` are
// required, and the uncontrolled-only `initialCards` is not accepted.
export type ControlledKanbanBoardProps<TCard extends BaseCard = Card> = Omit<
  KanbanBoardProps<TCard>,
  "initialCards" | "cards" | "onCardsChange"
> & {
  cards: TCard[];
  onCardsChange: (cards: TCard[]) => void;
};

// Explicit controlled board for consumers wiring state to a backend. This is a
// thin wrapper over KanbanBoard that makes the controlled contract type-safe.
export function ControlledKanbanBoard<TCard extends BaseCard = Card>(
  props: ControlledKanbanBoardProps<TCard>
) {
  return <KanbanBoard<TCard> {...(props as KanbanBoardProps<TCard>)} />;
}
