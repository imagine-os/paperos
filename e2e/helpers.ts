import type { Page } from "@playwright/test";

/** Marks the IDE as initialized so a fresh page starts without the IDE windows (and no welcome tour). */
export async function skipFirstRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("paperos-v2:ide-initialized", "test");
    window.localStorage.setItem("paperos-v2:welcome-seen", "test");
  });
}

/** Keeps the first-run IDE workspace but skips the welcome tour. */
export async function skipWelcome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("paperos-v2:welcome-seen", "test");
  });
}

/** Opens a Note window through the top bar's "New window" menu. */
export async function newNoteWindow(page: Page): Promise<void> {
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId("new-window-note").click();
}
