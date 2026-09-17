import { expect, test } from "@playwright/test";
import { skipFirstRun } from "./helpers";

type Api = {
  paperos: {
    projects: { current(): unknown };
    windows: {
      create(spec: {
        kind: string;
        title?: string;
        content?: string;
        rect: { x: number; y: number; w: number; h: number };
      }): { id: string };
      list(): { id: string; kind: string }[];
    };
    boards: { open(name: string): Promise<unknown> };
    canvas: { setCamera(c: { x: number; y: number; z: number }): unknown };
  };
};

async function openApp(page: import("@playwright/test").Page) {
  await skipFirstRun(page);
  await page.goto("/app");
  await page.waitForFunction(
    () => !!(window as unknown as Api).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
}

test("a crashing window shows a card with Reload window and a toast; the canvas keeps working", async ({
  page,
}) => {
  await openApp(page);
  // A Card whose `facts` is not an array makes the kind throw while rendering.
  await page.evaluate(() => {
    const api = (window as unknown as Api).paperos;
    api.windows.create({
      kind: "card",
      title: "Broken card",
      content: JSON.stringify({ key: "k", facts: "boom" }),
      rect: { x: 80, y: 120, w: 320, h: 200 },
    });
    api.windows.create({
      kind: "note",
      title: "Fine note",
      content: "still here",
      rect: { x: 480, y: 120, w: 320, h: 200 },
    });
  });
  const crashed = page.getByTestId("window-crashed");
  await expect(crashed).toBeVisible({ timeout: 15000 });
  await expect(crashed).toContainText("This window crashed");
  const toast = page.getByTestId("problem-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Window "Broken card" crashed');
  // The other window and the canvas are untouched.
  await expect(
    page.locator(".pos-window[data-kind=note] textarea")
  ).toHaveValue("still here");
  await expect(page.locator(".pos-window")).toHaveCount(2);
  await page.getByTestId("problem-dismiss").click();
  await expect(toast).toHaveCount(0);
  // Reload remounts the body (it crashes again with the same content, so the card stays).
  await page.getByTestId("window-reload").click();
  await expect(crashed).toBeVisible();
  // Closing the crashed window works like any other.
  await page
    .locator(".pos-window[data-kind=card]")
    .getByRole("button", { name: "Close window" })
    .click();
  await expect(page.locator(".pos-window")).toHaveCount(1);
});

test("arrows and their labels are culled by zoom band", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() =>
    (window as unknown as Api).paperos.boards.open("build-product")
  );
  const canvas = page.locator(".pos-canvas");
  await expect(page.locator(".tl-shape[data-shape-type=arrow]")).toHaveCount(8);
  await expect(canvas).toHaveAttribute("data-zoom", /near|mid/);
  await page.evaluate(() =>
    (window as unknown as Api).paperos.canvas.setCamera({ x: 0, y: 0, z: 0.2 })
  );
  await expect(canvas).toHaveAttribute("data-zoom", "mid");
  await expect(page.locator(".tl-arrow-label:visible")).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as Api).paperos.canvas.setCamera({ x: 0, y: 0, z: 0.05 })
  );
  await expect(canvas).toHaveAttribute("data-zoom", "far");
  await expect(
    page.locator(".tl-shape[data-shape-type=arrow]:visible")
  ).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as Api).paperos.canvas.setCamera({ x: 0, y: 0, z: 1 })
  );
  await expect(canvas).toHaveAttribute("data-zoom", "near");
});

test("Reset local data wipes the browser state and reloads into a first run", async ({
  page,
}) => {
  // Skip the first run on the first load only; after the reset the page
  // must come back as a real first run.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-reset-done")) return;
    localStorage.setItem("paperos-v2:ide-initialized", "test");
    localStorage.setItem("paperos-v2:welcome-seen", "test");
  });
  await page.goto("/app");
  await page.waitForFunction(
    () => !!(window as unknown as Api).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
  await page.evaluate(() =>
    (window as unknown as Api).paperos.windows.create({
      kind: "note",
      content: "to be wiped",
      rect: { x: 80, y: 120, w: 320, h: 200 },
    })
  );
  await page.waitForTimeout(800);
  await page.evaluate(() => sessionStorage.setItem("e2e-reset-done", "1"));
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("about-menu").click();
  await page.getByTestId("about-reset-menu").click();
  // Back as a first run: the welcome tour shows over the fresh IDE workspace.
  await expect(page.getByTestId("tour-caption")).toContainText(
    "Welcome to PaperOS",
    { timeout: 40000 }
  );
  const flags = await page.evaluate(() => ({
    init: localStorage.getItem("paperos-v2:ide-initialized"),
    seen: localStorage.getItem("paperos-v2:welcome-seen"),
  }));
  expect(flags.init).not.toBe("test");
  expect(flags.seen).not.toBe("test");
  await expect(
    page.locator(".pos-window", { hasText: "to be wiped" })
  ).toHaveCount(0);
});
