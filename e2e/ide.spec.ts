import { expect, test, type Page } from "@playwright/test";
import { skipWelcome } from "./helpers";

async function waitForIde(page: Page) {
  await skipWelcome(page);
  await page.goto("/app");
  await expect(page.locator(".pos-window[data-kind=files]")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".pos-editor__host .cm-content")).toContainText(
    "Hello, PaperOS",
    { timeout: 20000 }
  );
}

test("first run opens the sample project in the IDE workspace", async ({
  page,
}) => {
  await waitForIde(page);
  const kinds = await page
    .locator(".pos-window")
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.kind).sort()
    );
  expect(kinds).toEqual(["console", "editor", "files", "preview"]);
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(4);
  await expect(page.getByTestId("file-tree")).toContainText("index.html");
  await expect(page.getByTestId("file-tree")).toContainText("README.md");
  // The sample's app.js logs on load; the console shows it.
  await expect(page.getByTestId("console-list")).toContainText(
    "Hello from app.js",
    { timeout: 10000 }
  );
});

test("clicking a file opens an editor window next to Files", async ({
  page,
}) => {
  await waitForIde(page);
  await page.locator(".pos-files__row", { hasText: "styles.css" }).click();
  const editors = page.locator(".pos-window[data-kind=editor]");
  await expect(editors).toHaveCount(2);
  const stylesWindow = editors.filter({
    has: page.locator(".pos-window__title", { hasText: "styles.css" }),
  });
  await expect(stylesWindow).toHaveAttribute("data-tiled", "true");
  await expect(stylesWindow.locator(".cm-content")).toContainText(
    "color-scheme",
    { timeout: 10000 }
  );
  // Clicking again reuses the window.
  await page.locator(".pos-files__row", { hasText: "styles.css" }).click();
  await expect(editors).toHaveCount(2);
});

test("editing index.html updates the preview and Ctrl+S saves", async ({
  page,
}) => {
  await waitForIde(page);
  const frame = page.frameLocator("iframe.pos-preview__frame");
  await expect(frame.locator("h1")).toHaveText("Hello, PaperOS", {
    timeout: 10000,
  });

  await page
    .locator(".cm-line", { hasText: "<h1>Hello, PaperOS</h1>" })
    .click();
  await page.keyboard.press("End");
  await page.keyboard.type('<p class="live">Live edit</p>');
  await expect(frame.locator("p.live")).toHaveText("Live edit", {
    timeout: 5000,
  });
  const title = page.locator(
    ".pos-window[data-kind=editor] .pos-window__title"
  );
  await expect(title).toContainText("●");

  await page.keyboard.press("Control+s");
  await expect(title).not.toContainText("●");
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  // The saved content survives a reload (tldraw persists on a throttle; wait for it).
  await page.waitForTimeout(800);
  await page.reload();
  await waitForIde(page);
  await expect(page.locator(".pos-editor__host .cm-content")).toContainText(
    "Live edit"
  );
});

test("console shows preview logs and runs snippets", async ({ page }) => {
  await waitForIde(page);
  await expect(page.getByTestId("console-list")).toContainText(
    "Hello from app.js",
    { timeout: 10000 }
  );
  await page.getByTestId("console-input").click();
  await page.keyboard.type("1 + 41");
  await page.keyboard.press("Enter");
  await expect(
    page.locator('.pos-console__entry[data-level="result"]')
  ).toContainText("42");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".pos-console__entry")).toHaveCount(0);
});

test("Ctrl+K opens the command palette and runs a command", async ({
  page,
}) => {
  await waitForIde(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.keyboard.type("toggle theme");
  await expect(page.getByTestId("palette-item").first()).toContainText(
    "Toggle light / dark theme"
  );
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("command-palette")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    /dark|light/
  );

  // Open a file by name.
  await page.keyboard.press("Control+k");
  await page.keyboard.type("readme");
  await expect(page.getByTestId("palette-item").first()).toContainText(
    "README.md"
  );
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".pos-window[data-kind=editor]", {
      has: page.locator(".pos-window__title", { hasText: "README.md" }),
    })
  ).toBeVisible();
});

test("markdown window renders README.md and the file context menu works", async ({
  page,
}) => {
  await waitForIde(page);
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId("new-window-markdown").click();
  await expect(page.locator(".pos-markdown__body h1")).toHaveText(
    "Sample site",
    { timeout: 10000 }
  );

  await page
    .locator(".pos-files__row", { hasText: "app.js" })
    .click({ button: "right" });
  const menu = page.getByTestId("file-context-menu");
  await expect(menu).toBeVisible();
  await expect(menu).toContainText("Rename...");
  page.once("dialog", (d) => d.accept("notes.txt"));
  await menu.getByRole("menuitem", { name: "New file..." }).click();
  await expect(page.getByTestId("file-tree")).toContainText("notes.txt");
  await expect(
    page.locator(".pos-window[data-kind=editor]", {
      has: page.locator(".pos-window__title", { hasText: "notes.txt" }),
    })
  ).toBeVisible();
});
