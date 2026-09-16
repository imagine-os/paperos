/**
 * App theme: follows the system by default; a toggle forces light or dark.
 * The choice is `data-theme` on <html> (the CSS tokens key off it) and is
 * kept in localStorage under `paperos-v2:theme`.
 */
import { signal } from "./signal";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "paperos-v2:theme";

export const themeChoice = signal<ThemeChoice>("system");
export const resolvedTheme = signal<ResolvedTheme>("light");

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function apply(choice: ThemeChoice) {
  const resolved = choice === "system" ? systemTheme() : choice;
  resolvedTheme.set(resolved);
  if (typeof document !== "undefined") {
    if (choice === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
  }
}

let initialized = false;

/** Reads the stored choice and starts following the system preference. Idempotent. */
export function initTheme(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    // Storage blocked; stay on system.
  }
  const choice: ThemeChoice =
    stored === "light" || stored === "dark" ? stored : "system";
  themeChoice.set(choice);
  apply(choice);
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (themeChoice.get() === "system") apply("system");
    });
}

export function setTheme(choice: ThemeChoice): void {
  themeChoice.set(choice);
  apply(choice);
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked; the choice lives for this session.
  }
}

/** Light <-> dark (from "system" it goes to the opposite of what shows now). */
export function toggleTheme(): ResolvedTheme {
  const next: ResolvedTheme = resolvedTheme.get() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
