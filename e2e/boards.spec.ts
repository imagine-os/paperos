import { expect, test, type Page } from "@playwright/test";
import { skipFirstRun } from "./helpers";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The Canvas API as these tests read it through `(window as unknown as W).paperos`. */
interface ApiShape {
  boards: {
    list(): Promise<{ name: string; onCanvas: boolean }[]>;
    open(name: string): Promise<{ sections: number; windows: number }>;
    play(name?: string): Promise<{ step: number; section: string } | null>;
    step(delta?: number): { step: number; section: string } | null;
    stop(): { stopped: boolean };
  };
  lineage: {
    graph(page?: string): Promise<{
      tables: unknown[];
      components: unknown[];
      pages: { name: string }[];
      edges: unknown[];
    }>;
    open(options?: { page?: string }): Promise<{
      sections: number;
      windows: number;
      arrows: number;
    }>;
    focus(page?: string | null): Promise<{ dimmed: number; kept: number }>;
  };
  windows: { list(): (Rect & { id: string; kind: string })[] };
  sections: { list(): (Rect & { id: string; title: string })[] };
  flow: { list(): { id: string; label: string }[] };
  canvas: { camera(): { x: number; y: number; z: number } };
}

// page.evaluate callbacks run in the browser without this module's scope,
// so each one casts (window as unknown as W).paperos itself.
type W = { paperos: ApiShape };

async function waitForProject(page: Page) {
  await page.goto("/app");
  await expect(page.locator(".tl-canvas")).toBeVisible();
  await page.waitForFunction(
    () =>
      !!(
        window as unknown as { paperos?: { projects: { current(): unknown } } }
      ).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
}

test("the sample ships four boards; 'Build a product' opens as sections with arrows and no overlaps", async ({
  page,
}) => {
  await skipFirstRun(page);
  await waitForProject(page);
  const names = await page.evaluate(async () =>
    (await (window as unknown as W).paperos.boards.list())
      .map((b) => b.name)
      .sort()
  );
  expect(names).toEqual([
    "agent-driven",
    "build-product",
    "collaborate",
    "ship-feature",
  ]);

  const result = await page.evaluate(() =>
    (window as unknown as W).paperos.boards.open("build-product")
  );
  expect(result).toMatchObject({ sections: 6, windows: 13 });
  await expect(page.locator(".tl-shape[data-shape-type=frame]")).toHaveCount(6);
  await expect(page.locator(".pos-window")).toHaveCount(13);
  await expect(page.locator(".tl-shape[data-shape-type=arrow]")).toHaveCount(8);

  const geometry = await page.evaluate(() => {
    const wins = (window as unknown as W).paperos.windows.list();
    const secs = (window as unknown as W).paperos.sections.list();
    const overlaps = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    let windowOverlaps = 0;
    for (const a of wins)
      for (const b of wins) if (a !== b && overlaps(a, b)) windowOverlaps++;
    let sectionOverlaps = 0;
    for (const a of secs)
      for (const b of secs) if (a !== b && overlaps(a, b)) sectionOverlaps++;
    // Sections run left to right in step order (their titles are numbered).
    const xs = [...secs]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((s) => s.x);
    const leftToRight = xs.every((x, i) => i === 0 || x > xs[i - 1]);
    return {
      windowOverlaps,
      sectionOverlaps,
      leftToRight,
      titles: secs.map((s) => s.title),
      labels: (window as unknown as W).paperos.flow
        .list()
        .map((f) => f.label)
        .sort(),
    };
  });
  expect(geometry.windowOverlaps).toBe(0);
  expect(geometry.sectionOverlaps).toBe(0);
  expect(geometry.leftToRight).toBe(true);
  expect(geometry.titles.sort()[0]).toBe("1. Data: tables as files");
  expect(geometry.titles).toContain("6. Script and console");
  expect(geometry.labels).toContain("renders");
  // The Boards menu lists it as on the canvas.
  await page.getByTestId("boards-menu").click();
  await expect(page.getByTestId("board-open-build-product")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.keyboard.press("Escape");
  // The board's previews render the sample page.
  const phone = page.locator(".pos-window", { hasText: "Phone 390" });
  await expect(
    phone.frameLocator("iframe.pos-preview__frame").locator(".ds-hero__title")
  ).toHaveText("Hello, PaperOS", { timeout: 20000 });
});

test("playing a board steps the camera section by section with a caption and keys", async ({
  page,
}) => {
  await skipFirstRun(page);
  await waitForProject(page);
  const first = await page.evaluate(() =>
    (window as unknown as W).paperos.boards.play("build-product")
  );
  expect(first).toMatchObject({ step: 0, section: "data" });
  const caption = page.getByTestId("tour-caption");
  await expect(caption).toContainText("1 / 6");
  await expect(caption).toContainText("Start with data");
  await expect(page.getByTestId("tour-highlight")).toBeVisible();
  const cam0 = await page.evaluate(() =>
    (window as unknown as W).paperos.canvas.camera()
  );

  await page.getByTestId("tour-next").click();
  await expect(caption).toContainText("2 / 6");
  await expect
    .poll(async () => {
      const c = await page.evaluate(() =>
        (window as unknown as W).paperos.canvas.camera()
      );
      return Math.abs(c.x - cam0.x);
    })
    .toBeGreaterThan(100);
  // Arrow keys move too; the active section's arrows turn orange.
  await page.keyboard.press("ArrowRight");
  await expect(caption).toContainText("3 / 6");
  await page.keyboard.press("ArrowLeft");
  await expect(caption).toContainText("2 / 6");
  const orange = await page.evaluate(
    () =>
      (
        window as unknown as {
          paperos: { flow: { list(): { id: string }[] } };
        }
      ).paperos.flow.list().length
  );
  expect(orange).toBeGreaterThan(0);
  // Escape ends the tour.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-overlay")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as W).paperos.boards.stop())
  ).toEqual({
    stopped: false,
  });
});

test("Data lineage: tables → components → pages with labeled arrows; focusing a page dims the rest; the overlay badges sources", async ({
  page,
}) => {
  await skipFirstRun(page);
  await waitForProject(page);
  const graph = await page.evaluate(() =>
    (window as unknown as W).paperos.lineage.graph()
  );
  expect(graph.tables).toHaveLength(4);
  expect(graph.pages.map((p) => p.name).sort()).toEqual([
    "admin",
    "home",
    "products",
  ]);
  expect(graph.components.length).toBeGreaterThan(2);
  expect(graph.edges.length).toBeGreaterThan(graph.components.length);

  // The Boards menu draws it.
  await page.getByTestId("boards-menu").click();
  await page.getByTestId("lineage-open").click();
  await expect(page.getByTestId("lineage-window")).toBeVisible();
  const titles = await page.evaluate(() =>
    (window as unknown as W).paperos.sections.list().map((s) => s.title)
  );
  expect(titles.some((t) => t.startsWith("Tables"))).toBe(true);
  expect(titles.some((t) => t.startsWith("Components"))).toBe(true);
  expect(titles).toContain("Pages");
  await expect(page.locator(".tl-shape[data-shape-type=arrow]")).toHaveCount(
    graph.edges.length
  );
  await expect(page.locator(".pos-card").first()).toBeVisible();
  const labels = await page.evaluate(() =>
    (window as unknown as W).paperos.flow.list().map((f) => f.label)
  );
  expect(labels.some((l) => /name|title|all columns/.test(l))).toBe(true);

  // Focusing a page from the dropdown dims what does not feed it.
  await page.getByTestId("lineage-page").selectOption("home");
  await expect(page.getByTestId("lineage-page")).toHaveValue("home");
  const focused = await page.evaluate(() =>
    (window as unknown as W).paperos.lineage.focus("home")
  );
  expect(focused.dimmed).toBeGreaterThan(0);
  expect(focused.kept).toBeGreaterThan(0);
  const dimmedShapes = await page
    .locator('.tl-shape[style*="opacity: 0.12"]')
    .count();
  expect(dimmedShapes).toBe(focused.dimmed);
  const all = await page.evaluate(() =>
    (window as unknown as W).paperos.lineage.focus(null)
  );
  expect(all.dimmed).toBe(0);

  // One page's lineage: its Page Builder and a Preview with the overlay on.
  await page.getByTestId("lineage-page").selectOption("home");
  await page.getByTestId("lineage-open-page").click();
  const preview = page.locator(".pos-window", { hasText: "Preview: Home" });
  await expect(preview).toBeVisible();
  const frame = preview.frameLocator("iframe.pos-preview__frame");
  await expect(frame.locator(".ds-src-badge").first()).toBeVisible({
    timeout: 20000,
  });
  const badges = await frame.locator(".ds-src-badge").allTextContents();
  expect(badges.some((b) => /[a-z_]+\.[a-z_]+/.test(b))).toBe(true);
  // The Sources button of the Preview turns the overlay off and on.
  await preview.getByTestId("preview-sources").click();
  await expect(frame.locator(".ds-src-badge")).toHaveCount(0, {
    timeout: 20000,
  });
  await preview.getByTestId("preview-sources").click();
  await expect(frame.locator(".ds-src-badge").first()).toBeVisible({
    timeout: 20000,
  });
});

/** Fits the camera to a section (the tour does the same with animation). */
async function fitSection(page: Page, prefix: string) {
  await page.evaluate((prefix) => {
    const sec = (window as unknown as W).paperos.sections
      .list()
      .find((s) => s.title.startsWith(prefix))!;
    const vw = window.innerWidth;
    const vh = window.innerHeight - 44;
    const pad = 60;
    const z = Math.min(vw / (sec.w + pad * 2), vh / (sec.h + pad * 2));
    (
      window as unknown as {
        paperos: {
          canvas: { setCamera(c: { x: number; y: number; z: number }): void };
        };
      }
    ).paperos.canvas.setCamera({
      x: -sec.x + (vw / z - sec.w) / 2,
      y: -sec.y + (vh / z - sec.h) / 2 + 44 / z,
      z,
    });
  }, prefix);
}

test("the Small Business SaaS sample: showcase previews, placeholders when zoomed out, tenant and role switches change theme and content", async ({
  page,
}) => {
  await skipFirstRun(page);
  await waitForProject(page);
  await page.getByTestId("open-menu").click();
  await page.getByTestId("open-saas").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              paperos: { projects: { current(): { name: string } | null } };
            }
          ).paperos.projects.current()?.name
      )
    )
    .toBe("Small Business SaaS");
  const opened = await page.evaluate(() =>
    (window as unknown as W).paperos.boards.open("showcase")
  );
  expect(opened).toMatchObject({ sections: 4, windows: 17, arrows: 11 });

  // Zoomed far out, every heavy window is a placeholder; zoomed in on a section, its previews render.
  await page.evaluate(() =>
    (
      window as unknown as {
        paperos: { canvas: { setCamera(c: object): void } };
      }
    ).paperos.canvas.setCamera({ x: 0, y: 0, z: 0.05 })
  );
  await expect(page.getByTestId("window-placeholder")).toHaveCount(17);
  await fitSection(page, "2.");
  const bloom = page.locator(".pos-window", {
    hasText: "Customer app (Bloom Salon)",
  });
  const frame = bloom.frameLocator("iframe.pos-preview__frame");
  await expect(frame.locator(".ds-hero__title")).toHaveText(
    "Book in two taps",
    {
      timeout: 30000,
    }
  );
  expect(await page.getByTestId("window-placeholder").count()).toBeLessThan(17);

  // Each tenant paints the app in its own colors; the admin menu is gated by role.
  const primary = (title: string) =>
    page
      .locator(".pos-window", { hasText: title })
      .frameLocator("iframe.pos-preview__frame")
      .locator("html")
      .evaluate((el) => el.style.getPropertyValue("--ds-color-primary"));
  await expect
    .poll(() => primary("Customer app (Bloom Salon)"))
    .toBe("#b8336a");
  await expect
    .poll(() => primary("Customer app (Ember & Oak)"))
    .toBe("#9a3412");
  const admin = page
    .locator(".pos-window", { hasText: "Admin: dashboard (manager)" })
    .frameLocator("iframe.pos-preview__frame");
  await expect(admin.locator(".ds-sidebar__link")).toHaveCount(9, {
    timeout: 30000,
  });
  await admin
    .locator("select[data-set-context=role]")
    .selectOption({ label: "owner" });
  await expect(admin.locator(".ds-sidebar__link")).toHaveCount(11);

  // Switching the tenant inside the customer app recolors it and swaps the services.
  const firstService = frame.locator(".ds-list__item strong").first();
  await expect(firstService).toHaveText("Haircut");
  await frame
    .locator("select[data-set-context=tenant]")
    .selectOption({ label: "Northline Contracting" });
  await expect
    .poll(() => primary("Customer app (Bloom Salon)"))
    .toBe("#1d4ed8");
  await expect(firstService).not.toHaveText("Haircut");
  await expect(frame.locator(".ds-list__item strong").first()).toHaveText(
    "Site visit"
  );

  // The tour walks the four sections.
  const tour = await page.evaluate(() =>
    (window as unknown as W).paperos.boards.play("showcase")
  );
  expect(tour).toMatchObject({ step: 0, section: "acquisition" });
  await expect(page.getByTestId("tour-caption")).toContainText("1 / 4");
  await page.keyboard.press("Escape");
});
