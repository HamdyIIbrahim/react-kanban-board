import { test, expect } from "@playwright/test";
import { drag } from "./helpers";

test.describe("activity log (useActivityLog)", () => {
  test("records a move as an audit entry", async ({ page }) => {
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');
    // No activity yet.
    await expect(page.locator('[data-testid="activity-log"]')).toHaveCount(0);

    await drag(page, "2", "done", "-1"); // move card 2 to Done

    const entry = page.locator('[data-testid="activity-entry"]').first();
    await expect(entry).toContainText("2");
    await expect(entry).toContainText("moved to done");
    await expect(entry).toContainText("by you");
  });

  test("delete is recorded and clear empties the log", async ({ page }) => {
    await page.goto("/?mode=uncontrolled&delete=immediate");
    await page.waitForSelector('[data-card-id="1"]');

    await page.locator('[data-card-id="1"] .card-action-button.delete').click();

    await expect(
      page.locator('[data-testid="activity-entry"]').first()
    ).toContainText("deleted");

    await page.locator('[data-testid="activity-clear"]').click();
    await expect(page.locator('[data-testid="activity-log"]')).toHaveCount(0);
  });
});
