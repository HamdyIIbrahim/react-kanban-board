/**
 * Realtime collaboration primitives. Because the board supports a fully
 * controlled mode (`cards` + `onCardsChange`), wiring it to a websocket or a
 * Convex-style live query is just: broadcast local changes, and set `cards`
 * from remote state. `diffCards` turns two card lists into a minimal patch you
 * can send over the wire (instead of the whole board).
 */
import type { Card } from "./index";

export type CardChange =
  | { type: "add"; card: Card }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; from: string; to: string }
  | { type: "update"; id: string; card: Card };

/**
 * Compute the minimal set of changes between two card lists. Useful for
 * broadcasting patches to collaborators and for reacting to remote updates.
 */
export function diffCards(prev: Card[], next: Card[]): CardChange[] {
  const prevById: Record<string, Card> = {};
  for (const c of prev) prevById[c.id] = c;
  const nextIds: Record<string, true> = {};
  for (const c of next) nextIds[c.id] = true;

  const changes: CardChange[] = [];
  for (const c of next) {
    const p = prevById[c.id];
    if (!p) {
      changes.push({ type: "add", card: c });
    } else if (p.status !== c.status) {
      changes.push({ type: "move", id: c.id, from: p.status, to: c.status });
    } else if (JSON.stringify(p) !== JSON.stringify(c)) {
      changes.push({ type: "update", id: c.id, card: c });
    }
  }
  for (const c of prev) {
    if (!nextIds[c.id]) changes.push({ type: "remove", id: c.id });
  }
  return changes;
}
