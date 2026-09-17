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

test("the sample ships three boards; 'Build a product' opens as sections with arrows and no overlaps", async ({
  page,
}) => {
  await skipFirstRun(page);
  await waitForProject(page);
  const names = await page.evaluate(async () =>
    (await (window as unknown as W).paperos.boards.list())
      .map((b) => b.name)
      .sort()
  );
  expect(names).toEqual(["agent-driven", "build-product", "ship-feature"]);

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
