#!/usr/bin/env node
// Type-checks every ```jsx / ```tsx / ```ts / ```js example in README.md
// against the *built* package, so the docs can't drift from the API.
// Each example becomes its own module; free variables the snippet assumes
// (columns, cards, api, ...) are declared as `any` in a shared globals file.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUT = ".readme-examples";
const readme = readFileSync("README.md", "utf8");
const blocks = [...readme.matchAll(/^```(jsx|tsx|ts|js)\n([\s\S]*?)^```/gm)];

// Examples that integrate third-party UI kits we don't install.
const isThirdParty = (code) =>
  [...code.matchAll(/from\s+"([^"]+)"/g)].some(
    ([, m]) => !/^(react|react-dom|react-dom\/client|react-custom-kanban-board(\/.*)?|\.\/.*)$/.test(m)
  );

// Values the snippets assume exist in the reader's app.
const STUBS = [
  "columns", "cards", "initialCards", "tickets", "api", "db", "save", "saveColumns",
  "setCards", "Comments", "page", "setPage", "loading", "setLoading", "cardFields",
  "board", "toast", "useState", "useEffect", "React",
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, "globals.d.ts"),
  `export {};
declare global {
${STUBS.map((n) => `  var ${n}: any;`).join("\n")}
  var KanbanBoard: typeof import("react-custom-kanban-board").default;
  var ControlledKanbanBoard: typeof import("react-custom-kanban-board").ControlledKanbanBoard;
}
`
);

const files = ["globals.d.ts"];
let skipped = 0;
blocks.forEach(([, , code], i) => {
  if (isThirdParty(code)) {
    skipped++;
    return;
  }
  const line = readme.slice(0, blocks[i].index).split("\n").length;
  const name = `example-L${line}.tsx`;
  writeFileSync(join(OUT, name), `// README.md line ${line}\n${code}\nexport {};\n`);
  files.push(name);
});

writeFileSync(
  join(OUT, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        allowUnreachableCode: true,
        noImplicitAny: false,
      },
      files,
    },
    null,
    2
  )
);

try {
  execFileSync("npx", ["tsc", "-p", join(OUT, "tsconfig.json")], { stdio: "pipe" });
  console.log(`README examples: ${files.length - 1} compiled OK (${skipped} third-party example skipped)`);
} catch (err) {
  console.error(String(err.stdout || err));
  console.error("README examples failed to type-check (see .readme-examples/).");
  process.exit(1);
}
