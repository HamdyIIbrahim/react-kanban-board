/**
 * Board export / import utilities (CSV + JSON). Pure functions with no React or
 * dnd-kit dependencies, so they can be used anywhere (browser or server) and
 * unit-tested in isolation.
 */
import type { Card, CardFieldDef } from "./index";

/**
 * Validate a card against a custom field schema. Returns an array of
 * human-readable error messages (empty when valid).
 */
export function validateCard(card: Card, fields: CardFieldDef[]): string[] {
  const errors: string[] = [];
  for (const f of fields) {
    const v = (card as any)[f.key];
    const missing = v === undefined || v === null || v === "";
    if (f.required && missing) {
      errors.push(`${f.label} is required`);
      continue;
    }
    if (missing) continue;
    if (f.type === "number" && isNaN(Number(v))) {
      errors.push(`${f.label} must be a number`);
    } else if (
      f.type === "select" &&
      f.options &&
      !f.options.some((o) => o.value === v)
    ) {
      errors.push(`${f.label} is not a valid option`);
    } else if (f.type === "date" && isNaN(Date.parse(String(v)))) {
      errors.push(`${f.label} must be a valid date`);
    }
  }
  return errors;
}

// Fixed columns exported first; any extra scalar card fields follow (sorted).
const CORE_FIELDS = [
  "id",
  "title",
  "status",
  "priority",
  "dueDate",
  "assignee",
  "tags",
  "description",
] as const;

/** Serialize cards to pretty-printed JSON. */
export function exportCardsToJSON(cards: Card[]): string {
  return JSON.stringify(cards, null, 2);
}

/** Parse cards from JSON, validating the minimal Card shape. */
export function importCardsFromJSON(json: string): Card[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Expected an array of cards");
  return parsed.map((c, i) => {
    if (
      !c ||
      typeof c !== "object" ||
      typeof (c as any).id !== "string" ||
      typeof (c as any).title !== "string" ||
      typeof (c as any).status !== "string"
    ) {
      throw new Error(`Card at index ${i} is missing id/title/status`);
    }
    return c as Card;
  });
}

const escapeCSV = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const cellToString = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join("|");
  return String(v);
};

/** Serialize cards to CSV. Array fields (e.g. tags) are joined with `|`. */
export function exportCardsToCSV(cards: Card[]): string {
  const extra = new Set<string>();
  for (const card of cards) {
    for (const key of Object.keys(card)) {
      if (!CORE_FIELDS.includes(key as any)) {
        const v = (card as any)[key];
        if (v === null || typeof v !== "object" || Array.isArray(v)) {
          extra.add(key);
        }
      }
    }
  }
  const headers = [...CORE_FIELDS, ...Array.from(extra).sort()];
  const lines = [headers.map(escapeCSV).join(",")];
  for (const card of cards) {
    lines.push(
      headers.map((h) => escapeCSV(cellToString((card as any)[h]))).join(",")
    );
  }
  return lines.join("\n");
}

// Parse a single CSV line into cells, honoring quoted fields.
function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

// Split CSV text into records, respecting quoted newlines.
function splitCSVRecords(csv: string): string[] {
  const records: string[] = [];
  let cur = "";
  let inQuotes = false;
  const text = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === "\n" && !inQuotes) {
      records.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length) records.push(cur);
  return records;
}

/** Parse cards from CSV produced by exportCardsToCSV (or a compatible file). */
export function importCardsFromCSV(csv: string): Card[] {
  const records = splitCSVRecords(csv.trim());
  if (records.length < 1) return [];
  const headers = parseCSVLine(records[0]);
  const idIdx = headers.indexOf("id");
  const titleIdx = headers.indexOf("title");
  const statusIdx = headers.indexOf("status");
  if (idIdx === -1 || titleIdx === -1 || statusIdx === -1) {
    throw new Error("CSV must have id, title and status columns");
  }
  return records.slice(1).map((rec) => {
    const cells = parseCSVLine(rec);
    const card: Record<string, any> = {};
    headers.forEach((h, i) => {
      const raw = cells[i] ?? "";
      if (h === "tags") {
        card.tags = raw ? raw.split("|") : [];
      } else if (raw !== "") {
        card[h] = raw;
      }
    });
    return card as Card;
  });
}
