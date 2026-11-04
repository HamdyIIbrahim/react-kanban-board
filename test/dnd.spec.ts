import { test, expect } from "@playwright/test";
import { drag, captureConsole } from "./helpers";

test.describe("onCardMove drop position", () => {
  test("same-column reorder to top fires with prev=null, next=first", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="1"]');

    await drag(page, "2", "todo", "1"); // move card 2 above card 1
    await expect.poll(() => cap.moves.length).toBe(1);

    expect(cap.moves[0]).toEqual({
      cardId: "2",
      newStatus: "todo",
      prevTaskId: null,
      nextTaskId: "1",
      index: 0,
    });
  });

  test("cross-column drop before first card", async ({ page }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="3"]');

    await drag(page, "4", "in-progress", "3"); // review card -> above card 3
    await expect.poll(() => cap.moves.length).toBe(1);

    expect(cap.moves[0]).toEqual({
      cardId: "4",
      newStatus: "in-progress",
      prevTaskId: null,
      nextTaskId: "3",
      index: 0,
    });
  });

  test("cross-column drop to bottom fires with prev=last, next=null", async ({
    page,
  }) => {
    const cap = captureConsole(page);
    await page.goto("/?mode=uncontrolled");
    await page.waitForSelector('[data-card-id="5"]');

    await drag(page, "2", "done", "-1"); // todo card -> end of done (after card 5)
    await expect.poll(() => cap.moves.length).toBe(1);

    expect(cap.moves[0]).toEqual({
      cardId: "2",
      newStatus: "done",
      prevTaskId: "5",
      nextTaskId: null,
      index: 1,
    });
  });
});
