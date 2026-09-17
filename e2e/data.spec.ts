import { expect, test, type FrameLocator, type Page } from "@playwright/test";
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

async function menusRendered(page: Page): Promise<FrameLocator> {
  const frame = page.frameLocator("iframe.pos-preview__frame");
  await expect(frame.locator("#side-menu li")).toHaveCount(11, {
    timeout: 15000,
  });
  return frame;
}

async function openKind(page: Page, kind: string) {
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId(`new-window-${kind}`).click();
}

test("the sample menus come from data and the Data window edits them live", async ({
  page,
}) => {
  await waitForIde(page);
  const frame = await menusRendered(page);
  await expect(frame.locator("#mega-menu .mega__col")).toHaveCount(4);
  await expect(frame.locator("#mega-menu img.mega__thumb")).toHaveCount(5);
  await expect(frame.locator("#role option")).toHaveText([
    "Admin",
    "Editor",
    "Viewer",
  ]);

  await openKind(page, "data");
  await page.getByTestId("data-table-menu_items").click();
  const rows = page.getByTestId("data-row");
  await expect(rows).toHaveCount(11);
  const first = page.locator('[data-testid=data-row][data-id="1"]');
  await expect(first.locator("img.pos-data__thumb")).toBeVisible();
  await expect(first.locator("[data-column=required_role]")).toContainText(
    "Viewer"
  );

  await first.locator("[data-column=label]").dblclick();
  await page.getByTestId("data-cell-editor").fill("Start here");
  await page.keyboard.press("Enter");
  await expect(first.locator("[data-column=label]")).toContainText(
    "Start here"
  );
  await expect(frame.locator("#side-menu li a span").first()).toHaveText(
    "Start here",
    { timeout: 5000 }
  );
  // The change went to the file the Files window shows.
  await page.locator(".pos-files__row", { hasText: "menu_items.json" }).click();
  await expect(
    page.locator(".pos-window[data-kind=editor]", {
      has: page.locator(".pos-window__title", { hasText: "menu_items.json" }),
    })
  ).toContainText("Start here", { timeout: 10000 });
});

test("switching the role in the page hides restricted menu items", async ({
  page,
}) => {
  await waitForIde(page);
  const frame = await menusRendered(page);
  await expect(frame.locator("#side-menu")).toContainText("Settings");
  await frame.locator("#role").selectOption({ label: "Viewer" });
  await expect(frame.locator("#side-menu li")).toHaveCount(7);
  await expect(frame.locator("#side-menu")).not.toContainText("Settings");
  await expect(frame.locator("#side-menu")).not.toContainText("Drafts");
  await expect(frame.locator("#mega-menu .mega__col")).toHaveCount(3);
  await frame.locator("#role").selectOption({ label: "Editor" });
  await expect(frame.locator("#side-menu li")).toHaveCount(8);
  await expect(frame.locator("#side-menu")).toContainText("Drafts");
});

test("Schema draws the tables and Connections links tables to components", async ({
  page,
}) => {
  await waitForIde(page);
  await openKind(page, "schema");
  const erd = page.getByTestId("schema-erd");
  await expect(erd.locator(".pos-erd__table")).toHaveCount(4);
  await expect(erd).toContainText("menu_items");
  await expect(erd.locator(".pos-erd__edge")).toHaveCount(4);

  await openKind(page, "connections");
  await page.getByTestId("connections-table-menu_items").click();
  const detail = page.getByTestId("connections-detail");
  await expect(detail).toContainText("components/side-menu.json");
  await expect(detail).toContainText("components/mega-menu.json");
  await expect(detail).toContainText("index.html:");
  await detail
    .getByTestId("connections-binding")
    .filter({ hasText: "side-menu.json" })
    .first()
    .click();
  await expect(
    page.locator(".pos-window[data-kind=editor]", {
      has: page.locator(".pos-window__title", { hasText: "side-menu.json" }),
    })
  ).toBeVisible();
  // Reverse direction: a page lists its tables (its own binding and its blocks' bindings).
  await page.getByTestId("connections-source-pages/home.json").click();
  await expect(detail).toContainText("roles");
  await expect(detail).toContainText("menu_items");
  await expect(detail).toContainText("MegaMenu");
});

test("the Data workspace tiles Files, Data, Schema, Connections and Preview", async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("paperos-v2:ide-initialized", "test");
      window.localStorage.setItem("paperos-v2:welcome-seen", "test");
    } catch {
      // Sandboxed preview frames have no storage.
    }
  });
  await page.goto("/app");
  await expect(page.locator(".tl-canvas")).toBeVisible();
  await page.getByTestId("workspaces-menu").click();
  await page.getByTestId("workspace-ws_data").click();
  const kinds = page.locator(".pos-window");
  await expect(kinds).toHaveCount(5, { timeout: 15000 });
  expect(
    (
      await kinds.evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).dataset.kind)
      )
    ).sort()
  ).toEqual(["connections", "data", "files", "preview", "schema"]);
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(5);
  await expect(page.getByTestId("data-table-menu_items")).toBeVisible({
    timeout: 15000,
  });
  // The Canvas API sees the same data.
  const top = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        paperos: {
          data: {
            list(t: string, o: object): Promise<{ rows: { label: string }[] }>;
          };
        };
      }
    ).paperos;
    const r = await api.data.list("menu_items", {
      filter: "parent_id=null",
      sort: "sort",
    });
    return r.rows.map((x) => x.label);
  });
  expect(top).toEqual(["Home", "Products", "Blog", "Admin", "Docs"]);
});
