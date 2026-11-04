import { useCallback, useRef, useState } from "react";
import type { BaseCard, Card, DropPosition } from "./types";

/**
 * Async backend hooks. Each returns a promise; if it rejects, the board rolls
 * back to the state before the mutation and `onError` is called.
 */
export interface PersistenceAdapter<TCard extends BaseCard = Card> {
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => Promise<void>;
  // Same-column reorders. Defaults to onCardMove when omitted.
  onCardReorder?: (
    cardId: string,
    status: string,
    position: DropPosition
  ) => Promise<void>;
  onCardEdit?: (cardId: string, newTitle: string) => Promise<void>;
  onCardUpdate?: (cardId: string, patch: Partial<TCard>) => Promise<void>;
  onCardAdd?: (card: TCard, columnKey: string) => Promise<void>;
  onCardDelete?: (cardId: string) => Promise<void>;
  onError?: (error: unknown) => void;
}

export interface PersistentBoard<TCard extends BaseCard = Card> {
  /** Current cards — pass to a controlled board's `cards`. */
  cards: TCard[];
  /** True while a backend call is in flight. */
  isSyncing: boolean;
  onCardsChange: (next: TCard[]) => void;
  onCardMove: (cardId: string, newStatus: string, position: DropPosition) => void;
  onCardReorder: (cardId: string, status: string, position: DropPosition) => void;
  onCardEdit: (cardId: string, newTitle: string) => void;
  onCardUpdate: (cardId: string, patch: Partial<TCard>) => void;
  onCardAdd: (card: TCard, columnKey: string) => void;
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
 *   onCardReorder={board.onCardReorder}
 *   onCardDelete={board.onCardDelete}
 *   onCardEdit={board.onCardEdit}
 *   columns={columns}
 * />
 * ```
 */
export function usePersistentBoard<TCard extends BaseCard = Card>(
  initialCards: TCard[],
  adapter: PersistenceAdapter<TCard>
): PersistentBoard<TCard> {
  const [cards, setCards] = useState<TCard[]>(initialCards);
  const [isSyncing, setIsSyncing] = useState(false);

  const cardsRef = useRef<TCard[]>(cards);
  cardsRef.current = cards;
  // Snapshot of the state before the in-flight mutation, used for rollback.
  const snapshotRef = useRef<TCard[]>(initialCards);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const pending = useRef(0);

  const onCardsChange = useCallback((next: TCard[]) => {
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
  const onCardReorder = useCallback(
    (cardId: string, status: string, position: DropPosition) => {
      const fn = adapterRef.current.onCardReorder ?? adapterRef.current.onCardMove;
      runPersist(fn ? () => fn(cardId, status, position) : undefined);
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
  const onCardUpdate = useCallback(
    (cardId: string, patch: Partial<TCard>) => {
      const fn = adapterRef.current.onCardUpdate;
      runPersist(fn ? () => fn(cardId, patch) : undefined);
    },
    [runPersist]
  );
  const onCardAdd = useCallback(
    (card: TCard, columnKey: string) => {
      const fn = adapterRef.current.onCardAdd;
      runPersist(fn ? () => fn(card, columnKey) : undefined);
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
    onCardReorder,
    onCardEdit,
    onCardUpdate,
    onCardAdd,
    onCardDelete,
  };
}
