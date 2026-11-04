import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server + static build of the demo playground (demo/).
// `npm run build:demo` writes demo-dist/; DEMO_BASE sets the public path
// (e.g. "/react-kanban-board/" for GitHub Pages).
export default defineConfig({
  plugins: [react()],
  root: "demo",
  base: process.env.DEMO_BASE || "/",
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
