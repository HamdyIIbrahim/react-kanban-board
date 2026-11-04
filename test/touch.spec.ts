import { test, expect } from "@playwright/test";
import { touchDrag, columnOrder, captureConsole } from "./helpers";

// Touch drag needs a touch-enabled context.
test.use({ hasTouch: true, viewport: { width: 900, height: 900 } });

test.describe("touch drag-and-drop (mobile)", () => {
  test("press-and-hold then drag reorders within a column", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    await touchDrag(page, "2", "todo", "1"); // card 2 -> above card 1

    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.moves[cap.moves.length - 1]).toEqual({
      cardId: "2",
      newStatus: "todo",
      prevTaskId: null,
      nextTaskId: "1",
      index: 0,
    });
  });

  test("touch drag moves a card across columns", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="3"]');

    await touchDrag(page, "4", "in-progress", "3"); // review card -> above card 3

    await expect
      .poll(() => columnOrder(page, "in-progress"))
      .toEqual(["4", "3"]);
    expect(cap.moves[cap.moves.length - 1].newStatus).toBe("in-progress");
  });
});
