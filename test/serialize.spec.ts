import { test, expect } from "@playwright/test";
import {
  exportCardsToJSON,
  importCardsFromJSON,
  exportCardsToCSV,
  importCardsFromCSV,
  validateCard,
} from "../src/serialize";
import type { Card, CardFieldDef } from "../src/index";

const cards: Card[] = [
  {
    id: "1",
    title: "Ship, now",
    status: "todo",
    priority: "High",
    dueDate: "2026-08-01",
    assignee: "sara",
    tags: ["frontend", "urgent"],
    description: 'Line one\nwith a "quote" and, comma',
    comments: 5,
  },
  { id: "2", title: "Plain", status: "done" },
];

test.describe("serialize (export/import)", () => {
  test("JSON round-trips", () => {
    const json = exportCardsToJSON(cards);
    expect(importCardsFromJSON(json)).toEqual(cards);
  });

  test("invalid JSON throws helpfully", () => {
    expect(() => importCardsFromJSON("{ not json")).toThrow(/Invalid JSON/);
    expect(() => importCardsFromJSON('[{"id":"1"}]')).toThrow(
      /missing id\/title\/status/
    );
  });

  test("CSV escapes and round-trips core fields", () => {
    const csv = exportCardsToCSV(cards);
    // Header includes core fields plus the extra scalar "comments".
    expect(csv.split("\n")[0]).toBe(
      "id,title,status,priority,dueDate,assignee,tags,description,comments"
    );
    // Quotes/commas/newlines are escaped.
    expect(csv).toContain('"Line one\nwith a ""quote"" and, comma"');

    const back = importCardsFromCSV(csv);
    expect(back[0].id).toBe("1");
    expect(back[0].title).toBe("Ship, now");
    expect(back[0].tags).toEqual(["frontend", "urgent"]);
    expect(back[0].description).toBe('Line one\nwith a "quote" and, comma');
    expect(back[0].comments).toBe("5"); // CSV values are strings
    expect(back[1]).toMatchObject({ id: "2", title: "Plain", status: "done" });
  });

  test("CSV without required columns throws", () => {
    expect(() => importCardsFromCSV("foo,bar\n1,2")).toThrow(
      /id, title and status/
    );
  });
});

test.describe("validateCard (field schema)", () => {
  const fields: CardFieldDef[] = [
    { key: "storyPoints", label: "Story points", type: "number" },
    {
      key: "epic",
      label: "Epic",
      type: "select",
      options: [{ value: "auth", label: "Authentication" }],
      required: true,
    },
    { key: "due", label: "Due", type: "date" },
  ];

  test("passes a valid card", () => {
    const card: Card = {
      id: "1",
      title: "x",
      status: "todo",
      storyPoints: 5,
      epic: "auth",
      due: "2026-08-01",
    };
    expect(validateCard(card, fields)).toEqual([]);
  });

  test("reports type, option, required and date errors", () => {
    const card: Card = {
      id: "1",
      title: "x",
      status: "todo",
      storyPoints: "abc",
      due: "not-a-date",
    };
    const errors = validateCard(card, fields);
    expect(errors).toContain("Story points must be a number");
    expect(errors).toContain("Epic is required");
    expect(errors).toContain("Due must be a valid date");
  });
});
