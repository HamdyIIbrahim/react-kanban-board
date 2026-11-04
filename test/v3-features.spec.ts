import { test, expect, Page } from "@playwright/test";
import { drag, columnOrder, captureConsole } from "./helpers";

// Collect raw console lines that start with `prefix`.
const logsStartingWith = (page: Page, prefix: string) => {
  const lines: string[] = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.startsWith(prefix)) lines.push(t.slice(prefix.length).trim());
  });
  return lines;
};

const column = (page: Page, key: string) =>
  page.locator(`[data-testid="column-${key}"]`);

// The demo's board sits below a tall header: bring it into the viewport so
// pointer drags happen on-screen.
const scrollBoardIntoView = (page: Page) =>
  page
    .locator(".kanban-board")
    .first()
    .evaluate((el) =>
      window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 10)
    );

test.describe("card details panel", () => {
  test("double-click opens the panel; saving updates the card", async ({ page }) => {
    const updates = logsStartingWith(page, "onCardUpdate:");
    await page.goto("/?details=1");
    await page.locator('[data-card-id="2"]').dblclick();

    const panel = page.getByTestId("card-details");
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Title")).toHaveValue("Design database schema");

    await panel.getByLabel("Title").fill("Design the database schema");
    await panel.getByLabel("Priority").selectOption("High");
    await panel.getByLabel("Tags").fill("backend, sql");
    await panel.getByTestId("card-details-save").click();

    await expect(panel).toHaveCount(0);
    const card = page.locator('[data-card-id="2"]');
    await expect(card).toContainText("Design the database schema");
    await expect(card.locator(".priority-badge")).toHaveText("High");
    await expect.poll(() => updates.length).toBe(1);
    expect(JSON.parse(updates[0].replace(/^2\s+/, ""))).toEqual({
      title: "Design the database schema",
      priority: "High",
      tags: ["backend", "sql"],
    });
  });

  test("Escape closes without saving; the open button also opens it", async ({ page }) => {
    await page.goto("/?details=1");
    await page.locator('[data-card-id="1"]').hover();
    await page.locator('[data-card-id="1"] .card-action-button.open').click();
    const panel = page.getByTestId("card-details");
    await expect(panel).toBeVisible();
    await panel.getByLabel("Title").fill("Should not be saved");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.locator('[data-card-id="1"]')).toContainText(
      "Create user authentication flow"
    );
  });
});

test.describe("column tools", () => {
  test("collapse a column, drop a card on the strip, expand it again", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?columnTools=1");
    await page.getByTestId("column-collapse-review").click();
    await expect(column(page, "review")).toHaveAttribute("data-collapsed", "true");
    await expect(column(page, "review").locator("[data-card-id]")).toHaveCount(0);

    // Drag card 1 onto the collapsed strip (clicking the header may have
    // scrolled the board sideways; reset it so both ends are on screen).
    await page.locator(".kanban-board").first().evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" as ScrollBehavior }));
    await scrollBoardIntoView(page);
    const src = (await page.locator('[data-card-id="1"]').boundingBox())!;
    const strip = (await column(page, "review").boundingBox())!;
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2 - 8, { steps: 3 });
    await page.mouse.move(strip.x + strip.width / 2, strip.y + 120, { steps: 15 });
    await page.mouse.move(strip.x + strip.width / 2, strip.y + 122, { steps: 3 });
    await page.mouse.up();

    await expect.poll(() => cap.moves.length).toBe(1);
    expect(cap.moves[0]).toMatchObject({ cardId: "1", newStatus: "review" });

    await page.getByTestId("column-collapse-review").click();
    await expect(column(page, "review")).not.toHaveAttribute("data-collapsed", "true");
    expect(await columnOrder(page, "review")).toEqual(["4", "1"]);
  });

  test("rename, delete and add columns", async ({ page }) => {
    const changes = logsStartingWith(page, "onColumnsChange:");
    await page.goto("/?columnTools=1");

    // Rename via the header action.
    await column(page, "todo").hover();
    await page.getByTestId("column-rename-todo").click();
    const input = page.getByTestId("column-rename-input-todo");
    await input.fill("Backlog");
    await input.press("Enter");
    await expect(column(page, "todo").locator(".column-title-text")).toHaveText("Backlog");
    await expect.poll(() => changes[changes.length - 1]).toBe(
      "Backlog,In Progress,Review,Done"
    );

    // Delete a column (and its card) after confirming.
    await column(page, "review").hover();
    await page.getByTestId("column-delete-review").click();
    await expect(page.getByTestId("column-delete-confirm-review")).toContainText(
      'Delete "Review" and its 1 card?'
    );
    await page
      .getByTestId("column-delete-confirm-review")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(column(page, "review")).toHaveCount(0);
    await expect(page.locator('[data-card-id="4"]')).toHaveCount(0);

    // Add a column.
    await page.getByTestId("add-column").click();
    await page.getByTestId("add-column-input").fill("QA");
    await page.getByTestId("add-column-input").press("Enter");
    await expect(page.locator(".column-title-text", { hasText: "QA" })).toBeVisible();
    await expect.poll(() => changes[changes.length - 1]).toBe(
      "Backlog,In Progress,Done,QA"
    );
  });
});

test.describe("adding cards", () => {
  test("allowAddCard column creates a card and fires onCardAdd", async ({ page }) => {
    const adds = logsStartingWith(page, "onCardAdd:");
    await page.goto("/");
    await column(page, "todo").getByRole("button", { name: "Add new card" }).click();
    await page.getByLabel("New card title").fill("Brand new task");
    await page.getByLabel("New card title").press("Enter");
    await expect(column(page, "todo")).toContainText("Brand new task");
    await expect.poll(() => adds.length).toBe(1);
    expect(adds[0]).toMatch(/^card-[\w-]+ Brand new task$/);
    // Only the opted-in column shows the control.
    await expect(
      column(page, "review").getByRole("button", { name: "Add new card" })
    ).toHaveCount(0);
  });
});

test.describe("due dates", () => {
  test("overdue / due-soon cards are highlighted; done columns are not", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("due-2")).toHaveText("Overdue"); // 2 days ago
    await expect(page.getByTestId("due-3")).toHaveText("Due soon"); // tomorrow
    await expect(page.getByTestId("due-4")).toHaveText("Due today");
    await expect(page.getByTestId("due-1")).toHaveCount(0); // 6 days out
    await expect(page.getByTestId("due-5")).toHaveCount(0); // overdue but in Done
  });
});

test.describe("load more", () => {
  test("pages archived cards into a column until hasMore is false", async ({ page }) => {
    await page.goto("/?loadMore=1");
    const trigger = page.getByTestId("load-more-done");
    await expect(trigger).toBeVisible();
    // Scrolling the trigger into view loads a page; it keeps paging while the
    // trigger stays visible, until the column reports hasMore: false.
    await expect(async () => {
      if (await trigger.count()) {
        await trigger.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      }
      await expect(page.locator('[data-card-id="arch-9"]')).toHaveCount(1, { timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await expect(trigger).toHaveCount(0);
    // Each page loaded exactly once (no duplicate requests).
    const ids = (await columnOrder(page, "done")).filter((id) => id.startsWith("arch-"));
    expect(ids).toEqual(Array.from({ length: 9 }, (_, i) => `arch-${i + 1}`));
  });
});

test.describe("i18n + RTL", () => {
  test("dir=rtl mirrors the column order and labels are translated", async ({ page }) => {
    await page.goto("/?rtl=1");
    await expect(page.locator(".kanban-board-container")).toHaveAttribute("dir", "rtl");
    await expect(page.getByPlaceholder("ابحث في البطاقات...")).toBeVisible();
    const todo = (await column(page, "todo").boundingBox())!;
    const inProgress = (await column(page, "in-progress").boundingBox())!;
    expect(todo.x).toBeGreaterThan(inProgress.x); // first column on the right
  });
});

test.describe("virtualized columns", () => {
  test("auto-scrolls while dragging so far-away positions are reachable", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?bulk=300&virtualize=30");
    await page.waitForSelector('[data-card-id="1"]');
    await scrollBoardIntoView(page);
    const content = page.locator('[data-testid="column-todo"] .column-content.virtualized');
    const box = (await content.boundingBox())!;
    const src = (await page.locator('[data-card-id="1"]').boundingBox())!;

    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2 + 10, { steps: 3 });
    // Hold near the bottom edge so dnd-kit auto-scrolls the column.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8, { steps: 12 });
    await expect
      .poll(() => content.evaluate((el) => el.scrollTop), { timeout: 8000 })
      .toBeGreaterThan(1500);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();

    await expect.poll(() => cap.moves.length).toBe(1);
    expect(cap.moves[0].cardId).toBe("1");
    expect(cap.moves[0].index).toBeGreaterThan(10);
  });
});

test.describe("filtering", () => {
  test("search also matches description and tags", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Search cards...").fill("github actions");
    await expect.poll(() => page.locator("[data-card-id]").count()).toBe(1);
    await expect(page.locator('[data-card-id="3"]')).toBeVisible();
    await page.getByPlaceholder("Search cards...").fill("database");
    await expect(page.locator('[data-card-id="2"]')).toBeVisible();
  });
});

test("drag reorder still reports exact drop position (regression)", async ({ page }) => {
  const cap = captureConsole(page);
  await page.goto("/");
  await drag(page, "2", "todo", "1");
  await expect.poll(() => cap.moves.length).toBe(1);
  expect(cap.moves[0]).toEqual({
    cardId: "2",
    newStatus: "todo",
    prevTaskId: null,
    nextTaskId: "1",
    index: 0,
  });
});
