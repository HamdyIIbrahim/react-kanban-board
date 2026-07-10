import { useCallback, useRef, useState } from "react";
import type { DropPosition } from "./index";

export interface ActivityEntry {
  id: string;
  type: "move" | "edit" | "delete";
  cardId: string;
  timestamp: number;
  detail: string;
  actor?: string;
}

export interface ActivityLog {
  entries: ActivityEntry[];
  clear: () => void;
  /** Append a custom entry. */
  record: (type: ActivityEntry["type"], cardId: string, detail: string) => void;
  /** Spread these onto the board to record card activity automatically. */
  onCardMove: (cardId: string, newStatus: string, position: DropPosition) => void;
  onCardEdit: (cardId: string, newTitle: string) => void;
  onCardDelete: (cardId: string) => void;
}

/**
 * Builds a lightweight per-card audit trail from the board's callbacks.
 *
 * ```tsx
 * const log = useActivityLog({ actor: "you" });
 * <KanbanBoard
 *   onCardMove={log.onCardMove}
 *   onCardEdit={log.onCardEdit}
 *   onCardDelete={log.onCardDelete}
 *   columns={columns} initialCards={cards} columnForAddCard="todo"
 * />
 * {log.entries.map((e) => <li key={e.id}>{e.detail}</li>)}
 * ```
 */
export function useActivityLog(options?: {
  actor?: string;
  limit?: number;
}): ActivityLog {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const seq = useRef(0);
  const optsRef = useRef(options);
  optsRef.current = options;

  const record = useCallback(
    (type: ActivityEntry["type"], cardId: string, detail: string) => {
      const opts = optsRef.current;
      const entry: ActivityEntry = {
        id: `${Date.now()}-${seq.current++}`,
        type,
        cardId,
        timestamp: Date.now(),
        detail,
        actor: opts?.actor,
      };
      setEntries((prev) => [entry, ...prev].slice(0, opts?.limit ?? 100));
    },
    []
  );

  const onCardMove = useCallback(
    (cardId: string, newStatus: string) =>
      record("move", cardId, `moved to ${newStatus}`),
    [record]
  );
  const onCardEdit = useCallback(
    (cardId: string, newTitle: string) =>
      record("edit", cardId, `renamed to “${newTitle}”`),
    [record]
  );
  const onCardDelete = useCallback(
    (cardId: string) => record("delete", cardId, "deleted"),
    [record]
  );
  const clear = useCallback(() => setEntries([]), []);

  return { entries, clear, record, onCardMove, onCardEdit, onCardDelete };
}
