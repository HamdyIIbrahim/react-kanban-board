import { Page } from "@playwright/test";

/**
 * Drag a card with a real pointer (mouse) sequence that activates dnd-kit's
 * PointerSensor. Drops the card `cardId` into `columnKey`, immediately before
 * the card `beforeId` ("-1" = end of the column).
 *
 * Drives the actual component: dnd-kit sensors + our board-level onDragEnd /
 * computeReorder path. Pointer dragging works with the same code that powers
 * touch and keyboard, so this exercises the real drag engine.
 */
export async function drag(
  page: Page,
  cardId: string,
  columnKey: string,
  beforeId: string
): Promise<void> {
  // Mouse dragging needs the card physically in the viewport.
  await page
    .locator(`[data-card-id="${cardId}"]`)
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  const src = await page.locator(`[data-card-id="${cardId}"]`).boundingBox();
  if (!src) throw new Error(`drag: source card ${cardId} not found`);

  const { x: targetX, y: targetY } = await dropPoint(page, columnKey, beforeId);
  const startX = src.x + src.width / 2;
  const startY = src.y + src.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Small nudge to cross the sensor activation distance, then move to target.
  await page.mouse.move(startX, startY - 6, { steps: 3 });
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.mouse.move(targetX, targetY, { steps: 3 });
  await page.mouse.up();
}

// Screen point to drop over: the upper area of `beforeId`, or just below the
// last card ("-1" = end of column).
async function dropPoint(
  page: Page,
  columnKey: string,
  beforeId: string
): Promise<{ x: number; y: number }> {
  if (beforeId === "-1") {
    const cards = page.locator(
      `[data-testid="column-${columnKey}"] [data-card-id]`
    );
    const count = await cards.count();
    if (count > 0) {
      const last = (await cards.nth(count - 1).boundingBox())!;
      return { x: last.x + last.width / 2, y: last.y + last.height + 20 };
    }
    const col = (await page
      .locator(`[data-testid="column-${columnKey}"] .column-content`)
      .boundingBox())!;
    return { x: col.x + col.width / 2, y: col.y + col.height / 2 };
  }
  const before = (await page
    .locator(`[data-card-id="${beforeId}"]`)
    .boundingBox())!;
  return { x: before.x + before.width / 2, y: before.y + 10 };
}

/**
 * Keyboard-driven drag: focus the card, Space to pick up, arrow keys to move,
 * Space to drop (or Escape to cancel). Exercises dnd-kit's KeyboardSensor —
 * the accessibility path.
 */
export async function keyboardDrag(
  page: Page,
  cardId: string,
  moves: Array<"Up" | "Down" | "Left" | "Right">,
  finish: "drop" | "cancel" = "drop"
): Promise<void> {
  await page.locator(`[data-card-id="${cardId}"]`).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(120);
  for (const m of moves) {
    await page.keyboard.press(`Arrow${m}`);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press(finish === "drop" ? "Space" : "Escape");
  await page.waitForTimeout(200);
}

/**
 * Touch-driven drag using synthetic touch events with the press-and-hold delay
 * that dnd-kit's TouchSensor requires. Requires a touch-enabled context
 * (test.use({ hasTouch: true })).
 */
export async function touchDrag(
  page: Page,
  cardId: string,
  columnKey: string,
  beforeId: string
): Promise<void> {
  const src = (await page.locator(`[data-card-id="${cardId}"]`).boundingBox())!;
  const target = await dropPoint(page, columnKey, beforeId);
  const sx = src.x + src.width / 2;
  const sy = src.y + src.height / 2;

  const dispatch = (type: string, x: number, y: number) =>
    page.evaluate(
      ({ cardId, type, x, y }) => {
        const el = document.querySelector(`[data-card-id="${cardId}"]`)!;
        const t = new Touch({
          identifier: 1,
          target: el,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
        });
        const touches = type === "touchend" ? [] : [t];
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: [t],
          })
        );
      },
      { cardId, type, x, y }
    );

  await dispatch("touchstart", sx, sy);
  await page.waitForTimeout(280); // press-and-hold to activate
  for (let i = 1; i <= 8; i++) {
    await dispatch("touchmove", sx + (target.x - sx) * (i / 8), sy + (target.y - sy) * (i / 8));
    await page.waitForTimeout(30);
  }
  await dispatch("touchmove", target.x, target.y);
  await dispatch("touchend", target.x, target.y);
  await page.waitForTimeout(300);
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
