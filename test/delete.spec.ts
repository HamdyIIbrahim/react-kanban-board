import { test, expect } from "@playwright/test";
import { captureConsole } from "./helpers";

const delBtn = (id: string) =>
  `[data-card-id="${id}"] .card-action-button.delete`;

test.describe("delete confirmation", () => {
  test("immediate: fires onCardDelete and removes card", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?delete=immediate");
    await page.waitForSelector('[data-card-id="1"]');

    await page.locator(delBtn("1")).click();

    await expect.poll(() => cap.deletes).toEqual(["1"]);
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(0);
  });

  test("confirm: prompts, cancel is a no-op, confirm deletes", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?delete=confirm");
    await page.waitForSelector('[data-card-id="1"]');

    // Clicking delete only shows the prompt.
    await page.locator(delBtn("1")).click();
    await expect(
      page.locator('[data-testid="delete-confirm-1"]')
    ).toBeVisible();
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(1);
    expect(cap.deletes).toEqual([]);

    // Cancel does nothing.
    await page.locator('[data-testid="delete-confirm-1"] .delete-confirm-cancel').click();
    await expect(
      page.locator('[data-testid="delete-confirm-1"]')
    ).toHaveCount(0);
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(1);
    expect(cap.deletes).toEqual([]);

    // Confirm actually deletes.
    await page.locator(delBtn("1")).click();
    await page.locator('[data-testid="delete-confirm-1"] .delete-confirm-delete').click();
    await expect.poll(() => cap.deletes).toEqual(["1"]);
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(0);
  });

  test("undo: defers delete, restores on undo, commits on timeout", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?delete=undo"); // demo sets undoDuration=3000
    await page.waitForSelector('[data-card-id="1"]');

    // Card removed from view immediately, but not committed.
    await page.locator(delBtn("1")).click();
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="undo-toast-todo"]')
    ).toBeVisible();
    expect(cap.deletes).toEqual([]);

    // Undo restores it and never fires onCardDelete.
    await page.locator('[data-testid="undo-toast-todo"] .undo-toast-button').click();
    await expect(page.locator('[data-card-id="1"]')).toHaveCount(1);
    await expect(
      page.locator('[data-testid="undo-toast-todo"]')
    ).toHaveCount(0);
    expect(cap.deletes).toEqual([]);

    // Delete again and let the timeout commit it.
    await page.locator(delBtn("1")).click();
    await expect.poll(() => cap.deletes, { timeout: 6000 }).toEqual(["1"]);
    await expect(
      page.locator('[data-testid="undo-toast-todo"]')
    ).toHaveCount(0);
  });
});
