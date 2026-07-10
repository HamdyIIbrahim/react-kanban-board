import { test, expect, Page } from "@playwright/test";
import { captureConsole } from "./helpers";

const columnKeys = (page: Page) =>
  page.$$eval(".kanban-column", (els) =>
    els.map((e) => (e.getAttribute("data-testid") || "").replace("column-", ""))
  );

// Drag column `fromKey`'s grip onto column `toKey`.
async function dragColumn(page: Page, fromKey: string, toKey: string) {
  await page
    .locator(`[data-testid="column-grip-${fromKey}"]`)
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  const grip = (await page
    .locator(`[data-testid="column-grip-${fromKey}"]`)
    .boundingBox())!;
  const target = (await page
    .locator(`[data-testid="column-${toKey}"]`)
    .boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 - 10, grip.y + grip.height / 2, {
    steps: 3,
  });
  await page.mouse.move(target.x + 40, target.y + 20, { steps: 18 });
  await page.mouse.move(target.x + 20, target.y + 20, { steps: 4 });
  await page.mouse.up();
}

test.describe("column reordering (opt-in)", () => {
  test("no grips when disabled", async ({ page }) => {
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-testid="column-todo"]');
    await expect(
      page.locator('[data-testid^="column-grip-"]')
    ).toHaveCount(0);
  });

  test("drag a column grip reorders columns and fires onColumnsReorder", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?columnReorder=1");
    await page.waitForSelector('[data-testid="column-grip-todo"]');
    expect(await columnKeys(page)).toEqual([
      "todo",
      "in-progress",
      "review",
      "done",
    ]);

    await dragColumn(page, "review", "todo"); // move review to the front

    await expect
      .poll(() => columnKeys(page))
      .toEqual(["review", "todo", "in-progress", "done"]);
    expect(cap.columns[cap.columns.length - 1]).toBe(
      "review,todo,in-progress,done"
    );
  });
});
