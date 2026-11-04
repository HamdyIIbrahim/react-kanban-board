import { test, expect, Page } from "@playwright/test";
import { columnOrder } from "./helpers";

function captureBulk(page: Page) {
  const bulk: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("onBulkMove:") || t.startsWith("onBulkDelete:")) bulk.push(t);
  });
  return bulk;
}

const ctrlClick = (page: Page, id: string) =>
  page.locator(`[data-card-id="${id}"]`).click({ modifiers: ["ControlOrMeta"] });

test.describe("bulk actions (multi-select)", () => {
  test("Ctrl-click selects; bulk move relocates all selected", async ({
    page,
  }) => {
    const bulk = captureBulk(page);
    await page.goto("/?multiSelect=1&mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');

    await ctrlClick(page, "1");
    await ctrlClick(page, "2");
    await expect(page.locator('[data-testid="bulk-count"]')).toHaveText(
      "2 selected"
    );

    await page.locator('[data-testid="bulk-move-review"]').click();

    await expect.poll(() => columnOrder(page, "todo")).toEqual([]);
    await expect
      .poll(() => columnOrder(page, "review"))
      .toEqual(["4", "1", "2"]);
    expect(bulk[bulk.length - 1]).toBe("onBulkMove: 1,2->review");
    // Bar clears after the action.
    await expect(page.locator('[data-testid="bulk-bar"]')).toHaveCount(0);
  });

  test("bulk delete removes all selected", async ({ page }) => {
    const bulk = captureBulk(page);
    await page.goto("/?multiSelect=1&mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');

    await ctrlClick(page, "1");
    await ctrlClick(page, "2");
    await page.locator('[data-testid="bulk-delete"]').click();

    await expect(page.locator('[data-card-id="1"]')).toHaveCount(0);
    await expect(page.locator('[data-card-id="2"]')).toHaveCount(0);
    expect(bulk[bulk.length - 1]).toBe("onBulkDelete: 1,2");
  });

  test("no bulk bar when multi-select is disabled", async ({ page }) => {
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');
    await ctrlClick(page, "1");
    await expect(page.locator('[data-testid="bulk-bar"]')).toHaveCount(0);
  });
});
