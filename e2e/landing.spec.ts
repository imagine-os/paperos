import { expect, test } from "@playwright/test";
import { skipFirstRun } from "./helpers";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "the canvas that"
  );
  await expect(page.getByTestId("cta-demo")).toBeVisible();
  await expect(page.getByTestId("cta-legacy")).toHaveAttribute(
    "href",
    /\/legacy\/?$/
  );
  await expect(page.getByTestId("cta-source")).toHaveAttribute(
    "href",
    "https://github.com/imagine-os/paperos"
  );
  // No desktop chrome on the landing page.
  await expect(page.getByTestId("topbar")).toHaveCount(0);
});

test("hero CTA opens the desktop at /app", async ({ page }) => {
  await skipFirstRun(page);
  await page.goto("/");
  await page.getByTestId("cta-demo").click();
  await expect(page).toHaveURL(/\/app\/?$/);
  const topbar = page.getByTestId("topbar");
  await expect(topbar).toContainText("PaperOS");
  await expect(page.locator(".tl-canvas")).toBeVisible();
});
