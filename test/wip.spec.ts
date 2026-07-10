import { test, expect } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

test.describe("WIP limits", () => {
  test("blocks a cross-column drop that would exceed the limit", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    // in-progress limit forced to 1; it already holds card 3.
    await page.goto("/?mode=uncontrolled&wip=1");
    await page.waitForSelector('[data-card-id="3"]');

    await drag(page, "4", "in-progress", "3"); // try to add a 2nd card

    // Move is rejected: card 4 stays in review, no onCardMove fires,
    // and the WIP notification shows.
    await expect(
      page.locator('[data-testid="wip-blocked-in-progress"]')
    ).toBeVisible();
    expect(await columnOrder(page, "in-progress")).toEqual(["3"]);
    expect(await columnOrder(page, "review")).toContain("4");
    expect(cap.moves).toEqual([]);
  });

  test("allows a same-column reorder even at the limit", async ({ page }) => {
    const cap = captureConsole(page);
    // todo has cards 1 and 2; reordering within a full column is always allowed.
    await page.goto("/?mode=uncontrolled&wip=1");
    await page.waitForSelector('[data-card-id="1"]');

    await drag(page, "2", "todo", "1");

    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.moves.length).toBeGreaterThanOrEqual(1);
  });
});
