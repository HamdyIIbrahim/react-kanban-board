import type {
  CSSProperties,
  Dispatch,
  DragEvent,
  ReactNode,
  SetStateAction,
} from "react";
import type { KanbanLabels } from "./labels";

// The fields the board itself understands. Extend it (or `Card`) with your own
// fields and pass the type to the board for end-to-end type safety:
// `<KanbanBoard<MyCard> ... />`.
export interface BaseCard {
  id: string;
  title: string;
  // Key of the column the card is in.
  status: string;
  avatarPath?: string;
  // "Low" | "Medium" | "High" are styled out of the box; any other value can be
  // labelled and coloured through the board's `priorities` prop.
  priority?: string;
  // ISO date (e.g. "2026-11-30"). Overdue / due-soon cards are highlighted.
  dueDate?: string;
  tags?: string[];
  description?: string;
  assignee?: string;
}

// Default, loosely-typed card (the v2 `Card`): the built-in fields plus any
// extra fields. Its `priority` keeps the v2 union type; for custom priority
// values, extend BaseCard instead.
export interface Card extends BaseCard {
  priority?: "Low" | "Medium" | "High";
  [key: string]: any;
}

export interface Column {
  title: string;
  key: string;
  // Header background colour.
  color: string;
  limit?: number; // Optional WIP limit
  isLoading?: boolean; // Optional per-column loading state (e.g. lazy-loaded data)
  emptyMessage?: string; // Optional per-column empty message (overrides emptyColumnMessage)
  // Show the "Add card" control in this column.
  allowAddCard?: boolean;
  // Initial collapsed state (requires enableColumnCollapse).
  collapsed?: boolean;
  // Marks a "done" column: due dates are not highlighted as overdue here.
  isDone?: boolean;
  // More cards can be fetched for this column; shows a load-more trigger that
  // calls onLoadMore when scrolled into view.
  hasMore?: boolean;
  // A load-more request for this column is in flight.
  isLoadingMore?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  field: string;
  label: string;
  options: FilterOption[];
}

// Describes a custom card field beyond the built-in ones. Schema fields are
// rendered in the card's details (and editable in the details panel) and can
// be validated with `validateCard`.
export interface CardFieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "tags";
  options?: FilterOption[]; // for type: "select"
  required?: boolean;
}

// A priority level: value stored on the card, optional display label and
// accent colour (any CSS colour).
export interface PriorityDef {
  value: string;
  label?: string;
  color?: string;
}

// How a card deletion is guarded before onCardDelete is fired.
// - "immediate": fire onCardDelete right away (default)
// - "confirm":   show an inline confirmation prompt first
// - "undo":      remove the card immediately but defer onCardDelete, showing a
//                brief undo toast that can restore the card
export type DeleteConfirmation = "immediate" | "confirm" | "undo";

// Where a card landed within its destination column, exposed through
// onCardMove so consumers can persist ordering on a backend.
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

// Actions available to a custom card renderer (5th argument of renderCard).
export interface CardActions {
  // True for the card being dragged (and for the drag overlay copy).
  isDragging: boolean;
  edit: () => void;
  delete: () => void;
  // Opens the card details panel (when enableCardDetails is on).
  openDetails: () => void;
  isSelected: boolean;
}

// v2 drag-start handler passed to custom card renderers. Dragging is now
// handled by the wrapper around every card (mouse, touch and keyboard), so this
// is a no-op kept for backward compatibility: v2 cards that call it, or set
// `draggable`, keep working.
export type LegacyDragStartHandler<TCard extends BaseCard = Card> = (
  e: DragEvent<HTMLDivElement>,
  card: TCard
) => void;

// Signature for custom card renderers (the v2 signature plus a 5th `actions`
// argument carrying `isDragging`, `edit`, `delete`, `openDetails`, `isSelected`).
export type RenderCard<TCard extends BaseCard = Card> = (
  card: TCard,
  handleDragStart: LegacyDragStartHandler<TCard>,
  isExpanded: boolean | undefined,
  toggleExpand: (id: string) => void,
  actions: CardActions
) => ReactNode;

// State passed to a custom column header renderer.
export interface ColumnHeaderInfo {
  count: number;
  limit?: number;
  isLimitExceeded: boolean;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

// Helpers passed to a custom card details renderer.
export interface CardDetailsHelpers<TCard extends BaseCard = Card> {
  close: () => void;
  update: (patch: Partial<TCard>) => void;
  remove: () => void;
}

export interface KanbanBoardProps<TCard extends BaseCard = Card> {
  columns: Column[];
  // Uncontrolled mode: the board owns card state, seeded once from initialCards.
  initialCards?: TCard[];
  // Controlled mode: when provided, the board renders these cards directly and
  // never mutates internal state. Pair with onCardsChange to receive updates.
  cards?: TCard[];
  // Called with the full next card list on every internal mutation (move, edit,
  // delete, add). Required for controlled mode; also fires in uncontrolled mode.
  onCardsChange?: (cards: TCard[]) => void;
  // Applied to the board root — use it to scope a theme (e.g. "kb-dark") or set
  // --kb-* CSS variables via `style`.
  className?: string;
  style?: CSSProperties;
  // Inject the default stylesheet automatically on the client (default true).
  // Skipped when "react-custom-kanban-board/styles.css" is already loaded; set
  // false for strict CSPs and import the stylesheet yourself.
  injectStyles?: boolean;
  // CSP nonce for the injected <style> tag.
  styleNonce?: string;
  // Text direction. "rtl" mirrors the layout for Arabic, Hebrew, Persian, etc.
  dir?: "ltr" | "rtl";
  // Override any built-in UI string (for translation / custom wording).
  labels?: Partial<KanbanLabels>;
  // Deprecated: prefer `allowAddCard` on each column. Key of the single column
  // that shows the "Add card" control.
  columnForAddCard?: string;
  // Called after a card is created from the built-in "Add card" control.
  onCardAdd?: (card: TCard, columnKey: string) => void;
  // Deprecated: use onCardAdd. Called with the new card's title.
  onTaskAddedCallback?: (title: string) => void;
  // Generates ids for cards created by the board. Defaults to a random UUID.
  createCardId?: () => string;
  // Called when a card is moved to another column.
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => void;
  // Called when a card is reordered within its column (same arguments as
  // onCardMove; `newStatus` is the unchanged column key).
  onCardReorder?: (
    cardId: string,
    status: string,
    position: DropPosition
  ) => void;
  // Called when a card's title is edited inline (or in the details panel).
  onCardEdit?: (cardId: string, newTitle: string) => void;
  // Called with the changed fields whenever a card is edited (inline title edit
  // or the details panel).
  onCardUpdate?: (cardId: string, patch: Partial<TCard>) => void;
  onCardDelete?: (cardId: string) => void;
  renderCard?: RenderCard<TCard>;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: Dispatch<SetStateAction<TCard[]>>
  ) => ReactNode;
  // Custom column header (replaces the built-in title / counter row).
  renderColumnHeader?: (column: Column, info: ColumnHeaderInfo) => ReactNode;
  // Priority levels (value, label, colour). Defaults to Low / Medium / High.
  priorities?: PriorityDef[];
  // Highlight overdue and due-soon cards. Default true.
  highlightDueDates?: boolean;
  // A card counts as "due soon" within this many days. Default 2.
  dueSoonDays?: number;
  // Open a details panel (double-click a card, or its open button) to view and
  // edit every field. Off by default.
  enableCardDetails?: boolean;
  // Replace the built-in details panel body.
  renderCardDetails?: (
    card: TCard,
    helpers: CardDetailsHelpers<TCard>
  ) => ReactNode;
  // Extra content under the built-in details form (comments, checklists...).
  renderCardDetailsExtra?: (card: TCard) => ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyColumnMessage?: string;
  // Custom per-column loading UI, shown when a column has isLoading set.
  renderColumnLoading?: (column: Column) => ReactNode;
  // Called when a column with `hasMore` scrolls its load-more trigger into view.
  onLoadMore?: (columnKey: string) => void;
  // How to guard card deletion before onCardDelete fires. Defaults to "immediate".
  deleteConfirmation?: DeleteConfirmation;
  // How long the undo toast stays before the delete is committed (ms). Default 5000.
  undoDuration?: number;
  // Optional typed schema for custom card fields; rendered in card details.
  cardFields?: CardFieldDef[];
  // Group cards into horizontal swimlanes by a card field (e.g. "assignee").
  swimlaneBy?: Extract<keyof TCard, string>;
  // Optional explicit swimlanes (value + label + order). Derived from card
  // values when omitted.
  swimlanes?: { value: string; label: string }[];
  // Enable drag-to-reorder of columns (via a grip in each column header).
  // Off by default.
  enableColumnReorder?: boolean;
  // Called with the new ordered column keys after a column is reordered.
  onColumnsReorder?: (orderedKeys: string[]) => void;
  // Let users collapse columns to a narrow strip. Off by default.
  enableColumnCollapse?: boolean;
  // Called when a column is collapsed or expanded.
  onColumnCollapseChange?: (columnKey: string, collapsed: boolean) => void;
  // Let users add, rename and delete columns. Off by default.
  enableColumnManagement?: boolean;
  // Called with the full next column list whenever columns are added, renamed,
  // deleted or reordered.
  onColumnsChange?: (columns: Column[]) => void;
  onColumnAdd?: (column: Column) => void;
  onColumnRename?: (columnKey: string, title: string) => void;
  // Called when a column is deleted, with the ids of the cards removed with it.
  onColumnDelete?: (columnKey: string, removedCardIds: string[]) => void;
  // Enable multi-select (Cmd/Ctrl-click to toggle, Shift-click for a range)
  // with a bulk action bar. Off by default.
  enableMultiSelect?: boolean;
  // Called when selected cards are moved to a column in bulk.
  onBulkMove?: (cardIds: string[], newStatus: string) => void;
  // Called when selected cards are deleted in bulk.
  onBulkDelete?: (cardIds: string[]) => void;
  // Virtualize (window) a column's card list once it exceeds this many cards.
  // Off by default. Keeps very large columns (hundreds of cards) performant.
  virtualizeColumnsOver?: number;
  // Estimated card height in px, used by the virtualizer. Default 120.
  virtualItemEstimatedHeight?: number;
  enableSearch?: boolean;
  // Card fields the search box matches against. Default ["title"].
  searchFields?: string[];
  enableFiltering?: boolean;
  filterConfigs?: FilterConfig[];
  onFilterChange?: (filters: Record<string, string | null>) => void;
  renderSearchInput?: (
    searchTerm: string,
    setSearchTerm: Dispatch<SetStateAction<string>>
  ) => ReactNode;
  renderFilterMenu?: (
    config: FilterConfig,
    value: string | null,
    handleFilterChange: (field: string, value: string | null) => void
  ) => ReactNode;
}
