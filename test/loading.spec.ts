import { test, expect } from "@playwright/test";

test.describe("per-column loading and empty states", () => {
  test("loading column shows default skeleton, others unaffected", async ({
    page,
  }) => {
    await page.goto("/?loadingCols=review");
    await page.waitForSelector('[data-testid="column-review"]');

    await expect(
      page.locator('[data-testid="column-loading-review"]')
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="column-loading-review"] .column-skeleton-card')
    ).toHaveCount(3);
    // The loading column's real card is hidden.
    await expect(page.locator('[data-card-id="4"]')).toHaveCount(0);
    // Other columns are unaffected.
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(1);
    await expect(
      page.locator('[data-testid="column-loading-todo"]')
    ).toHaveCount(0);
  });

  test("custom renderColumnLoading replaces the default skeleton", async ({
    page,
  }) => {
    await page.goto("/?loadingCols=review&customLoading=1");
    await page.waitForSelector('[data-testid="column-review"]');

    await expect(
      page.locator('[data-testid="custom-loading-review"]')
    ).toHaveCount(1);
    await expect(page.locator(".column-skeleton-card")).toHaveCount(0);
  });

  test("per-column emptyMessage overrides the board default", async ({
    page,
  }) => {
    await page.goto("/?emptyCols=done");
    await page.waitForSelector('[data-testid="column-done"]');

    await expect(
      page.locator('[data-testid="column-done"] .column-empty-state')
    ).toContainText("Nothing shipped yet");
    await expect(page.locator('[data-card-id="5"]')).toHaveCount(0);
  });
});
