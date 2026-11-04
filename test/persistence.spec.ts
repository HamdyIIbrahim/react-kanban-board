import { test, expect } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

test.describe("persistence adapter (optimistic + rollback)", () => {
  test("successful sync keeps the optimistic move", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?persist=ok");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    await drag(page, "2", "todo", "1"); // move card 2 above card 1

    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    // Give the (successful) backend call time to resolve; no rollback.
    await page.waitForTimeout(500);
    expect(await columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.persistErrors).toEqual([]);
  });

  test("failed sync rolls the move back", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?persist=fail");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    await drag(page, "2", "todo", "1");

    // Optimistically moves first...
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    // ...then the backend rejects and the board rolls back.
    await expect
      .poll(() => columnOrder(page, "todo"), { timeout: 3000 })
      .toEqual(["1", "2"]);
    expect(cap.persistErrors[cap.persistErrors.length - 1]).toContain(
      "backend rejected"
    );
  });
});
