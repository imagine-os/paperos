import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { skipWelcome } from "./helpers";

/**
 * axe-core over the landing page, the IDE workspace, a board, the Data
 * window and the Share window. Serious and critical findings in PaperOS's
 * own markup fail the test; tldraw's chrome (`.tlui-*`) is excluded because
 * it is not ours to fix, and findings inside preview iframes (the rendered
 * project) are reported but only fail when they are ours (the design system
 * components). Every run prints a summary of all impacts.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

interface Summary {
  page: string;
  violations: { id: string; impact: string; nodes: number; help: string }[];
}

const summaries: Summary[] = [];

async function audit(page: Page, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(TAGS)
    .exclude(".tlui-layout")
    .exclude(".tl-container [class^='tlui']")
    .analyze();
  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? "n/a",
    nodes: v.nodes.length,
    help: v.help,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  summaries.push({ page: name, violations });
  const blocking = violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  expect(
    blocking,
    `${name}: ${blocking.map((v) => `${v.id} (${v.nodes}) ${v.targets.join(" | ")}`).join("\n")}`
  ).toEqual([]);
}

test.afterAll(() => {
  const lines = ["axe-core summary (WCAG 2.1 A/AA, tldraw chrome excluded)"];
  for (const s of summaries) {
    lines.push(
      `- ${s.page}: ${s.violations.length === 0 ? "no violations" : s.violations.map((v) => `${v.impact} ${v.id} x${v.nodes}`).join(", ")}`
    );
  }
  console.log(lines.join("\n"));
});

test("landing page has no serious or critical axe findings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("landing-hero").waitFor();
  await audit(page, "/ (landing)");
});

test("desktop: IDE workspace, a board, the Data window and the Share window", async ({
  page,
}) => {
  await skipWelcome(page);
  await page.goto("/app");
  await page.locator(".pos-editor__host .cm-content").waitFor({
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await audit(page, "/app (IDE workspace)");

  await page.evaluate(() =>
    (
      window as unknown as { paperos: { boards: { open(n: string): unknown } } }
    ).paperos.boards.open("build-product")
  );
  await page.locator(".tl-shape[data-shape-type=frame]").nth(5).waitFor();
  await page.waitForTimeout(2500);
  await audit(page, "/app (board: Build a product)");

  await page.evaluate(() => {
    const api = (
      window as unknown as {
        paperos: {
          boards: { close?: unknown };
          windows: {
            list(): { id: string }[];
            close(id: string): unknown;
            create(spec: {
              kind: string;
              content?: string;
              rect: { x: number; y: number; w: number; h: number };
            }): { id: string };
          };
          canvas: {
            setCamera(c: { x: number; y: number; z: number }): unknown;
          };
        };
      }
    ).paperos;
    for (const w of api.windows.list()) api.windows.close(w.id);
    api.canvas.setCamera({ x: 0, y: 0, z: 1 });
    api.windows.create({
      kind: "data",
      content: JSON.stringify({ table: "menu_items" }),
      rect: { x: 40, y: 100, w: 860, h: 480 },
    });
  });
  await page.getByTestId("data-row").first().waitFor({ timeout: 20000 });
  await audit(page, "/app (Data window)");

  await page.evaluate(() => {
    const api = (
      window as unknown as {
        paperos: {
          windows: {
            list(): { id: string }[];
            close(id: string): unknown;
            create(spec: {
              kind: string;
              rect: { x: number; y: number; w: number; h: number };
            }): { id: string };
          };
        };
      }
    ).paperos;
    for (const w of api.windows.list()) api.windows.close(w.id);
    api.windows.create({
      kind: "share",
      rect: { x: 40, y: 100, w: 440, h: 560 },
    });
  });
  await page.getByTestId("share-window").waitFor({ timeout: 20000 });
  await audit(page, "/app (Share window)");
});

test("keyboard: Tab walks the top bar in order; menus open with Enter, arrows move, Escape returns focus", async ({
  page,
}) => {
  await skipWelcome(page);
  await page.addInitScript(() =>
    localStorage.setItem("paperos-v2:ide-initialized", "test")
  );
  await page.goto("/app");
  await expect(page.getByTestId("open-menu")).toBeEnabled();
  await page.getByTestId("open-menu").focus();
  const order: string[] = [];
  for (let i = 0; i < 6; i++) {
    order.push(
      await page.evaluate(
        () =>
          (document.activeElement as HTMLElement)?.dataset.testid ??
          (document.activeElement as HTMLElement)?.textContent?.trim() ??
          ""
      )
    );
    await page.keyboard.press("Tab");
  }
  expect(order.slice(0, 5)).toEqual([
    "open-menu",
    "layout-menu",
    "workspaces-menu",
    "boards-menu",
    "new-window-menu",
  ]);
  // Enter opens the menu and focus lands on its first item.
  await page.getByTestId("layout-menu").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("layout-free")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("layout-columns")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("layout-free")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layout-menu-menu")).toHaveCount(0);
  await expect(page.getByTestId("layout-menu")).toBeFocused();
  // A visible focus ring on the focused control.
  const outline = await page
    .getByTestId("layout-menu")
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});
