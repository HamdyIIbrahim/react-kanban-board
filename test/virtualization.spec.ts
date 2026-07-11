import { test, expect } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

test.describe("column virtualization (opt-in)", () => {
  test("windows a large column: only visible cards are in the DOM", async ({
    page,
  }) => {
    // 300 bulk cards in To Do, virtualize columns over 30.
    await page.goto("/?bulk=300&virtualize=30");
    await page.waitForSelector('[data-card-id="1"]');

    const rendered = await page
      .locator('[data-testid="column-todo"] [data-card-id]')
      .count();
    // Far fewer than the ~302 total cards (visible window + overscan).
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(40);
  });

  test("does not virtualize a column under the threshold", async ({ page }) => {
    // Only 2 cards in To Do, threshold 30 -> normal rendering.
    await page.goto("/?virtualize=30");
    await page.waitForSelector('[data-card-id="1"]');
    await expect(
      page.locator('[data-testid="column-todo"] .column-content.virtualized')
    ).toHaveCount(0);
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);
  });

  test("drag still reorders visible cards in a virtualized column", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?bulk=300&virtualize=30");
    await page.waitForSelector('[data-card-id="1"]');

    await drag(page, "2", "todo", "1"); // both visible at the top

    await expect
      .poll(async () => (await columnOrder(page, "todo")).slice(0, 2))
      .toEqual(["2", "1"]);
    expect(cap.moves[cap.moves.length - 1]).toEqual({
      cardId: "2",
      newStatus: "todo",
      prevTaskId: null,
      nextTaskId: "1",
      index: 0,
    });
  });
});
