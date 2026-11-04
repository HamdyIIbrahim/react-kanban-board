// Finishes the build: marks dist/esm as ES modules and keeps the v2 stylesheet
// path (dist/KanbanBoard.css) as a real file for resolvers that ignore the
// package.json "exports" map.
const fs = require("fs");
const path = require("path");
const dist = path.resolve(__dirname, "..", "dist");
fs.writeFileSync(
  path.join(dist, "esm", "package.json"),
  JSON.stringify({ type: "module", sideEffects: ["*.css"] }, null, 2) + "\n"
);
fs.copyFileSync(path.join(dist, "styles.css"), path.join(dist, "KanbanBoard.css"));
console.log("postbuild: wrote dist/esm/package.json and dist/KanbanBoard.css");
