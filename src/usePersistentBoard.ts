import { useCallback, useRef, useState } from "react";
import type { Card, DropPosition } from "./index";

/**
 * Async backend hooks. Each returns a promise; if it rejects, the board rolls
 * back to the state before the mutation and `onError` is called.
 */
export interface PersistenceAdapter {
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => Promise<void>;
  onCardEdit?: (cardId: string, newTitle: string) => Promise<void>;
  onCardDelete?: (cardId: string) => Promise<void>;
  onError?: (error: unknown) => void;
}

export interface PersistentBoard {
  /** Current cards — pass to a controlled board's `cards`. */
  cards: Card[];
  /** True while a backend call is in flight. */
  isSyncing: boolean;
  onCardsChange: (next: Card[]) => void;
  onCardMove: (cardId: string, newStatus: string, position: DropPosition) => void;
  onCardEdit: (cardId: string, newTitle: string) => void;
  onCardDelete: (cardId: string) => void;
}

/**
 * Wires a controlled board to a backend with optimistic updates and automatic
 * rollback on failure.
 *
 * ```tsx
 * const board = usePersistentBoard(initialCards, {
 *   onCardMove: (id, status, pos) => api.move(id, status, pos),
 *   onError: () => toast("Couldn't save — reverted"),
 * });
 * <ControlledKanbanBoard
 *   cards={board.cards}
 *   onCardsChange={board.onCardsChange}
 *   onCardMove={board.onCardMove}
 *   onCardDelete={board.onCardDelete}
 *   onCardEdit={board.onCardEdit}
 *   columns={columns} columnForAddCard="todo"
 * />
 * ```
 */
export function usePersistentBoard(
  initialCards: Card[],
  adapter: PersistenceAdapter
): PersistentBoard {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [isSyncing, setIsSyncing] = useState(false);

  const cardsRef = useRef<Card[]>(cards);
  cardsRef.current = cards;
  // Snapshot of the state before the in-flight mutation, used for rollback.
  const snapshotRef = useRef<Card[]>(initialCards);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const pending = useRef(0);

  const onCardsChange = useCallback((next: Card[]) => {
    // Capture the pre-mutation state, then apply optimistically.
    snapshotRef.current = cardsRef.current;
    setCards(next);
  }, []);

  const runPersist = useCallback(
    async (fn?: () => Promise<void> | void) => {
      if (!fn) return;
      const snapshot = snapshotRef.current;
      pending.current += 1;
      setIsSyncing(true);
      try {
        await fn();
      } catch (error) {
        setCards(snapshot); // rollback
        adapterRef.current.onError?.(error);
      } finally {
        pending.current -= 1;
        if (pending.current === 0) setIsSyncing(false);
      }
    },
    []
  );

  const onCardMove = useCallback(
    (cardId: string, newStatus: string, position: DropPosition) => {
      const fn = adapterRef.current.onCardMove;
      runPersist(fn ? () => fn(cardId, newStatus, position) : undefined);
    },
    [runPersist]
  );
  const onCardEdit = useCallback(
    (cardId: string, newTitle: string) => {
      const fn = adapterRef.current.onCardEdit;
      runPersist(fn ? () => fn(cardId, newTitle) : undefined);
    },
    [runPersist]
  );
  const onCardDelete = useCallback(
    (cardId: string) => {
      const fn = adapterRef.current.onCardDelete;
      runPersist(fn ? () => fn(cardId) : undefined);
    },
    [runPersist]
  );

  return {
    cards,
    isSyncing,
    onCardsChange,
    onCardMove,
    onCardEdit,
    onCardDelete,
  };
}
