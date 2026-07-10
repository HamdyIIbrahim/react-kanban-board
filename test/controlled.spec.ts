import { test, expect } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

test.describe("controlled vs uncontrolled", () => {
  test("uncontrolled: reorder survives a parent re-render (v2 reset bug fixed)", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    await drag(page, "2", "todo", "1");
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.changes.length).toBeGreaterThanOrEqual(1);

    // Force a parent re-render (fresh initialCards array). v2 reset here.
    await page.locator('[data-testid="bump"]').click();
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
  });

  test("controlled: board reflects consumer state via onCardsChange", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=controlled");
    await page.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);

    await drag(page, "2", "todo", "1");
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
    expect(cap.changes[cap.changes.length - 1]).toContain("2:todo,1:todo");

    await page.locator('[data-testid="bump"]').click();
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);
  });

  test("controlled: board does NOT move when the prop is not updated", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=controlled-static");
    await page.waitForSelector('[data-card-id="1"]');

    await drag(page, "2", "todo", "1");
    // onCardsChange fires, but the board is fully controlled so nothing moves.
    await expect.poll(() => cap.changes.length).toBeGreaterThanOrEqual(1);
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);
  });
});
