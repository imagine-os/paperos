import { expect, test, type Page } from "@playwright/test";
import { skipFirstRun } from "./helpers";

/** The Canvas API as these tests read it through `window.paperos`. */
interface ApiShape {
  windows: {
    create(o: {
      kind: string;
      title?: string;
      content?: string;
      rect?: { x: number; y: number; w: number; h: number };
    }): { id: string };
    list(): {
      id: string;
      kind: string;
      title: string;
      section?: string | null;
    }[];
  };
  flow: {
    list(): {
      id: string;
      from: string | null;
      to: string | null;
      label: string;
    }[];
  };
  sections: { list(): { id: string; title: string; windowIds: string[] }[] };
}

async function waitForIde(page: Page) {
  await expect(page.locator(".pos-window[data-kind=files]")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".pos-editor__host .cm-content")).toContainText(
    "Hello, PaperOS",
    { timeout: 20000 }
  );
}

async function openKind(page: Page, kind: string) {
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId(`new-window-${kind}`).click();
}

test("the Design window shows the gallery and a token change recolors the preview", async ({
  page,
}) => {
  await page.goto("/app");
  await waitForIde(page);
  const preview = page.frameLocator("iframe.pos-preview__frame");
  await expect(preview.locator("h1")).toHaveText("Hello, PaperOS", {
    timeout: 15000,
  });
  await expect
    .poll(async () =>
      preview.locator("h1").evaluate((el) => getComputedStyle(el).color)
    )
    .toBe("rgb(37, 99, 235)");

  await openKind(page, "design");
  const design = page.getByTestId("design-window");
  await expect(design.getByTestId("tokens-panel")).toBeVisible({
    timeout: 15000,
  });
  await expect(design.getByTestId("token-text-primary-light")).toHaveValue(
    "#2563eb"
  );
  // The token preview renders components from the current tokens.
  const tokenPreview = design.frameLocator('[data-testid="tokens-preview"]');
  await expect(tokenPreview.locator(".ds-button--primary").first()).toBeVisible(
    {
      timeout: 15000,
    }
  );

  await design.getByTestId("token-text-primary-light").fill("#ff0000");
  // The write goes to design/tokens.json; the site's styles.css reads --ds-color-primary.
  await expect
    .poll(
      async () =>
        preview.locator("h1").evaluate((el) => getComputedStyle(el).color),
      { timeout: 15000 }
    )
    .toBe("rgb(255, 0, 0)");
  await expect
    .poll(async () =>
      tokenPreview
        .locator(".ds-button--primary")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    )
    .toBe("rgb(255, 0, 0)");

  await design.getByTestId("design-tab-components").click();
  const gallery = design.frameLocator('[data-testid="component-gallery"]');
  await expect(gallery.getByTestId("gallery-Badge")).toBeVisible({
    timeout: 15000,
  });
  await expect(gallery.getByTestId("gallery-Table")).toBeVisible();
  await expect(gallery.locator(".gallery__item")).toHaveCount(14);
  await design.getByTestId("component-Card").click();
  await expect(design.getByTestId("component-inspector")).toContainText("Card");
  await expect(gallery.locator(".ds-card__title")).toHaveText("Card title", {
    timeout: 10000,
  });
});

test("the Page Builder adds a component and the device preview shows it", async ({
  page,
}) => {
  await page.goto("/app");
  await waitForIde(page);
  await openKind(page, "pages");
  const builder = page.getByTestId("pages-window");
  await expect(builder.getByTestId("page-products")).toBeVisible({
    timeout: 15000,
  });
  await builder.getByTestId("page-products").click();
  const frame = builder.frameLocator('[data-testid="page-preview"]');
  await expect(frame.locator(".ds-hero__title")).toHaveText("Products", {
    timeout: 15000,
  });
  await expect(frame.locator(".ds-table tbody tr")).toHaveCount(4);

  await builder.getByTestId("add-block").click();
  await builder.getByTestId("add-block-Badge").click();
  await expect(
    builder.locator(".pos-block", { hasText: "Badge" })
  ).toBeVisible();
  await expect(builder.getByTestId("page-inspector")).toContainText("Badge");
  await expect(frame.locator(".ds-badge")).toHaveText("New", {
    timeout: 10000,
  });
  // Edit a prop in the inspector: the preview follows and the file holds it.
  await builder.getByTestId("prop-text").fill("Hot");
  await expect(frame.locator(".ds-badge")).toHaveText("Hot", {
    timeout: 10000,
  });
  await builder.getByTestId("device-mobile").click();
  await expect(builder.locator(".pos-pages__preview")).toHaveAttribute(
    "data-device",
    "mobile"
  );
  await expect(frame.locator(".ds-badge")).toHaveText("Hot");
  const saved = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        paperos: { files: { read(p: string): Promise<{ text: string }> } };
      }
    ).paperos;
    return (await api.files.read("pages/products.json")).text;
  });
  expect(saved).toContain('"name": "Badge"');
  expect(saved).toContain('"text": "Hot"');
});

test("map.generate from the Script window builds sections, cards and arrows", async ({
  page,
}) => {
  await page.goto("/app");
  await waitForIde(page);
  await openKind(page, "script");
  const script = page.getByTestId("script-window");
  await expect(script.locator(".cm-content")).toBeVisible({ timeout: 15000 });
  await script.locator(".cm-content").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    [
      "const map = await paperos.map.generate();",
      'console.log("map", map.sections, map.nodes, map.edges);',
      "return map.workspace.name;",
    ].join("\n")
  );
  await page.getByTestId("script-run").click();
  await expect(page.getByTestId("script-output")).toContainText("map 6 32 49", {
    timeout: 20000,
  });
  await expect(
    page.getByTestId("script-output").locator('[data-level="result"]')
  ).toContainText("Map");
  await expect(page.locator(".tl-shape[data-shape-type=frame]")).toHaveCount(6);
  await expect(page.locator(".pos-window[data-kind=card]")).toHaveCount(32);
  await expect(page.locator(".tl-shape[data-shape-type=arrow]")).toHaveCount(
    49
  );
  const sections = await page.evaluate(() =>
    (window as unknown as { paperos: ApiShape }).paperos.sections
      .list()
      .map((s) => [s.title, s.windowIds.length])
      .sort()
  );
  expect(sections).toEqual([
    ["Code", 5],
    ["Components", 16],
    ["Data", 4],
    ["Design", 1],
    ["Pages", 3],
    ["UX flows", 3],
  ]);
  // A card opens the real thing (the table card, not the component that reads it).
  const card = page.locator('.pos-card[data-key="table:menu_items"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByTestId("card-open").click();
  await expect(page.locator(".pos-window[data-kind=data]")).toHaveCount(1, {
    timeout: 10000,
  });
  await expect(page.getByTestId("data-table-menu_items")).toBeVisible({
    timeout: 10000,
  });
});

test("an arrow can be drawn between two windows with the connect handle", async ({
  page,
}) => {
  await skipFirstRun(page);
  await page.goto("/app");
  await expect(page.locator(".tl-canvas")).toBeVisible();
  const ids = await page.evaluate(() => {
    const api = (window as unknown as { paperos: ApiShape }).paperos;
    const a = api.windows.create({
      kind: "note",
      title: "Alpha",
      content: "a",
      rect: { x: 100, y: 120, w: 300, h: 200 },
    });
    const b = api.windows.create({
      kind: "note",
      title: "Beta",
      content: "b",
      rect: { x: 700, y: 320, w: 300, h: 200 },
    });
    return [a.id, b.id];
  });
  const handle = page
    .locator(".pos-window", { hasText: "Alpha" })
    .getByTestId("window-connect");
  const from = (await handle.boundingBox())!;
  const to = (await page
    .locator(".pos-window", { hasText: "Beta" })
    .locator(".pos-window__titlebar")
    .boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 120, { steps: 5 });
  await page.mouse.move(to.x + 80, to.y + 12, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".tl-shape[data-shape-type=arrow]")).toHaveCount(1);
  const flows = await page.evaluate(() =>
    (window as unknown as { paperos: ApiShape }).paperos.flow.list()
  );
  expect(flows).toHaveLength(1);
  expect(flows[0].from).toBe(ids[0]);
  expect(flows[0].to).toBe(ids[1]);
  // The arrow follows its windows.
  const before = (await page
    .locator(".tl-shape[data-shape-type=arrow]")
    .boundingBox())!;
  await page.evaluate((id) => {
    (
      window as unknown as {
        paperos: {
          windows: { move(id: string, x: number, y: number): unknown };
        };
      }
    ).paperos.windows.move(id, 900, 600);
  }, ids[1]);
  await expect
    .poll(
      async () =>
        (await page.locator(".tl-shape[data-shape-type=arrow]").boundingBox())!
          .height
    )
    .toBeGreaterThan(before.height + 100);
});
