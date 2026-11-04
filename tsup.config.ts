import { readFile } from "node:fs/promises";
import { defineConfig, type Options } from "tsup";
import postcss from "postcss";
import autoprefixer from "autoprefixer";

// `import css from "./file.css?inline"` -> the autoprefixed stylesheet as a
// string (matches Vite's ?inline behaviour used by the demo / tests).
const inlineCss = {
  name: "inline-css",
  setup(build: any) {
    build.onResolve({ filter: /\.css\?inline$/ }, (args: any) => ({
      // Keep the "?inline" suffix so tsup's own .css handling ignores it.
      path: new URL(args.path.replace(/\?inline$/, ""), `file://${args.resolveDir}/`).pathname + "?inline",
      namespace: "inline-css",
    }));
    build.onLoad({ filter: /.*/, namespace: "inline-css" }, async (args: any) => {
      const file = args.path.replace(/\?inline$/, "");
      const source = await readFile(file, "utf8");
      const result = await postcss([autoprefixer]).process(source, { from: file });
      return { contents: `export default ${JSON.stringify(result.css)};`, loader: "js" };
    });
  },
};

const base: Options = {
  sourcemap: true,
  target: "es2018",
  external: ["react", "react-dom", "react/jsx-runtime"],
  esbuildPlugins: [inlineCss],
  dts: true,
};

// ESM goes to dist/esm/*.js (with a {"type":"module"} package.json written by
// scripts/postbuild.cjs) rather than .mjs, because webpack 4 / CRA 4 read the
// `module` field and mishandle .mjs. CommonJS stays at dist/*.js as in v2.
const build = (entry: Record<string, string>, banner?: string): Options[] => [
  {
    ...base,
    entry,
    format: "cjs",
    outDir: "dist",
    banner: banner ? { js: banner } : undefined,
  },
  {
    ...base,
    entry,
    format: "esm",
    outDir: "dist/esm",
    outExtension: () => ({ js: ".js" }),
    banner: banner ? { js: banner } : undefined,
  },
];

export default defineConfig([
  // Client entry: components + hooks, marked "use client" for React Server
  // Component frameworks (Next.js App Router).
  ...build({ index: "src/index.ts" }, '"use client";'),
  // Server-safe utilities: no directive, no React.
  ...build({ utils: "src/utils.ts" }),
]);
