import { expect, test } from "@playwright/test";
import { skipFirstRun } from "./helpers";

test("first run shows the welcome tour once; it frames the top bar, opens a board and ends on the SaaS sample", async ({
  page,
}) => {
  await page.goto("/app");
  const caption = page.getByTestId("tour-caption");
  await expect(caption).toBeVisible({ timeout: 30000 });
  await expect(caption).toContainText("Welcome to PaperOS");
  await expect(caption).toContainText("1 / 8");
  await expect(caption).toContainText("Everything is a window");
  // The IDE workspace is behind it.
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(4, {
    timeout: 20000,
  });

  // Step 2 frames the Open menu button.
  await page.getByTestId("tour-next").click();
  await expect(caption).toContainText("2 / 8");
  const highlight = page.getByTestId("tour-highlight");
  await expect(highlight).toHaveAttribute("data-target", "chrome");
  const open = (await page.getByTestId("open-menu").boundingBox())!;
  // The frame animates into place (120 ms), so poll.
  await expect
    .poll(async () => {
      const box = (await highlight.boundingBox())!;
      return (
        box.x <= open.x &&
        box.x + box.width >= open.x + open.width &&
        box.y <= open.y &&
        box.y + box.height >= open.y + open.height
      );
    })
    .toBe(true);
  // The framed button still works while the tour is up.
  await page.getByTestId("open-menu").click();
  await expect(page.getByTestId("open-sample")).toBeVisible();
  await page.getByTestId("open-menu").click();
  await expect(page.getByTestId("open-sample")).toHaveCount(0);

  // Step 6 opens the "Build a product" board and frames its first section.
  for (let i = 0; i < 4; i++) await page.getByTestId("tour-next").click();
  await expect(caption).toContainText("6 / 8");
  await expect(caption).toContainText("Boards tell a story");
  await expect(page.locator(".tl-shape[data-shape-type=frame]")).toHaveCount(
    6,
    { timeout: 20000 }
  );
  await expect(highlight).toHaveAttribute("data-target", "section", {
    timeout: 15000,
  });

  // Step 7 draws the Data lineage.
  await page.getByTestId("tour-next").click();
  await expect(caption).toContainText("Data lineage");
  await expect(page.getByTestId("lineage-window")).toBeVisible({
    timeout: 20000,
  });

  // The last step offers the SaaS sample.
  await page.getByTestId("tour-next").click();
  await expect(caption).toContainText("8 / 8");
  await expect(page.getByTestId("tour-action")).toHaveText(
    "Open the Small Business SaaS sample"
  );
  await page.getByTestId("tour-action").click();
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);
  await expect(page.getByTestId("project-switcher")).toContainText(
    "Small Business SaaS",
    { timeout: 30000 }
  );

  // Never again on reload.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.locator(".tl-canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);

  // "Take the tour" replays it from the About menu.
  await page.getByTestId("about-menu").click();
  await page.getByTestId("about-tour").click();
  await expect(caption).toContainText("1 / 8");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);
});

test("an empty canvas shows the Start here card; Play a board plays Build a product", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/app");
  const card = page.getByTestId("start-here");
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card).toContainText("Start here");
  await page.getByTestId("start-board").click();
  await expect(page.getByTestId("tour-caption")).toContainText(
    "Build a product",
    { timeout: 30000 }
  );
  await expect(card).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);
  expect(await page.locator(".pos-window").count()).toBeGreaterThan(5);
  // Still hidden: the board's windows are on the canvas.
  await expect(card).toHaveCount(0);
});

test("Open sample from the Start here card tiles the IDE workspace", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/app");
  await page.getByTestId("start-sample").click({ timeout: 20000 });
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(4, {
    timeout: 20000,
  });
  await expect(page.getByTestId("start-here")).toHaveCount(0);
});

test("? opens the keyboard map, generated from the registries and searchable", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/app");
  await expect(page.locator(".tl-canvas")).toBeVisible();
  const canvas = (await page.locator(".tl-canvas").boundingBox())!;
  await page.mouse.click(canvas.x + 40, canvas.y + canvas.height / 2);
  await page.keyboard.press("?");
  const keys = page.getByTestId("keys-window");
  await expect(keys).toBeVisible();
  await expect(keys.getByTestId("keys-group-layouts")).toContainText(
    "Layout: Columns"
  );
  await expect(keys.getByTestId("keys-group-layouts")).toContainText("Alt");
  await expect(keys.getByTestId("keys-group-windows")).toContainText(
    "Focus window left"
  );
  await expect(keys.getByTestId("keys-group-canvas")).toContainText("Undo");
  await expect(keys.getByTestId("keys-group-editors")).toContainText(
    "Save the file"
  );
  await expect(keys.getByTestId("keys-group-terminal")).toContainText(
    "Complete a command"
  );
  // Every palette command with a shortcut is listed.
  const shortcuts = await page.evaluate(() =>
    (
      window as unknown as {
        paperos: {
          commands: { list(): { title: string; shortcut?: string }[] };
        };
      }
    ).paperos.commands
      .list()
      .filter((c) => c.shortcut)
      .map((c) => c.title)
  );
  expect(shortcuts.length).toBeGreaterThan(5);
  for (const title of shortcuts) await expect(keys).toContainText(title);
  await keys.getByTestId("keys-search").fill("swap");
  await expect(keys.locator("tbody tr")).toHaveCount(4);
  await keys.getByTestId("keys-search").fill("zzzz");
  await expect(keys).toContainText("No shortcut matches");
  // The palette opens it too (one window, reused).
  await page.getByTestId("palette-button").click();
  await page
    .getByPlaceholder("Type a command or file name...")
    .fill("keyboard shortcuts");
  await page.getByTestId("palette-item").first().click();
  await expect(page.getByTestId("keys-window")).toHaveCount(1);
});

test("empty states offer one-click fixes: a first table and an index.html", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/app");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await page.waitForFunction(
    () =>
      !!(
        window as unknown as { paperos?: { projects: { current(): unknown } } }
      ).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
  // Strip the sample of its data model and its HTML entry.
  await page.evaluate(async () => {
    const api = (
      window as unknown as {
        paperos: {
          files: { delete(path: string): Promise<unknown> };
          windows: {
            create(spec: {
              kind: string;
              rect: { x: number; y: number; w: number; h: number };
            }): { id: string };
          };
        };
      }
    ).paperos;
    await api.files.delete("data");
    await api.files.delete("index.html");
    api.windows.create({
      kind: "data",
      rect: { x: 40, y: 120, w: 620, h: 420 },
    });
    api.windows.create({
      kind: "preview",
      // Right of where "Create a data model" opens the Schema window.
      rect: { x: 1040, y: 120, w: 380, h: 400 },
    });
  });
  // Deselect so no resize handle sits over a button.
  await page.keyboard.press("Escape");
  const data = page.locator('.pos-window[data-kind="data"]');
  await expect(data.getByTestId("data-create-schema")).toBeVisible({
    timeout: 15000,
  });
  await data.getByTestId("data-create-schema").click();
  await expect(data.getByTestId("data-add-table")).toBeVisible({
    timeout: 15000,
  });
  await data.getByTestId("data-add-table").click();
  await expect(data.getByTestId("data-table-items")).toBeVisible({
    timeout: 15000,
  });
  await expect(data.getByTestId("data-row")).toHaveCount(2);

  const preview = page.locator('.pos-window[data-kind="preview"]');
  await expect(preview.getByTestId("preview-create-index")).toBeVisible({
    timeout: 15000,
  });
  await preview.getByTestId("preview-create-index").click();
  await expect(
    preview.frameLocator("iframe.pos-preview__frame").locator("h1")
  ).toHaveText("Hello from PaperOS", { timeout: 15000 });
});
