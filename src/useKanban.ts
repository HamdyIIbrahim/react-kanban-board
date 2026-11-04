import { useCallback, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BaseCard, Card, Column, DropPosition } from "./types";
import { moveCard as moveCardPure, randomId } from "./core";

export interface UseKanbanOptions<TCard extends BaseCard = Card> {
  columns: Column[];
  // Uncontrolled: seeds card state, and re-seeds it whenever its *content*
  // changes (e.g. data that arrives asynchronously). A re-render that passes an
  // equal array does not reset the user's drag ordering.
  initialCards?: TCard[];
  // Controlled: render these cards; pair with onCardsChange.
  cards?: TCard[];
  onCardsChange?: (cards: TCard[]) => void;
  // Called with the next column list after any column change.
  onColumnsChange?: (columns: Column[]) => void;
  // Id generator for cards / columns created through the API.
  createCardId?: () => string;
  // Keep the user's column order when the `columns` prop changes (used with
  // column drag-to-reorder). Default false: the prop order wins.
  preserveColumnOrder?: boolean;
}

export type MoveResult =
  | { ok: true; position: DropPosition }
  | { ok: false; reason: "not-found" | "wip-limit" | "no-op" };

export interface KanbanController<TCard extends BaseCard = Card> {
  cards: TCard[];
  setCards: Dispatch<SetStateAction<TCard[]>>;
  columns: Column[];
  setColumns: (update: SetStateAction<Column[]>) => void;
  // Cards in a column, in display order.
  getColumnCards: (columnKey: string) => TCard[];
  addCard: (
    columnKey: string,
    data: Partial<TCard> & { title: string }
  ) => TCard;
  updateCard: (cardId: string, patch: Partial<TCard>) => void;
  deleteCard: (cardId: string) => void;
  // Move a card to a column / index (end by default). Respects WIP limits.
  moveCard: (cardId: string, toColumn: string, toIndex?: number) => MoveResult;
  addColumn: (column: Partial<Column> & { title: string }) => Column;
  renameColumn: (columnKey: string, title: string) => void;
  // Removes the column and its cards; returns the removed card ids.
  deleteColumn: (columnKey: string) => string[];
  // Move column `fromKey` to the position of `toKey`.
  moveColumn: (fromKey: string, toKey: string) => void;
}

const COLUMN_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

// Column list from props, reordered to follow `prevOrder` (new keys appended).
const reconcileColumns = (
  prev: Column[],
  next: Column[],
  preserveOrder: boolean
): Column[] => {
  if (!preserveOrder) return next;
  const byKey = new Map(next.map((c) => [c.key, c]));
  const kept = prev.filter((c) => byKey.has(c.key)).map((c) => byKey.get(c.key)!);
  const added = next.filter((c) => !prev.some((p) => p.key === c.key));
  return [...kept, ...added];
};

const EMPTY: never[] = [];

// Content signature used to tell "new data" from "same data, new array".
// Unserialisable values fall back to identity semantics (always "changed").
const signature = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Math.random());
  }
};

/**
 * Headless Kanban state: cards (controlled or uncontrolled), columns, and the
 * operations the board performs — without any UI. Use it to build a fully
 * custom board, or to drive the built-in one programmatically.
 *
 * ```tsx
 * const kanban = useKanban({ columns, initialCards });
 * kanban.moveCard("42", "done");
 * kanban.getColumnCards("todo").map(...)
 * ```
 */
export function useKanban<TCard extends BaseCard = Card>(
  options: UseKanbanOptions<TCard>
): KanbanController<TCard> {
  const {
    columns: columnsProp,
    initialCards = EMPTY as TCard[],
    cards: controlledCards,
    onCardsChange,
    onColumnsChange,
    createCardId,
    preserveColumnOrder = false,
  } = options;

  // ---- Cards ----
  const isControlled = controlledCards !== undefined;
  const [internalCards, setInternalCards] = useState<TCard[]>(initialCards);

  // Re-seed from initialCards when its content changes (v2 behaviour for async
  // data), without resetting on a re-render that passes an equal array.
  const initRef = useRef(initialCards);
  const initSigRef = useRef<string | null>(null);
  let currentInternal = internalCards;
  if (!isControlled && initialCards !== initRef.current) {
    if (initSigRef.current === null) initSigRef.current = signature(initRef.current);
    initRef.current = initialCards;
    const nextSig = signature(initialCards);
    if (nextSig !== initSigRef.current) {
      initSigRef.current = nextSig;
      currentInternal = initialCards;
      setInternalCards(initialCards);
    }
  }
  const cards = isControlled ? (controlledCards as TCard[]) : currentInternal;

  // Refs keep the stable callbacks below reading the latest values.
  const cardsRef = useRef<TCard[]>(cards);
  cardsRef.current = cards;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onCardsChangeRef = useRef(onCardsChange);
  onCardsChangeRef.current = onCardsChange;
  const createIdRef = useRef(createCardId);
  createIdRef.current = createCardId;

  // Accepts a value or updater, updates internal state (uncontrolled only) and
  // always notifies via onCardsChange so controlled consumers can persist.
  const setCards = useCallback<Dispatch<SetStateAction<TCard[]>>>((update) => {
    const base = cardsRef.current;
    const next =
      typeof update === "function"
        ? (update as (prev: TCard[]) => TCard[])(base)
        : update;
    cardsRef.current = next;
    if (!isControlledRef.current) setInternalCards(next);
    onCardsChangeRef.current?.(next);
  }, []);

  // ---- Columns ----
  // Local copy of the columns so add / rename / delete / reorder work without
  // the parent wiring state. Re-synced whenever the prop's *content* changes
  // (an inline array literal re-created each render does not reset it).
  const sig = signature(columnsProp);
  const [columnState, setColumnState] = useState(() => ({
    sig,
    list: columnsProp,
  }));
  let columns = columnState.list;
  if (columnState.sig !== sig) {
    columns = reconcileColumns(columnState.list, columnsProp, preserveColumnOrder);
    setColumnState({ sig, list: columns });
  }
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const sigRef = useRef(sig);
  sigRef.current = sig;
  const onColumnsChangeRef = useRef(onColumnsChange);
  onColumnsChangeRef.current = onColumnsChange;

  const setColumns = useCallback((update: SetStateAction<Column[]>) => {
    const next =
      typeof update === "function"
        ? (update as (prev: Column[]) => Column[])(columnsRef.current)
        : update;
    if (next === columnsRef.current) return;
    columnsRef.current = next;
    setColumnState({ sig: sigRef.current, list: next });
    onColumnsChangeRef.current?.(next);
  }, []);

  // ---- Operations ----
  const getColumnCards = useCallback(
    (columnKey: string) => cardsRef.current.filter((c) => c.status === columnKey),
    []
  );

  const addCard = useCallback(
    (columnKey: string, data: Partial<TCard> & { title: string }) => {
      const card = {
        ...data,
        id: data.id ?? createIdRef.current?.() ?? randomId("card"),
        status: columnKey,
      } as TCard;
      setCards((prev) => [...prev, card]);
      return card;
    },
    [setCards]
  );

  const updateCard = useCallback(
    (cardId: string, patch: Partial<TCard>) => {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? ({ ...c, ...patch, id: c.id } as TCard) : c))
      );
    },
    [setCards]
  );

  const deleteCard = useCallback(
    (cardId: string) => setCards((prev) => prev.filter((c) => c.id !== cardId)),
    [setCards]
  );

  const moveCard = useCallback(
    (cardId: string, toColumn: string, toIndex?: number): MoveResult => {
      const result = moveCardPure(
        cardsRef.current,
        cardId,
        toColumn,
        toIndex,
        columnsRef.current
      );
      if (!result) return { ok: false, reason: "not-found" };
      if ("wipBlockedColumn" in result) return { ok: false, reason: "wip-limit" };
      setCards(result.nextCards);
      return { ok: true, position: result.position };
    },
    [setCards]
  );

  const addColumn = useCallback(
    (column: Partial<Column> & { title: string }) => {
      const taken = new Set(columnsRef.current.map((c) => c.key));
      const created: Column = {
        ...column,
        key: column.key && !taken.has(column.key) ? column.key : randomId("col"),
        color:
          column.color ??
          COLUMN_COLORS[columnsRef.current.length % COLUMN_COLORS.length],
      };
      setColumns((prev) => [...prev, created]);
      return created;
    },
    [setColumns]
  );

  const renameColumn = useCallback(
    (columnKey: string, title: string) =>
      setColumns((prev) =>
        prev.map((c) => (c.key === columnKey ? { ...c, title } : c))
      ),
    [setColumns]
  );

  const deleteColumn = useCallback(
    (columnKey: string) => {
      const removed = cardsRef.current
        .filter((c) => c.status === columnKey)
        .map((c) => c.id);
      if (removed.length) {
        setCards((prev) => prev.filter((c) => c.status !== columnKey));
      }
      setColumns((prev) => prev.filter((c) => c.key !== columnKey));
      return removed;
    },
    [setCards, setColumns]
  );

  const moveColumn = useCallback(
    (fromKey: string, toKey: string) =>
      setColumns((prev) => {
        const from = prev.findIndex((c) => c.key === fromKey);
        const to = prev.findIndex((c) => c.key === toKey);
        if (from === -1 || to === -1 || from === to) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
    [setColumns]
  );

  return useMemo(
    () => ({
      cards,
      setCards,
      columns,
      setColumns,
      getColumnCards,
      addCard,
      updateCard,
      deleteCard,
      moveCard,
      addColumn,
      renameColumn,
      deleteColumn,
      moveColumn,
    }),
    [
      cards,
      setCards,
      columns,
      setColumns,
      getColumnCards,
      addCard,
      updateCard,
      deleteCard,
      moveCard,
      addColumn,
      renameColumn,
      deleteColumn,
      moveColumn,
    ]
  );
}
