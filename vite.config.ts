import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only config to preview the KanbanBoard component locally.
export default defineConfig({
  plugins: [react()],
  root: "demo",
  server: {
    port: 5173,
    open: false,
  },
});
