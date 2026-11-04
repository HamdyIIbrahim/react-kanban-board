import { test, expect, Page } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

// Backward compatibility with the published v2 API.

const v2Logs = (page: Page) => {
  const lines: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().startsWith("v2:")) lines.push(msg.text());
  });
  return lines;
};

test.describe("v2 usage (no stylesheet import, v2 props)", () => {
  test("styles are injected automatically and only once", async ({ page }) => {
    await page.goto("/v2.html");
    await page.waitForSelector('[data-card-id="1"]');
    await expect(page.locator("style[data-kb-styles]")).toHaveCount(1);
    // The default card styles apply (unstyled it would have no radius/shadow).
    const style = await page
      .locator('[data-card-id="1"] .card')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { radius: cs.borderRadius, shadow: cs.boxShadow };
      });
    expect(style.radius).not.toBe("0px");
    expect(style.shadow).not.toBe("none");
  });

  test("no injection when the stylesheet is already imported", async ({ page }) => {
    await page.goto("/"); // the playground imports the CSS itself
    await page.waitForSelector('[data-card-id="1"]');
    await expect(page.locator("style[data-kb-styles]")).toHaveCount(0);
  });

  test("columnForAddCard + onTaskAddedCallback", async ({ page }) => {
    const logs = v2Logs(page);
    await page.goto("/v2.html");
    const todo = page.locator('[data-testid="column-todo"]');
    await todo.getByRole("button", { name: "Add new card" }).click();
    await page.getByLabel("New card title").fill("From v2");
    await page.getByLabel("New card title").press("Enter");
    await expect(todo).toContainText("From v2");
    await expect.poll(() => logs).toContain("v2:onTaskAdded From v2");
    await expect(
      page.locator('[data-testid="column-done"]').getByRole("button", { name: "Add new card" })
    ).toHaveCount(0);
  });

  test("onCardMove fires for cross-column moves only (as in v2)", async ({ page }) => {
    const logs = v2Logs(page);
    await page.goto("/v2.html");
    await drag(page, "2", "todo", "1"); // same-column reorder
    await expect.poll(async () => columnOrder(page, "todo")).toEqual(["2", "1"]);
    await page.waitForTimeout(200);
    expect(logs.filter((l) => l.startsWith("v2:onCardMove"))).toEqual([]);

    await drag(page, "1", "done", "-1"); // cross-column move
    await expect.poll(() => logs).toContain("v2:onCardMove 1 done");
  });

  test("search matches titles only by default", async ({ page }) => {
    await page.goto("/v2.html");
    await page.getByPlaceholder("Search cards...").fill("high"); // a priority, not a title
    await expect(page.locator("[data-card-id]")).toHaveCount(0);
    await page.getByPlaceholder("Search cards...").fill("task 3");
    await expect(page.locator("[data-card-id]")).toHaveCount(1);
  });
});

test.describe("v2 behaviours in the playground", () => {
  test("v2-style draggable custom cards still drag (handleDragStart is a no-op)", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?legacyCard=1");
    await expect(page.getByTestId("legacy-1")).toHaveAttribute("draggable", "true");
    await drag(page, "1", "review", "-1");
    await expect.poll(() => cap.moves.length).toBe(1);
    expect(cap.moves[0]).toMatchObject({ cardId: "1", newStatus: "review" });
    expect(await columnOrder(page, "review")).toContain("1");
  });

  test("initialCards that arrive after mount are rendered (async data)", async ({ page }) => {
    await page.goto("/?asyncCards=1");
    await expect(page.locator('[data-card-id="1"]')).toBeVisible();
    expect(await columnOrder(page, "todo")).toEqual(["1", "2"]);
  });

  test("a re-render with equal initialCards keeps the user's ordering", async ({ page }) => {
    await page.goto("/");
    await drag(page, "2", "todo", "1");
    await expect.poll(async () => columnOrder(page, "todo")).toEqual(["2", "1"]);
    await page.getByTestId("bump").click(); // parent re-render, fresh array
    await page.waitForTimeout(200);
    expect(await columnOrder(page, "todo")).toEqual(["2", "1"]);
  });

  test("same-column reorder reports via onCardReorder, not onCardMove", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/");
    await drag(page, "2", "todo", "1");
    await expect.poll(() => cap.reorders.length).toBe(1);
    expect(cap.reorders[0]).toEqual({
      cardId: "2",
      newStatus: "todo",
      prevTaskId: null,
      nextTaskId: "1",
      index: 0,
    });
    expect(cap.moves).toHaveLength(1); // the reorder only
  });
});
