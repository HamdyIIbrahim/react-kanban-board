import { Page } from "@playwright/test";

/**
 * Dispatch a real HTML5 drag sequence with a shared DataTransfer at a
 * controlled clientY so the component's getNearestIndicator picks a
 * deterministic slot. Drops the card identified by `cardId` into `columnKey`,
 * immediately before the card whose id is `beforeId` ("-1" = end of column).
 *
 * Native drag-and-drop can't be reliably simulated with synthetic mouse events
 * in headless Chromium, so we drive the drag events directly. This exercises the
 * component's real handleDragStart / handleDragEnd / getNearestIndicator code.
 */
export async function drag(
  page: Page,
  cardId: string,
  columnKey: string,
  beforeId: string
): Promise<void> {
  await page.evaluate(
    ({ cardId, columnKey, beforeId }) => {
      const source = document.querySelector(`[data-card-id="${cardId}"] .card`);
      const column = document.querySelector(
        `[data-testid="column-${columnKey}"]`
      );
      if (!source || !column) throw new Error("drag: source/column not found");

      let clientX: number;
      let clientY: number;
      if (beforeId === "-1") {
        const cr = column.getBoundingClientRect();
        clientX = cr.left + cr.width / 2;
        clientY = cr.bottom + 200; // below everything -> move to back
      } else {
        const ind = document.querySelector(
          `[data-column="${columnKey}"][data-before="${beforeId}"]`
        );
        if (!ind) throw new Error(`drag: indicator not found for ${beforeId}`);
        const ir = ind.getBoundingClientRect();
        clientX = ir.left + ir.width / 2;
        clientY = ir.top + 49; // selects this indicator (DISTANCE_OFFSET = 50)
      }

      const dt = new DataTransfer();
      const fire = (type: string, el: Element, extra: object = {}) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            ...extra,
          })
        );

      fire("dragstart", source);
      fire("dragover", column, { clientX, clientY });
      fire("drop", column, { clientX, clientY });
      fire("dragend", source);
    },
    { cardId, columnKey, beforeId }
  );
}

/** Ordered list of card ids currently rendered in a column. */
export function columnOrder(page: Page, columnKey: string): Promise<string[]> {
  return page.$$eval(
    `[data-testid="column-${columnKey}"] [data-card-id]`,
    (els) => els.map((e) => e.getAttribute("data-card-id") as string)
  );
}

export interface ConsoleCapture {
  moves: any[];
  deletes: string[];
  changes: string[];
}

/**
 * Capture the demo's console output. The demo logs onCardMove as an object and
 * onCardDelete / onCardsChange as strings.
 */
export function captureConsole(page: Page): ConsoleCapture {
  const cap: ConsoleCapture = { moves: [], deletes: [], changes: [] };
  page.on("console", async (msg) => {
    const text = msg.text();
    if (text.startsWith("onCardMove:")) {
      try {
        cap.moves.push(await msg.args()[1].jsonValue());
      } catch {
        cap.moves.push(text);
      }
    } else if (text.startsWith("onCardDelete:")) {
      cap.deletes.push(text.replace("onCardDelete:", "").trim());
    } else if (text.startsWith("onCardsChange:")) {
      cap.changes.push(text.replace("onCardsChange:", "").trim());
    }
  });
  return cap;
}
