import React, {
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./KanbanBoard.css";

// Prefix used to identify a column's droppable area (vs. a card droppable).
const COLUMN_DROP_PREFIX = "column:";

// Pure reorder computation shared by pointer, touch and keyboard dragging.
// Translates a dnd-kit (activeId, overId) into the next flat card list plus the
// drop position within the destination column. `overId` may be a card id or a
// `column:<key>` droppable id. Returns `wipBlockedColumn` instead of a result
// when the move would exceed a destination column's WIP limit.
function computeReorder(
  cards: Card[],
  columns: Column[],
  activeId: string,
  overId: string
):
  | { nextCards: Card[]; destColumn: string; position: DropPosition }
  | { wipBlockedColumn: string }
  | null {
  const activeCard = cards.find((c) => c.id === activeId);
  if (!activeCard) return null;

  const destColumn = overId.startsWith(COLUMN_DROP_PREFIX)
    ? overId.slice(COLUMN_DROP_PREFIX.length)
    : cards.find((c) => c.id === overId)?.status;
  if (destColumn === undefined) return null;

  const sourceColumn = activeCard.status;
  const isSameColumn = sourceColumn === destColumn;

  // WIP limit check for cross-column moves.
  if (!isSameColumn) {
    const limit = columns.find((col) => col.key === destColumn)?.limit;
    if (limit !== undefined) {
      const count = cards.filter(
        (c) => c.status === destColumn && c.id !== activeId
      ).length;
      if (count >= limit) return { wipBlockedColumn: destColumn };
    }
  }

  // Determine the card the active card should be inserted before ("-1" = end),
  // honoring drag direction within a column.
  const destListNoActive = cards
    .filter((c) => c.status === destColumn && c.id !== activeId)
    .map((c) => c.id);

  let beforeId: string;
  if (overId.startsWith(COLUMN_DROP_PREFIX)) {
    beforeId = "-1";
  } else {
    const fullDestList = cards
      .filter((c) => c.status === destColumn)
      .map((c) => c.id);
    const activeIdx = fullDestList.indexOf(activeId);
    const overIdx = fullDestList.indexOf(overId);
    const overPos = destListNoActive.indexOf(overId);
    const insertPos =
      isSameColumn && activeIdx !== -1 && activeIdx < overIdx
        ? overPos + 1
        : overPos;
    beforeId = destListNoActive[insertPos] ?? "-1";
  }

  // No-op: dropping right back where it already is.
  const currentBefore =
    cards.filter((c) => c.status === sourceColumn).map((c) => c.id)[
      cards.filter((c) => c.status === sourceColumn).findIndex((c) => c.id === activeId) + 1
    ] ?? "-1";
  if (isSameColumn && beforeId === activeId) return null;
  if (isSameColumn && beforeId === currentBefore) return null;

  const rest = cards.filter((c) => c.id !== activeId);
  const updated = isSameColumn
    ? activeCard
    : { ...activeCard, status: destColumn };
  if (beforeId === "-1") {
    rest.push(updated);
  } else {
    const idx = rest.findIndex((c) => c.id === beforeId);
    if (idx === -1) rest.push(updated);
    else rest.splice(idx, 0, updated);
  }

  const columnCards = rest.filter((c) => c.status === destColumn);
  const indexInColumn = columnCards.findIndex((c) => c.id === activeId);
  const position: DropPosition = {
    prevTaskId: columnCards[indexInColumn - 1]?.id ?? null,
    nextTaskId: columnCards[indexInColumn + 1]?.id ?? null,
    index: indexInColumn,
  };

  return { nextCards: rest, destColumn, position };
}

export interface Card {
  id: string;
  title: string;
  status: string;
  avatarPath?: string;
  priority?: "Low" | "Medium" | "High";
  dueDate?: string;
  tags?: string[];
  description?: string;
  assignee?: string;
  [key: string]: any;
}

export interface Column {
  title: string;
  key: string;
  color: string;
  limit?: number; // Optional WIP limit
  isLoading?: boolean; // Optional per-column loading state (e.g. lazy-loaded data)
  emptyMessage?: string; // Optional per-column empty message (overrides emptyColumnMessage)
}

// New filter interfaces for dynamic filtering
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  field: string;
  label: string;
  options: FilterOption[];
}

// How a card deletion is guarded before onCardDelete is fired.
// - "immediate": fire onCardDelete right away (default, backwards compatible)
// - "confirm":   show an inline confirmation prompt first
// - "undo":      remove the card immediately but defer onCardDelete, showing a
//                brief undo toast that can restore the card
export type DeleteConfirmation = "immediate" | "confirm" | "undo";

// Position information about where a card landed within its destination column,
// exposed through onCardMove so consumers can persist ordering on a backend.
export interface DropPosition {
  // Id of the card immediately before the dropped card in the destination
  // column, or null if it was dropped at the top.
  prevTaskId: string | null;
  // Id of the card immediately after the dropped card in the destination
  // column, or null if it was dropped at the bottom.
  nextTaskId: string | null;
  // Zero-based index of the dropped card within the destination column.
  index: number;
}

interface DefaultCardProps {
  title: string;
  avatarPath?: string;
  id: string;
  status: string;
  priority?: "Low" | "Medium" | "High";
  dueDate?: string;
  tags?: string[];
  description?: string;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  children?: ReactNode;
  isExpanded?: boolean;
  toggleExpand?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  isDragging?: boolean; // true for the source card while it is being dragged
  isOverlay?: boolean; // true when rendered inside the DragOverlay preview
}

// Signature for custom card renderers. `isDragging` is true for the card being
// dragged (and for the drag overlay copy).
export type RenderCard = (
  card: Card,
  isDragging?: boolean,
  isExpanded?: boolean,
  toggleExpand?: (id: string) => void
) => ReactNode;

export interface KanbanBoardProps {
  columns: Column[];
  // Uncontrolled mode: the board owns card state, seeded once from initialCards.
  initialCards?: Card[];
  // Controlled mode: when provided, the board renders these cards directly and
  // never mutates internal state. Pair with onCardsChange to receive updates.
  cards?: Card[];
  // Called with the full next card list on every internal mutation (move, edit,
  // delete, add). Required for controlled mode; also fires in uncontrolled mode.
  onCardsChange?: (cards: Card[]) => void;
  columnForAddCard: string;
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => void;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardDelete?: (cardId: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  renderCard?: RenderCard;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyColumnMessage?: string;
  // Custom per-column loading UI, shown when a column has isLoading set.
  renderColumnLoading?: (column: Column) => ReactNode;
  // How to guard card deletion before onCardDelete fires. Defaults to "immediate".
  deleteConfirmation?: DeleteConfirmation;
  // How long the undo toast stays before the delete is committed (ms). Default 5000.
  undoDuration?: number;
  enableSearch?: boolean;
  enableFiltering?: boolean;
  filterConfigs?: FilterConfig[]; // New prop for custom filters
  onFilterChange?: (filters: Record<string, string | null>) => void; // Optional callback
  renderSearchInput?: (
    searchTerm: string,
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  ) => ReactNode;
  renderFilterMenu?: (
    config: FilterConfig,
    value: string | null,
    handleFilterChange: (field: string, value: string | null) => void
  ) => ReactNode;
}

interface ColumnProps {
  title: string;
  column: string;
  cards: Card[];
  columnForAddCard: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  color: string;
  limit?: number;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardDelete?: (cardId: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  renderCard?: RenderCard;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
  emptyColumnMessage?: string;
  filteredCards: Card[];
  deleteConfirmation: DeleteConfirmation;
  undoDuration: number;
  isColumnLoading?: boolean;
  emptyMessage?: string;
  renderColumnLoading?: (column: Column) => ReactNode;
  columnData: Column;
  isWipBlocked: boolean;
}

interface AddCardProps {
  column: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  onTaskAddedCallback?: (title: string) => void;
}

// Enhanced Icon Components
const DeleteIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 12 22C9.44098 22 8.15402 22 7.19926 21.4159C6.72521 21.1271 6.31729 20.743 6.00058 20.2879C5.35858 19.3671 5.27812 18.0863 5.11963 15.525L4.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.89809 2.28601 9.80498 2.3459 9.71729 2.41317C9.32163 2.7167 9.10062 3.20155 8.6586 4.17126L8.05292 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const EditIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.2454 5.05L15.9954 3.3C16.3954 2.9 16.9954 2.9 17.3954 3.3L20.6954 6.6C21.0954 7 21.0954 7.6 20.6954 8L8.69543 20C8.49543 20.2 8.19543 20.3 7.99543 20.3L3.69543 21L4.39543 16.7C4.39543 16.5 4.49543 16.2 4.69543 16L14.2454 5.05Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2954 7L17.2954 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const SearchIcon = () => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// New collapse/expand icon with animation
const CollapseExpandIcon = ({ isExpanded }: { isExpanded?: boolean }) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease",
      }}
      aria-hidden="true"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>Loading board...</p>
  </div>
);

// Default per-column loading placeholder (skeleton cards).
const ColumnLoadingState = () => (
  <div className="column-loading" aria-busy="true" aria-live="polite">
    {[0, 1, 2].map((i) => (
      <div className="column-skeleton-card" key={i} />
    ))}
  </div>
);

const KanbanBoard = ({
  columns,
  columnForAddCard,
  initialCards = [],
  cards: controlledCards,
  onCardsChange,
  onCardMove,
  onCardEdit,
  onCardDelete,
  onTaskAddedCallback,
  renderCard,
  renderAvatar,
  renderAddCard,
  isLoading = false,
  loadingComponent,
  emptyColumnMessage = "No cards yet",
  renderColumnLoading,
  deleteConfirmation = "immediate",
  undoDuration = 5000,
  enableSearch = false,
  enableFiltering = false,
  filterConfigs = [],
  onFilterChange,
  renderSearchInput,
  renderFilterMenu,
}: KanbanBoardProps) => {
  // Controlled vs. uncontrolled: if `cards` is provided the board renders it
  // directly and never touches internal state; otherwise it owns the state,
  // seeded once from `initialCards`.
  const isControlled = controlledCards !== undefined;
  const [internalCards, setInternalCards] = useState<Card[]>(initialCards);
  const cards = isControlled ? (controlledCards as Card[]) : internalCards;

  // Refs keep the stable setCards closure below reading the latest values.
  const cardsRef = useRef<Card[]>(cards);
  cardsRef.current = cards;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onCardsChangeRef = useRef(onCardsChange);
  onCardsChangeRef.current = onCardsChange;

  // Drop-in replacement for the old setCards, kept stable across renders.
  // Accepts a value or updater, updates internal state (uncontrolled only) and
  // always notifies via onCardsChange so controlled consumers can persist.
  const setCards = useCallback<
    React.Dispatch<React.SetStateAction<Card[]>>
  >((update) => {
    const base = cardsRef.current;
    const next =
      typeof update === "function"
        ? (update as (prev: Card[]) => Card[])(base)
        : update;
    cardsRef.current = next;
    if (!isControlledRef.current) setInternalCards(next);
    onCardsChangeRef.current?.(next);
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const [filteredCards, setFilteredCards] = useState<Card[]>(cards);

  const boardRef = useRef<HTMLDivElement>(null);

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
    ? cardsRef.current.find((c) => c.id === activeCardId) ?? null
    : null;

  const flashWipBlocked = (columnKey: string) => {
    setWipBlockedColumn(columnKey);
    if (wipTimerRef.current) clearTimeout(wipTimerRef.current);
    wipTimerRef.current = setTimeout(() => setWipBlockedColumn(null), 2000);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;

    const result = computeReorder(
      cardsRef.current,
      columns,
      String(active.id),
      String(over.id)
    );
    if (!result) return;
    if ("wipBlockedColumn" in result) {
      flashWipBlocked(result.wipBlockedColumn);
      return;
    }

    setCards(result.nextCards);
    onCardMove?.(String(active.id), result.destColumn, result.position);
  };

  const handleDragCancel = () => setActiveCardId(null);

  useEffect(() => {
    return () => {
      if (wipTimerRef.current) clearTimeout(wipTimerRef.current);
    };
  }, []);

  // Screen-reader announcements for keyboard / assistive-tech dragging.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up card ${active.id}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Card ${active.id} is over ${String(over.id).replace(
            COLUMN_DROP_PREFIX,
            "column "
          )}.`
        : `Card ${active.id} is no longer over a drop target.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Card ${active.id} was dropped.`
        : `Card ${active.id} was dropped back to its position.`,
    onDragCancel: ({ active }) => `Dragging card ${active.id} was cancelled.`,
  };

  // Handle filter change
  const handleFilterChange = (field: string, value: string | null) => {
    const newFilters = {
      ...filters,
      [field]: value || null,
    };

    // If value is empty, remove the filter
    if (!value) {
      delete newFilters[field];
    }

    setFilters(newFilters);
    onFilterChange?.(newFilters); // Notify parent component if callback exists
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  useEffect(() => {
    let result = [...cards];

    if (searchTerm) {
      result = result.filter((card) =>
        card.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply all active filters dynamically
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter((card) => {
          // Handle special case for tags which is an array
          if (field === "tags" && Array.isArray(card.tags)) {
            return card.tags.includes(value);
          }
          // Standard field comparison
          return card[field] === value;
        });
      }
    });

    setFilteredCards(result);
  }, [searchTerm, filters, cards]);

  if (isLoading) {
    return (
      <div className="kanban-board-container">
        {loadingComponent || <LoadingSpinner />}
      </div>
    );
  }

  return (
    <div className="kanban-board-container" ref={boardRef}>
      {(enableSearch || (enableFiltering && filterConfigs.length > 0)) && (
        <div className="kanban-search">
          {enableSearch && (
            <>
              {renderSearchInput ? (
                renderSearchInput(searchTerm, setSearchTerm)
              ) : (
                <div className="search-input-wrapper">
                  <SearchIcon />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search cards..."
                    aria-label="Search cards"
                  />
                  {searchTerm && (
                    <button
                      className="clear-search"
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </>
          )}

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
                        aria-label={`Filter by ${config.label}`}
                      >
                        <option value="">All {config.label}s</option>
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
                className="clear-filters"
                onClick={clearAllFilters}
                disabled={Object.keys(filters).length === 0}
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="kanban-board">
          {columns.map((column) => (
            <ColumnComponent
              key={column.key}
              title={column.title}
              column={column.key}
              cards={cards}
              filteredCards={filteredCards.filter(
                (card) => card.status === column.key
              )}
              setCards={setCards}
              color={column.color}
              limit={column.limit}
              onCardEdit={onCardEdit}
              onCardDelete={onCardDelete}
              renderCard={renderCard}
              renderAvatar={renderAvatar}
              renderAddCard={renderAddCard}
              onTaskAddedCallback={onTaskAddedCallback}
              columnForAddCard={columnForAddCard}
              emptyColumnMessage={emptyColumnMessage}
              deleteConfirmation={deleteConfirmation}
              undoDuration={undoDuration}
              isColumnLoading={column.isLoading}
              emptyMessage={column.emptyMessage}
              renderColumnLoading={renderColumnLoading}
              columnData={column}
              isWipBlocked={wipBlockedColumn === column.key}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="card-drag-overlay">
              {renderCard ? (
                renderCard(activeCard, undefined, undefined, undefined)
              ) : (
                <DefaultCard
                  {...activeCard}
                  renderAvatar={renderAvatar}
                  isExpanded={false}
                  isOverlay
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

// Props for the explicit controlled variant: `cards` and `onCardsChange` are
// required, and the uncontrolled-only `initialCards` is not accepted.
export type ControlledKanbanBoardProps = Omit<
  KanbanBoardProps,
  "initialCards" | "cards" | "onCardsChange"
> & {
  cards: Card[];
  onCardsChange: (cards: Card[]) => void;
};

// Explicit controlled board for consumers wiring state to a backend. This is a
// thin wrapper over KanbanBoard that makes the controlled contract type-safe.
export const ControlledKanbanBoard = (props: ControlledKanbanBoardProps) => {
  return <KanbanBoard {...props} />;
};

const ColumnComponent: React.FC<ColumnProps> = ({
  title,
  column,
  cards,
  filteredCards,
  setCards,
  columnForAddCard,
  color,
  limit,
  onCardEdit,
  onCardDelete,
  renderCard,
  renderAvatar,
  renderAddCard,
  onTaskAddedCallback,
  emptyColumnMessage,
  deleteConfirmation,
  undoDuration,
  isColumnLoading,
  emptyMessage,
  renderColumnLoading,
  columnData,
  isWipBlocked,
}) => {
  // Column-level droppable so empty columns and gaps still accept drops.
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${COLUMN_DROP_PREFIX}${column}`,
  });
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<{
    [key: string]: boolean;
  }>({});
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

  const isLimitExceeded = limit !== undefined && filteredCards.length > limit;

  const columnStyle = {
    backgroundColor: color,
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Immediately remove a card and notify the consumer.
  const commitDelete = (cardId: string) => {
    if (onCardDelete) onCardDelete(cardId);
    setCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
  };

  // Flush an in-flight "undo" deletion (commit it now).
  const flushPendingDelete = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setPendingDelete((pending) => {
      if (pending && onCardDelete) onCardDelete(pending.card.id);
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
      const card = cards.find((card) => card.id === cardId);
      if (!card || index === -1) return;

      // Remove from view immediately, but defer onCardDelete.
      setCards((prevCards) => prevCards.filter((c) => c.id !== cardId));
      setPendingDelete({ card, index });

      undoTimerRef.current = setTimeout(() => {
        undoTimerRef.current = null;
        if (onCardDelete) onCardDelete(card.id);
        setPendingDelete(null);
      }, undoDuration);
      return;
    }

    // "immediate" (default) — backwards compatible behavior.
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

  // Confirm ("confirm" mode) — actually delete the card.
  const handleConfirmDelete = (cardId: string) => {
    setConfirmingDeleteId(null);
    commitDelete(cardId);
  };

  // Clear any pending timer on unmount to avoid updates after unmount.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleEditClick = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setNewTitle(currentTitle);
  };

  const handleSaveEdit = (cardId: string) => {
    if (newTitle.trim() === "") return;

    if (onCardEdit) onCardEdit(cardId, newTitle);
    setCards((prevCards) =>
      prevCards.map((card) =>
        card.id === cardId ? { ...card, title: newTitle } : card
      )
    );
    setEditingCardId(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent, cardId: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(cardId);
    } else if (e.key === "Escape") {
      setEditingCardId(null);
    }
  };

  return (
    <div
      className={`kanban-column ${isOver ? "active" : ""} ${
        isLimitExceeded ? "limit-exceeded" : ""
      }`}
      data-testid={`column-${column}`}
    >
      <div className="column-title" style={columnStyle}>
        <div className="column-title-text">{title}</div>
        <div className="column-counter-container">
          <span className={`counter ${isLimitExceeded ? "exceeded" : ""}`}>
            {filteredCards.length}
            {limit !== undefined && `/${limit}`}
          </span>
        </div>
      </div>
      <div
        ref={setDroppableRef}
        className={`column-content ${isOver ? "active" : ""}`}
      >
        {isColumnLoading ? (
          <div data-testid={`column-loading-${column}`}>
            {renderColumnLoading ? (
              renderColumnLoading(columnData)
            ) : (
              <ColumnLoadingState />
            )}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="column-empty-state">
            {emptyMessage ?? emptyColumnMessage}
          </div>
        ) : (
          <SortableContext
            items={filteredCards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredCards.map((card) => (
              <div className="card-slot" key={card.id}>
                {editingCardId === card.id ? (
                  <div className="card-edit" data-card-id={card.id}>
                    <input
                      autoFocus
                      type="text"
                      value={newTitle}
                      onChange={handleEditChange}
                      onBlur={() => handleSaveEdit(card.id)}
                      onKeyDown={(e) => handleKeyDown(e, card.id)}
                      aria-label="Edit card title"
                    />
                  </div>
                ) : (
                  <SortableCard id={card.id} title={card.title}>
                    {(isDragging) =>
                      renderCard ? (
                        renderCard(
                          card,
                          isDragging,
                          expandedCards[card.id],
                          toggleExpand
                        )
                      ) : (
                        <DefaultCard
                          {...card}
                          renderAvatar={renderAvatar}
                          isExpanded={expandedCards[card.id]}
                          isDragging={isDragging}
                          toggleExpand={() => toggleExpand(card.id)}
                          onDelete={() => handleDeleteCard(card.id)}
                          onEdit={() => handleEditClick(card.id, card.title)}
                        />
                      )
                    }
                  </SortableCard>
                )}
                {confirmingDeleteId === card.id && (
                  <div
                    className="delete-confirm"
                    role="alertdialog"
                    aria-label="Confirm delete"
                    data-testid={`delete-confirm-${card.id}`}
                  >
                    <span className="delete-confirm-text">
                      Delete this card?
                    </span>
                    <div className="delete-confirm-actions">
                      <button
                        type="button"
                        className="delete-confirm-cancel"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="delete-confirm-delete"
                        onClick={() => handleConfirmDelete(card.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        )}
        {isWipBlocked && (
          <div
            className="wip-limit-notification show"
            role="status"
            data-testid={`wip-blocked-${column}`}
          >
            WIP limit ({limit}) reached!
          </div>
        )}
        {pendingDelete && (
          <div
            className="undo-toast"
            role="status"
            aria-live="polite"
            data-testid={`undo-toast-${column}`}
          >
            <span className="undo-toast-text">Card deleted</span>
            <button
              type="button"
              className="undo-toast-button"
              onClick={handleUndoDelete}
            >
              Undo
            </button>
          </div>
        )}
        <div className="add-card-container">
          {columnForAddCard === column ? (
            renderAddCard ? (
              renderAddCard(column, setCards)
            ) : (
              <DefaultAddCard
                column={column}
                setCards={setCards}
                onTaskAddedCallback={onTaskAddedCallback}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Sortable wrapper: makes its child card draggable via pointer, touch and
// keyboard (Space to pick up, arrows to move, Space/Enter to drop, Esc to
// cancel). The whole card is the drag handle; small movements are ignored so
// clicks on inner buttons still work.
const SortableCard = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card-id={id}
      className="sortable-card-wrapper"
      {...attributes}
      {...listeners}
      aria-label={title}
    >
      {children(isDragging)}
    </div>
  );
};

// Enhanced default card with better styling and icon positioning
const DefaultCard = ({
  title,
  avatarPath,
  id,
  priority,
  dueDate,
  tags,
  description,
  renderAvatar,
  isExpanded,
  toggleExpand,
  onDelete,
  onEdit,
  isDragging,
  isOverlay,
}: DefaultCardProps) => {
  const hasDetails =
    priority || dueDate || description || (tags && tags.length > 0);

  // Priority color mapping
  const priorityColors = {
    High: "#F87171",
    Medium: "#FBBF24",
    Low: "#34D399",
  };

  // Get border color based on priority
  const borderColor = priority ? priorityColors[priority] : undefined;

  return (
    <div
      className={`card ${isExpanded ? "expanded" : ""} ${
        isDragging ? "dragging" : ""
      } ${isOverlay ? "overlay" : ""}`}
      style={{
        borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
      }}
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
          {onEdit && (
            <button
              className="card-action-button edit"
              onClick={() => onEdit(id)}
              aria-label="Edit card"
              type="button"
            >
              <EditIcon />
            </button>
          )}
          {onDelete && (
            <button
              className="card-action-button delete"
              onClick={() => onDelete(id)}
              aria-label="Delete card"
              type="button"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      </div>

      {priority && (
        <div className="priority-badge-container">
          <span className={`priority-badge ${priority.toLowerCase()}`}>
            {priority}
          </span>
        </div>
      )}

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="card-details"
        >
          {description && (
            <div className="card-description">
              <p>{description}</p>
            </div>
          )}

          {dueDate && (
            <div className="card-detail">
              <span className="detail-label">Due:</span>
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
        </motion.div>
      )}

      <div className="card-footer">
        {renderAvatar
          ? renderAvatar(avatarPath)
          : avatarPath && <DefaultAvatar avatarPath={avatarPath} />}

        {hasDetails && toggleExpand && (
          <button
            onClick={() => toggleExpand(id)}
            className="expand-toggle"
            aria-label={isExpanded ? "Collapse card" : "Expand card"}
            type="button"
          >
            <CollapseExpandIcon isExpanded={isExpanded} />
          </button>
        )}
      </div>
    </div>
  );
};

const DefaultAvatar = ({ avatarPath }: { avatarPath?: string }) => {
  if (!avatarPath) return null;
  return (
    <div className="avatar-container">
      <img src={avatarPath} alt="" className="avatar" loading="lazy" />
    </div>
  );
};

const DefaultAddCard = ({
  column,
  setCards,
  onTaskAddedCallback,
}: AddCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Handle form submission for new card
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      const newCard: Card = {
        id: `card-${Date.now()}`,
        title: newTitle,
        status: column,
      };
      setCards((prev) => [...prev, newCard]);
      setNewTitle("");
      setIsAdding(false);
      onTaskAddedCallback?.(newTitle);
    }
  };

  // Improved rendering to ensure proper overflow handling
  return isAdding ? (
    <div className="add-card-motion-container">
      <motion.form
        onSubmit={handleSubmit}
        className="add-card-form"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="add-card-input-container">
          <input
            type="text"
            className="add-card-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter card title..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsAdding(false);
              }
            }}
            aria-label="New card title"
            maxLength={200} // Prevent extremely long titles
          />
        </div>
        <div className="add-card-buttons">
          <button type="submit" disabled={!newTitle.trim()}>
            Add Card
          </button>
          <button type="button" onClick={() => setIsAdding(false)}>
            Cancel
          </button>
        </div>
      </motion.form>
    </div>
  ) : (
    <motion.div
      className="add-card"
      onClick={() => setIsAdding(true)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      role="button"
      tabIndex={0}
      aria-label="Add new card"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsAdding(true);
        }
      }}
    >
      <span>+</span> Add Card
    </motion.div>
  );
};

export default KanbanBoard;
