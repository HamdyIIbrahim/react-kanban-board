import { test, expect } from "@playwright/test";
import { diffCards } from "../src/realtime";
import type { Card } from "../src/index";
import { drag, columnOrder } from "./helpers";

test.describe("diffCards", () => {
  test("detects add / remove / move / update", () => {
    const prev: Card[] = [
      { id: "1", title: "a", status: "todo" },
      { id: "2", title: "b", status: "todo" },
      { id: "9", title: "gone", status: "done" },
    ];
    const next: Card[] = [
      { id: "1", title: "a v2", status: "todo" }, // updated
      { id: "2", title: "b", status: "done" }, // moved
      { id: "3", title: "c", status: "todo" }, // added
    ];
    const changes = diffCards(prev, next);
    expect(changes).toContainEqual({ type: "update", id: "1", card: next[0] });
    expect(changes).toContainEqual({
      type: "move",
      id: "2",
      from: "todo",
      to: "done",
    });
    expect(changes).toContainEqual({ type: "add", card: next[2] });
    expect(changes).toContainEqual({ type: "remove", id: "9" });
  });

  test("no changes for identical lists", () => {
    const cards: Card[] = [{ id: "1", title: "a", status: "todo" }];
    expect(diffCards(cards, cards.slice())).toEqual([]);
  });
});

test.describe("realtime collaboration (BroadcastChannel + controlled)", () => {
  test("a move in one tab syncs to another tab", async ({ page }) => {
    const pageB = await page.context().newPage();
    await page.goto("/?realtime=1");
    await pageB.goto("/?realtime=1");
    await page.waitForSelector('[data-card-id="1"]');
    await pageB.waitForSelector('[data-card-id="1"]');
    expect(await columnOrder(pageB, "todo")).toEqual(["1", "2"]);

    // Reorder in tab A.
    await drag(page, "2", "todo", "1");
    await expect.poll(() => columnOrder(page, "todo")).toEqual(["2", "1"]);

    // Tab B reflects it via the broadcast.
    await expect.poll(() => columnOrder(pageB, "todo")).toEqual(["2", "1"]);
    await pageB.close();
  });
});
