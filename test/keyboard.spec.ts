import { test, expect } from "@playwright/test";
import { keyboardDrag, columnOrder, captureConsole } from "./helpers";

test.describe("keyboard drag-and-drop (accessibility)", () => {
  test("Space + ArrowUp + Space reorders within a column", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    // Pick up card 2, move up past card 1, drop.
    await keyboardDrag(page, "2", ["Up"]);

    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.moves[cap.moves.length - 1]).toEqual({
      cardId: "2",
      newStatus: "todo",
      prevTaskId: null,
      nextTaskId: "1",
      index: 0,
    });
  });

  test("ArrowRight moves a card into the next column", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');

    // Pick up card 1 (todo), move right into in-progress, drop.
    await keyboardDrag(page, "1", ["Right"]);

    await expect
      .poll(() => columnOrder(page, "in-progress"))
      .toContain("1");
    expect(await columnOrder(page, "todo")).not.toContain("1");
    expect(cap.moves[cap.moves.length - 1].newStatus).toBe("in-progress");
  });

  test("Escape cancels a keyboard drag with no change", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="2"]');

    await keyboardDrag(page, "2", ["Up"], "cancel");

    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);
    expect(cap.moves).toEqual([]);
  });

  test("cards are focusable and expose a draggable role", async ({ page }) => {
    await page.goto("/?mode=uncontrolled");
    const card = page.locator('[data-card-id="1"]');
    await expect(card).toHaveAttribute("aria-roledescription", /sortable/i);
    await card.focus();
    await expect(card).toBeFocused();
  });
});
