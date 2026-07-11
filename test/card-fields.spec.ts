import { test, expect } from "@playwright/test";

test.describe("custom card field schema", () => {
  test("schema fields render in the card's expanded details", async ({
    page,
  }) => {
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');

    // Expand card 1 (which has storyPoints + epic in the demo schema).
    await page
      .locator('[data-card-id="1"] .expand-toggle')
      .click();

    const sp = page.locator('[data-card-id="1"] [data-field="storyPoints"]');
    await expect(sp).toContainText("Story points");
    await expect(sp).toContainText("8");

    const epic = page.locator('[data-card-id="1"] [data-field="epic"]');
    // The select value "auth" renders via its option label.
    await expect(epic).toContainText("Authentication");
  });
});
