#!/usr/bin/env node
// Smoke-tests the *built* package the way consumers load it: through the
// package.json "exports" map, in plain Node (no bundler, no CSS loader), with
// both require() and import, plus a server-side render.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const name = "react-custom-kanban-board";
let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${label}\n    ${err && err.stack ? err.stack.split("\n").slice(0, 3).join("\n    ") : err}`);
  }
};

console.log("package smoke test");

await check("require() main entry in plain Node", () => {
  const mod = require(name);
  assert.equal(typeof mod.KanbanBoard, "function");
  assert.equal(typeof mod.default, "function");
  assert.equal(typeof mod.useKanban, "function");
});

await check("import main entry (ESM)", async () => {
  const mod = await import(name);
  assert.equal(typeof mod.KanbanBoard, "function");
  assert.equal(typeof mod.default, "function");
});

await check("utils entry loads without React (CJS + ESM)", async () => {
  const cjs = require(`${name}/utils`);
  const esm = await import(`${name}/utils`);
  for (const m of [cjs, esm]) {
    assert.equal(typeof m.moveCard, "function");
    assert.equal(typeof m.exportCardsToCSV, "function");
    assert.equal(typeof m.diffCards, "function");
    assert.equal(typeof m.applyCardChanges, "function");
  }
});

await check('"use client" only on the client entry', () => {
  for (const f of ["dist/esm/index.js", "dist/index.js"]) {
    assert.ok(readFileSync(f, "utf8").startsWith('"use client";'), `${f} missing directive`);
  }
  for (const f of ["dist/esm/utils.js", "dist/utils.js"]) {
    assert.ok(!readFileSync(f, "utf8").includes('"use client"'), `${f} must not be a client module`);
  }
});

await check("styles.css is exported", () => {
  const p = require.resolve(`${name}/styles.css`);
  assert.ok(existsSync(p));
  assert.ok(readFileSync(p, "utf8").includes("--kb-accent"));
});

await check("v2 import paths still resolve", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  // webpack 4 / CRA 4 read `module`: it must be a .js ES module file.
  assert.ok(pkg.module.endsWith(".js") && existsSync(pkg.module), "module field");
  assert.ok(readFileSync(pkg.module, "utf8").includes("export {"), "module is ESM");
  assert.equal(JSON.parse(readFileSync("dist/esm/package.json", "utf8")).type, "module");
  // main / types are the same paths as v2.
  assert.equal(pkg.main, "./dist/index.js");
  assert.equal(pkg.types, "./dist/index.d.ts");
  assert.equal(typeof require(`${name}/dist/index.js`).default, "function");
  assert.equal(typeof require(`${name}/dist/index`).default, "function");
  assert.ok(existsSync(require.resolve(`${name}/dist/KanbanBoard.css`)));
});

await check("stylesheet is inlined for automatic injection", () => {
  for (const f of ["dist/esm/index.js", "dist/index.js"]) {
    assert.ok(readFileSync(f, "utf8").includes("--kb-stylesheet"), `${f} missing inlined CSS`);
  }
});

await check("server-side render (react-dom/server)", async () => {
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { KanbanBoard } = await import(name);
  const html = renderToString(
    React.createElement(KanbanBoard, {
      columns: [
        { key: "todo", title: "To Do", color: "#ccc", allowAddCard: true },
        { key: "done", title: "Done", color: "#ccc", isDone: true },
      ],
      initialCards: [
        { id: "1", title: "Write docs", status: "todo", priority: "High", dueDate: "2000-01-01" },
        { id: "2", title: "Ship it", status: "done" },
      ],
      enableSearch: true,
      enableColumnCollapse: true,
      enableColumnManagement: true,
      enableCardDetails: true,
    })
  );
  assert.ok(html.includes("Write docs") && html.includes("Ship it"), "cards missing from SSR markup");
  // Time-dependent UI is deferred until mount so markup is deterministic.
  assert.ok(!html.includes("kb-due-overdue"), "due highlighting should not render on the server");
});

await check("moveCard util", async () => {
  const { moveCard } = await import(`${name}/utils`);
  const cards = [
    { id: "a", title: "A", status: "todo" },
    { id: "b", title: "B", status: "todo" },
    { id: "c", title: "C", status: "done" },
  ];
  const r = moveCard(cards, "a", "done", 0);
  assert.deepEqual(r.position, { prevTaskId: null, nextTaskId: "c", index: 0 });
  assert.equal(r.nextCards.find((c) => c.id === "a").status, "done");
  const blocked = moveCard(cards, "a", "done", 0, [{ key: "done", title: "Done", limit: 1 }]);
  assert.deepEqual(blocked, { wipBlockedColumn: "done" });
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall package checks passed");
