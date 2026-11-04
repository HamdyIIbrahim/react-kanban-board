// Framework-free board logic: ordering, moving, filtering and due dates.
// Everything here is pure and safe to import from server code.
import type { BaseCard, Column, DropPosition } from "./types";

// Prefix used to identify a column's droppable area (vs. a card droppable).
export const COLUMN_DROP_PREFIX = "column:";
// Prefix used for a column's sortable (drag-to-reorder) id.
export const COLUMN_SORT_PREFIX = "col:";
// Separator between the lane value and the column key in a swimlane droppable.
export const LANE_SEP = "::";

export type ReorderResult<T> =
  | { nextCards: T[]; destColumn: string; position: DropPosition }
  | { wipBlockedColumn: string }
  | null;

export const laneOf = (card: BaseCard, swimlaneBy: string): string => {
  const v = (card as any)[swimlaneBy];
  return v === undefined || v === null || v === "" ? "" : String(v);
};

const wipBlocked = <T extends BaseCard>(
  cards: T[],
  columns: Column[],
  activeId: string,
  destColumn: string
): boolean => {
  const limit = columns.find((col) => col.key === destColumn)?.limit;
  if (limit === undefined) return false;
  const count = cards.filter(
    (c) => c.status === destColumn && c.id !== activeId
  ).length;
  return count >= limit;
};

// Insert `card` into `rest` before `beforeId` ("-1" = append), then report the
// drop position among the cards matching `inCell`.
const insertAndLocate = <T extends BaseCard>(
  rest: T[],
  card: T,
  beforeId: string,
  inCell: (c: T) => boolean
): { nextCards: T[]; position: DropPosition } => {
  if (beforeId === "-1") {
    // Append after the last card of the destination cell so the flat order
    // stays grouped (falls back to the very end).
    let lastIdx = -1;
    rest.forEach((c, i) => {
      if (inCell(c)) lastIdx = i;
    });
    if (lastIdx === -1) rest.push(card);
    else rest.splice(lastIdx + 1, 0, card);
  } else {
    const idx = rest.findIndex((c) => c.id === beforeId);
    if (idx === -1) rest.push(card);
    else rest.splice(idx, 0, card);
  }
  const cell = rest.filter(inCell);
  const index = cell.findIndex((c) => c.id === card.id);
  return {
    nextCards: rest,
    position: {
      prevTaskId: cell[index - 1]?.id ?? null,
      nextTaskId: cell[index + 1]?.id ?? null,
      index,
    },
  };
};

// Pure reorder computation shared by pointer, touch and keyboard dragging.
// Translates a dnd-kit (activeId, overId) into the next flat card list plus the
// drop position within the destination column. `overId` may be a card id or a
// `column:<key>` droppable id. Returns `wipBlockedColumn` instead of a result
// when the move would exceed a destination column's WIP limit.
export function computeReorder<T extends BaseCard>(
  cards: T[],
  columns: Column[],
  activeId: string,
  overId: string
): ReorderResult<T> {
  const activeCard = cards.find((c) => c.id === activeId);
  if (!activeCard) return null;

  const destColumn = overId.startsWith(COLUMN_DROP_PREFIX)
    ? overId.slice(COLUMN_DROP_PREFIX.length)
    : cards.find((c) => c.id === overId)?.status;
  if (destColumn === undefined) return null;

  const sourceColumn = activeCard.status;
  const isSameColumn = sourceColumn === destColumn;

  if (!isSameColumn && wipBlocked(cards, columns, activeId, destColumn)) {
    return { wipBlockedColumn: destColumn };
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
  const sourceList = cards.filter((c) => c.status === sourceColumn);
  const currentBefore =
    sourceList[sourceList.findIndex((c) => c.id === activeId) + 1]?.id ?? "-1";
  if (isSameColumn && (beforeId === activeId || beforeId === currentBefore)) {
    return null;
  }

  const rest = cards.filter((c) => c.id !== activeId);
  const updated = isSameColumn
    ? activeCard
    : ({ ...activeCard, status: destColumn } as T);
  const { nextCards, position } = insertAndLocate(
    rest,
    updated,
    beforeId,
    (c) => c.status === destColumn
  );
  return { nextCards, destColumn, position };
}

// Reorder computation for swimlane mode. Drop targets encode lane + column, so
// a move can change both the card's status and its swimlane field.
export function computeSwimlaneReorder<T extends BaseCard>(
  cards: T[],
  columns: Column[],
  activeId: string,
  overId: string,
  swimlaneBy: string
): ReorderResult<T> {
  const activeCard = cards.find((c) => c.id === activeId);
  if (!activeCard) return null;

  let destColumn: string;
  let destLane: string;
  if (overId.startsWith(COLUMN_DROP_PREFIX)) {
    const rest = overId.slice(COLUMN_DROP_PREFIX.length);
    const idx = rest.indexOf(LANE_SEP);
    if (idx === -1) return null;
    destLane = rest.slice(0, idx);
    destColumn = rest.slice(idx + LANE_SEP.length);
  } else {
    const overCard = cards.find((c) => c.id === overId);
    if (!overCard) return null;
    destColumn = overCard.status;
    destLane = laneOf(overCard, swimlaneBy);
  }

  const isSameCell =
    activeCard.status === destColumn &&
    laneOf(activeCard, swimlaneBy) === destLane;

  // WIP limit is enforced per column (across lanes).
  if (
    activeCard.status !== destColumn &&
    wipBlocked(cards, columns, activeId, destColumn)
  ) {
    return { wipBlockedColumn: destColumn };
  }

  const inCell = (c: T) =>
    c.status === destColumn && laneOf(c, swimlaneBy) === destLane;

  let beforeId: string;
  if (overId.startsWith(COLUMN_DROP_PREFIX)) {
    beforeId = "-1";
  } else {
    const listNoActive = cards
      .filter((c) => inCell(c) && c.id !== activeId)
      .map((c) => c.id);
    const fullList = cards.filter(inCell).map((c) => c.id);
    const activeIdx = fullList.indexOf(activeId);
    const overIdx = fullList.indexOf(overId);
    const overPos = listNoActive.indexOf(overId);
    const insertPos =
      isSameCell && activeIdx !== -1 && activeIdx < overIdx
        ? overPos + 1
        : overPos;
    beforeId = listNoActive[insertPos] ?? "-1";
  }

  const rest = cards.filter((c) => c.id !== activeId);
  const updated: T = isSameCell
    ? activeCard
    : ({ ...activeCard, status: destColumn, [swimlaneBy]: destLane } as T);
  const { nextCards, position } = insertAndLocate(
    rest,
    updated,
    beforeId,
    inCell
  );
  return { nextCards, destColumn, position };
}

/**
 * Move a card to `toColumn` at `toIndex` (default: the end), without any UI.
 * Respects WIP limits when `columns` is given. Useful for headless boards,
 * keyboard shortcuts, or applying a move received from a server.
 */
export function moveCard<T extends BaseCard>(
  cards: T[],
  cardId: string,
  toColumn: string,
  toIndex?: number,
  columns: Column[] = []
): ReorderResult<T> {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;
  if (
    card.status !== toColumn &&
    wipBlocked(cards, columns, cardId, toColumn)
  ) {
    return { wipBlockedColumn: toColumn };
  }
  const destNoActive = cards.filter(
    (c) => c.status === toColumn && c.id !== cardId
  );
  const beforeId =
    toIndex === undefined || toIndex >= destNoActive.length
      ? "-1"
      : destNoActive[Math.max(0, toIndex)].id;
  const rest = cards.filter((c) => c.id !== cardId);
  const updated =
    card.status === toColumn ? card : ({ ...card, status: toColumn } as T);
  const { nextCards, position } = insertAndLocate(
    rest,
    updated,
    beforeId,
    (c) => c.status === toColumn
  );
  return { nextCards, destColumn: toColumn, position };
}

/**
 * Filter cards by a free-text search over `searchFields` (default: title) and
 * exact-match field filters (array fields such as `tags` match by inclusion).
 */
export function filterCards<T extends BaseCard>(
  cards: T[],
  searchTerm: string,
  filters: Record<string, string | null>,
  searchFields: string[] = ["title"]
): T[] {
  const term = searchTerm.toLowerCase();
  const active = Object.entries(filters).filter(([, v]) => !!v);
  if (!term && !active.length) return cards;
  return cards.filter((card) => {
    if (term) {
      const hit = searchFields.some((field) => {
        const v = (card as any)[field];
        if (v === undefined || v === null) return false;
        return (Array.isArray(v) ? v.join("\n") : String(v))
          .toLowerCase()
          .includes(term);
      });
      if (!hit) return false;
    }
    return active.every(([field, value]) => {
      const v = (card as any)[field];
      return Array.isArray(v) ? v.includes(value) : v === value;
    });
  });
}

export type DueStatus = "overdue" | "today" | "soon" | null;

// Parse "YYYY-MM-DD" as a local calendar date (Date() would treat it as UTC).
const parseDue = (due: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(due);
  return isNaN(d.getTime()) ? null : d;
};

/** Classify a due date relative to `now`: overdue, due today, due soon, or not. */
export function getDueStatus(
  dueDate: string | undefined,
  soonDays = 2,
  now: Date = new Date()
): DueStatus {
  if (!dueDate) return null;
  const due = parseDue(dueDate);
  if (!due) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round(
    (dueDay.getTime() - startOfToday.getTime()) / 86400000
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= soonDays) return "soon";
  return null;
}

// Stable CSS-safe slug ("High" -> "high", "P0 Urgent" -> "p0-urgent").
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Random id for new cards / columns (crypto.randomUUID when available).
export const randomId = (prefix: string): string => {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};
