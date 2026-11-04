import { useEffect, useLayoutEffect } from "react";
// Autoprefixed stylesheet as a string (Vite `?inline` in dev; a build plugin
// in tsup.config.ts).
import css from "./KanbanBoard.css?inline";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

let injected = false;

// v2 imported its stylesheet automatically. Keep that zero-config experience
// without importing CSS from JS (which crashes Node / SSR / Jest): inject a
// <style> tag on the client, once, unless the stylesheet is already present
// (it defines `--kb-stylesheet` on :root).
export function injectKanbanStyles(nonce?: string): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  if (document.querySelector("style[data-kb-styles]")) return;
  const marker = getComputedStyle(document.documentElement)
    .getPropertyValue("--kb-stylesheet")
    .trim();
  if (marker) return;
  const el = document.createElement("style");
  el.setAttribute("data-kb-styles", "");
  if (nonce) el.setAttribute("nonce", nonce);
  el.textContent = css;
  // First in <head> so the app's own CSS still overrides the defaults.
  document.head.insertBefore(el, document.head.firstChild);
}

export function useInjectedStyles(enabled: boolean, nonce?: string): void {
  useIsoLayoutEffect(() => {
    if (enabled) injectKanbanStyles(nonce);
  }, [enabled, nonce]);
}
