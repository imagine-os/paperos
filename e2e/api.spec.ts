import { expect, test, type Page } from "@playwright/test";
import { newNoteWindow, skipFirstRun } from "./helpers";

/** The Canvas API as the tests see it through `window.paperos`. */
interface ApiShape {
  windows: {
    list(): { id: string; kind: string; title: string; tiled: boolean }[];
  };
  layout: { getTree(): { preset: string; tiled: string[] } };
}
const api = () => (window as unknown as { paperos: ApiShape }).paperos;

async function openKind(page: Page, kind: string) {
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId(`new-window-${kind}`).click();
}

test("the script console creates and tiles three windows through the Canvas API", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await openKind(page, "script");
  const script = page.getByTestId("script-window");
  await expect(script.locator(".cm-content")).toBeVisible({ timeout: 15000 });

  await script.locator(".cm-content").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    [
      "const ids = [];",
      'for (const t of ["one", "two", "three"]) {',
      '  ids.push(paperos.windows.create({ kind: "note", title: t, content: t }).id);',
      "}",
      "paperos.layout.tile(ids);",
      'console.log("tiled", ids.length);',
      "return paperos.layout.getTree().preset;",
    ].join("\n")
  );
  await page.getByTestId("script-run").click();
  const output = page.getByTestId("script-output");
  await expect(output).toContainText("tiled 3");
  await expect(output.locator('[data-level="result"]')).toContainText(
    "columns"
  );
  await expect(page.getByTestId("script-status")).toContainText("Done");

  const notes = page.locator(".pos-window[data-kind=note]");
  await expect(notes).toHaveCount(3);
  await expect(
    page.locator('.pos-window[data-kind=note][data-tiled="true"]')
  ).toHaveCount(3);

  // The same API is on window.paperos for the devtools.
  const listed = await page.evaluate(() =>
    api()
      .windows.list()
      .map((w) => [w.kind, w.title, w.tiled])
  );
  expect(listed).toEqual(
    expect.arrayContaining([
      ["script", "Script", false],
      ["note", "one", true],
      ["note", "two", true],
      ["note", "three", true],
    ])
  );
  expect(await page.evaluate(() => api().layout.getTree().tiled.length)).toBe(
    3
  );

  // The script text survives a reload (it lives in the window's content prop).
  await page.waitForTimeout(800);
  await page.reload();
  await expect(
    page.getByTestId("script-window").locator(".cm-content")
  ).toContainText("paperos.layout.tile(ids)", { timeout: 15000 });
});

test("the clock plugin can be enabled and shows a window", async ({ page }) => {
  await skipFirstRun(page);
  await page.goto("/");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await openKind(page, "plugins");
  const plugins = page.getByTestId("plugins-window");
  await expect(plugins.locator('[data-plugin="builtin:clock"]')).toBeVisible();
  await expect(
    plugins.locator('[data-plugin="builtin:auto-tile"]')
  ).toBeVisible();
  await expect(plugins).toContainText("Permissions:");

  await plugins.getByTestId("plugin-toggle-clock").check();
  await expect(
    plugins.locator('[data-plugin="builtin:clock"]')
  ).toHaveAttribute("data-status", "active");
  // The new kind shows up in the New window menu and renders.
  await openKind(page, "clock");
  const clock = page.locator(".pos-window[data-kind=clock]");
  await expect(clock).toBeVisible();
  await expect(clock.getByTestId("clock-time")).toHaveText(/\d{1,2}:\d{2}/);

  // Enabled plugins are remembered.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(
    page.locator(".pos-window[data-kind=clock]").getByTestId("clock-time")
  ).toHaveText(/\d{1,2}:\d{2}/, { timeout: 15000 });
  // Disabling removes the kind again.
  await page
    .getByTestId("plugins-window")
    .getByTestId("plugin-toggle-clock")
    .uncheck();
  await expect(page.locator(".pos-window[data-kind=clock]")).toContainText(
    "Unknown window kind"
  );
});

test("window.paperos lists windows created from the UI", async ({ page }) => {
  await skipFirstRun(page);
  await page.goto("/");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await newNoteWindow(page);
  await expect(page.locator(".pos-window")).toHaveCount(1);
  const list = await page.evaluate(() => api().windows.list());
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ kind: "note", title: "Note", tiled: false });
});
