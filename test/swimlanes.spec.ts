import { test, expect, Page } from "@playwright/test";

// Tall viewport so multiple lanes are on-screen for cross-lane dragging.
test.use({ viewport: { width: 1500, height: 1700 } });

const cellCards = (page: Page, lane: string, col: string) =>
  page.$$eval(
    `[data-testid="swimlane-${lane}"] [data-testid="column-${col}"] [data-card-id]`,
    (els) => els.map((e) => e.getAttribute("data-card-id"))
  );

async function dragOnto(page: Page, srcId: string, dstId: string) {
  await page.locator(`[data-card-id="${srcId}"]`).scrollIntoViewIfNeeded();
  const s = (await page.locator(`[data-card-id="${srcId}"]`).boundingBox())!;
  const t = (await page.locator(`[data-card-id="${dstId}"]`).boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 - 6, { steps: 3 });
  await page.mouse.move(t.x + t.width / 2, t.y + 8, { steps: 20 });
  await page.mouse.move(t.x + t.width / 2, t.y + 8, { steps: 4 });
  await page.mouse.up();
}

test.describe("swimlanes (group rows by a field)", () => {
  test("groups cards into lanes by the swimlaneBy field", async ({ page }) => {
    await page.goto("/?swimlane=assignee&mode=uncontrolled");
    await page.waitForSelector('[data-testid="swimlane-john"]');

    const lanes = await page.$$eval(".swimlane", (els) =>
      els.map((e) => e.getAttribute("data-testid"))
    );
    expect(lanes).toEqual([
      "swimlane-john",
      "swimlane-sara",
      "swimlane-mike",
    ]);
    expect(await cellCards(page, "john", "todo")).toEqual(["1"]);
    expect(await cellCards(page, "sara", "todo")).toEqual(["2"]);
  });

  test("dragging a card to another lane changes its group field", async ({
    page,
  }) => {
    await page.goto("/?swimlane=assignee&mode=uncontrolled");
    await page.waitForSelector('[data-testid="swimlane-john"]');

    // Drag card 1 (john/todo) onto card 2 (sara/todo).
    await dragOnto(page, "1", "2");

    // Card 1 now lives in sara's lane (assignee became "sara").
    await expect
      .poll(() => cellCards(page, "sara", "todo"))
      .toContain("1");
    expect(await cellCards(page, "john", "todo")).toEqual([]);
  });
});
