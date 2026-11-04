/**
 * Realtime collaboration primitives. Because the board supports a fully
 * controlled mode (`cards` + `onCardsChange`), wiring it to a websocket or a
 * Convex-style live query is just: broadcast local changes, and set `cards`
 * from remote state. `diffCards` turns two card lists into a minimal patch you
 * can send over the wire (instead of the whole board).
 */
import type { BaseCard, Card } from "./types";

export type CardChange<TCard extends BaseCard = Card> =
  | { type: "add"; card: TCard }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; from: string; to: string }
  | { type: "update"; id: string; card: TCard };

/**
 * Compute the minimal set of changes between two card lists. Useful for
 * broadcasting patches to collaborators and for reacting to remote updates.
 */
export function diffCards<TCard extends BaseCard = Card>(
  prev: TCard[],
  next: TCard[]
): CardChange<TCard>[] {
  const prevById: Record<string, TCard> = {};
  for (const c of prev) prevById[c.id] = c;
  const nextIds: Record<string, true> = {};
  for (const c of next) nextIds[c.id] = true;

  const changes: CardChange<TCard>[] = [];
  for (const c of next) {
    const p = prevById[c.id];
    if (!p) {
      changes.push({ type: "add", card: c });
    } else if (p.status !== c.status) {
      changes.push({ type: "move", id: c.id, from: p.status, to: c.status });
      // Moved *and* edited: also send the edit so it isn't lost.
      if (JSON.stringify({ ...p, status: c.status }) !== JSON.stringify(c)) {
        changes.push({ type: "update", id: c.id, card: c });
      }
    } else if (JSON.stringify(p) !== JSON.stringify(c)) {
      changes.push({ type: "update", id: c.id, card: c });
    }
  }
  for (const c of prev) {
    if (!nextIds[c.id]) changes.push({ type: "remove", id: c.id });
  }
  return changes;
}

/**
 * Apply changes produced by `diffCards` (e.g. received from another client)
 * to a card list. Unknown ids are ignored; adds of an existing id replace it.
 * `applyCardChanges(prev, diffCards(prev, next))` reproduces `next`'s content.
 */
export function applyCardChanges<TCard extends BaseCard = Card>(
  cards: TCard[],
  changes: CardChange<TCard>[]
): TCard[] {
  let next = cards.slice();
  for (const change of changes) {
    if (change.type === "add") {
      const i = next.findIndex((c) => c.id === change.card.id);
      if (i === -1) next.push(change.card);
      else next[i] = change.card;
    } else if (change.type === "remove") {
      next = next.filter((c) => c.id !== change.id);
    } else if (change.type === "move") {
      next = next.map((c) => (c.id === change.id ? { ...c, status: change.to } : c));
    } else {
      next = next.map((c) => (c.id === change.id ? change.card : c));
    }
  }
  return next;
}
