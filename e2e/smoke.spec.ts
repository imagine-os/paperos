import { expect, test } from "@playwright/test";
import { newNoteWindow, skipFirstRun } from "./helpers";

test("desktop renders and can open a window", async ({ page }) => {
  await skipFirstRun(page);
  await page.goto("/");
  const topbar = page.getByTestId("topbar");
  await expect(topbar).toContainText("PaperOS");
  await expect(topbar).toContainText("v2 preview");
  await expect(page.locator(".tl-canvas")).toBeVisible();

  await newNoteWindow(page);
  await expect(page.getByTestId("window")).toHaveCount(1);
  await expect(page.locator(".pos-window__title")).toContainText("Note");
});

test("legacy prototype renders with its banner", async ({ page }) => {
  await page.goto("/legacy");
  await expect(page.getByRole("banner")).toContainText(
    "Legacy prototype (2025)"
  );
  await expect(
    page.getByRole("link", { name: /Back to PaperOS v2/ })
  ).toBeVisible();
  await expect(page.locator(".tl-canvas")).toBeVisible();
});
