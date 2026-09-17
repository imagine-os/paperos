import { expect, test, type Page } from "@playwright/test";
import { skipFirstRun } from "./helpers";

// page.evaluate callbacks run in the browser without this module's scope,
// so each one casts window.paperos itself.
interface ApiShape {
  browser: {
    open(options?: { url?: string }): { id: string; tabs: { url: string }[] };
    navigate(url: string, id?: string): { tabs: { url: string }[] };
    back(id?: string): { tabs: { url: string; canGoBack: boolean }[] };
    tabs(): unknown[];
    bookmarks(): Promise<{ title: string; url: string }[]>;
  };
  projects: { current(): unknown };
}
type W = { paperos: ApiShape };

async function openApp(page: Page) {
  await skipFirstRun(page);
  await page.goto("/app");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await page.waitForFunction(
    () => !!(window as unknown as W).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
}

test("the Browser window shows the project preview, opens tabs, keeps bookmarks and browses the docs", async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId("new-window-browser").click();
  const browser = page.getByTestId("browser-window");
  await expect(browser).toBeVisible();

  // The address bar takes an internal preview address; the sample renders.
  const address = page.getByTestId("browser-address");
  await address.click();
  await address.fill("paperos://preview/index.html");
  await address.press("Enter");
  await expect(browser).toHaveAttribute("data-target", "preview");
  const frame = browser.frameLocator("iframe.pos-browser__frame");
  await expect(frame.locator("h1")).toHaveText("Hello, PaperOS", {
    timeout: 15000,
  });
  await expect(page.getByTestId("browser-tab")).toHaveCount(1);
  await expect(page.getByTestId("browser-tab").first()).toContainText(
    "Preview: index.html"
  );

  // Second tab: the bundled docs render and link to each other.
  await page.getByTestId("browser-new-tab").click();
  await expect(page.getByTestId("browser-tab")).toHaveCount(2);
  await expect(page.getByTestId("browser-blank")).toBeVisible();
  await page.getByTestId("browser-go").click();
  await page.getByTestId("browser-doc-docs-MCP-md").click();
  await expect(browser).toHaveAttribute("data-target", "docs");
  const doc = browser.frameLocator("iframe.pos-browser__frame");
  await expect(doc.locator("h1")).toContainText("Agent bridge", {
    timeout: 15000,
  });
  await doc
    .locator('a[href="paperos://docs/docs/CANVAS_API.md"]')
    .first()
    .click();
  await expect(address).toHaveValue("paperos://docs/docs/CANVAS_API.md");
  await expect(doc.locator("h1")).toContainText("Canvas API", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(address).toHaveValue("paperos://docs/docs/MCP.md");

  // Bookmarks live in browser/bookmarks.json (the sample ships six; MCP.md is one).
  const bookmarks = await page.evaluate(() =>
    (window as unknown as W).paperos.browser.bookmarks()
  );
  expect(bookmarks.map((b) => b.title)).toContain("Preview");
  await expect(page.getByTestId("browser-bookmark")).toHaveText("★");
  await address.click();
  await address.fill("paperos://docs/docs/PLAN.md");
  await address.press("Enter");
  await expect(doc.locator("h1")).toContainText("PaperOS v2 plan", {
    timeout: 15000,
  });
  await expect(page.getByTestId("browser-bookmark")).toHaveText("☆");
  await page.getByTestId("browser-bookmark").click();
  await expect(page.getByTestId("browser-bookmark")).toHaveText("★");
  const after = await page.evaluate(() =>
    (window as unknown as W).paperos.browser.bookmarks()
  );
  expect(after).toHaveLength(bookmarks.length + 1);
  expect(after.at(-1)?.url).toBe("paperos://docs/docs/PLAN.md");

  // Closing the first tab leaves the docs tab.
  await page
    .getByTestId("browser-tab")
    .first()
    .getByRole("button", { name: /Close tab/ })
    .click();
  await expect(page.getByTestId("browser-tab")).toHaveCount(1);
  await expect(browser).toHaveAttribute("data-target", "docs");
});

test("a site that refuses embedding shows the card with a way out; the Canvas API drives the window", async ({
  page,
}) => {
  await openApp(page);
  const opened = await page.evaluate(() =>
    (window as unknown as W).paperos.browser.open({
      url: "https://github.com/imagine-os/paperos",
    })
  );
  expect(opened.tabs[0].url).toBe("https://github.com/imagine-os/paperos");
  const card = page.getByTestId("browser-refused");
  await expect(card).toBeVisible();
  await expect(card).toContainText("refuses to be embedded");
  await expect(
    card.getByRole("button", { name: "Open in new tab ↗" })
  ).toBeEnabled();
  await expect(card.getByRole("button", { name: "Try anyway" })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Screenshot via bridge" })
  ).toBeDisabled();

  const nav = await page.evaluate(() =>
    (window as unknown as W).paperos.browser.navigate("paperos://legacy")
  );
  expect(nav.tabs[0].url).toBe("paperos://legacy");
  await expect(page.getByTestId("browser-window")).toHaveAttribute(
    "data-target",
    "legacy"
  );
  const back = await page.evaluate(() =>
    (window as unknown as W).paperos.browser.back()
  );
  expect(back.tabs[0].url).toBe("https://github.com/imagine-os/paperos");
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as W).paperos.browser.tabs())
  ).toHaveLength(1);
});
