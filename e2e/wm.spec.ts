import { expect, test, type Page } from "@playwright/test";

async function boxes(page: Page) {
  const handles = await page.locator(".pos-window").all();
  const rects = [];
  for (const h of handles) {
    const b = await h.boundingBox();
    if (b) rects.push(b);
  }
  return rects;
}

function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: typeof a
) {
  return (
    a.x + a.width > b.x + 1 &&
    b.x + b.width > a.x + 1 &&
    a.y + a.height > b.y + 1 &&
    b.y + b.height > a.y + 1
  );
}

async function openWindows(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "New window" }).click();
  }
  await expect(page.getByTestId("window")).toHaveCount(count);
}

test("Columns tiles three windows side by side across the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await openWindows(page, 3);

  await page.getByTestId("layout-menu").click();
  await page.getByTestId("layout-columns").click();

  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(3);
  const rects = await boxes(page);
  expect(rects).toHaveLength(3);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(overlap(rects[i], rects[j])).toBe(false);
    }
  }
  // Same top and height, distinct columns spanning the canvas.
  const canvas = (await page.locator(".pos-canvas").boundingBox())!;
  const sorted = [...rects].sort((a, b) => a.x - b.x);
  for (const r of sorted) {
    expect(Math.abs(r.y - sorted[0].y)).toBeLessThan(2);
    expect(Math.abs(r.height - sorted[0].height)).toBeLessThan(2);
    expect(r.y).toBeGreaterThan(canvas.y);
    expect(r.y + r.height).toBeLessThan(canvas.y + canvas.height);
  }
  const span = sorted[2].x + sorted[2].width - sorted[0].x;
  expect(span).toBeGreaterThan(canvas.width * 0.9);
  expect(sorted[0].x).toBeGreaterThanOrEqual(canvas.x);
  expect(sorted[2].x + sorted[2].width).toBeLessThanOrEqual(
    canvas.x + canvas.width + 1
  );
  // Gutters appear between tiled columns.
  await expect(page.getByTestId("gutter")).toHaveCount(2);
});

test("Alt+3 applies Grid and Alt+1 frees the windows", async ({ page }) => {
  await page.goto("/");
  await openWindows(page, 4);
  const canvas = (await page.locator(".pos-canvas").boundingBox())!;
  await page.mouse.click(canvas.x + 40, canvas.y + canvas.height / 2);
  await page.keyboard.press("Alt+3");
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(4);
  const rects = await boxes(page);
  const ys = new Set(rects.map((r) => Math.round(r.y)));
  expect(ys.size).toBe(2);
  await page.keyboard.press("Alt+1");
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(0);
});

test("workspaces are saved, survive a reload and can be switched to", async ({
  page,
}) => {
  await page.goto("/");
  await openWindows(page, 3);
  await page.getByTestId("layout-menu").click();
  await page.getByTestId("layout-grid").click();
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(3);

  page.once("dialog", (d) => d.accept("Review"));
  await page.getByTestId("workspaces-menu").click();
  await page.getByTestId("workspace-save-as").click();
  await expect(page.getByTestId("workspaces-menu")).toContainText("Review");

  // Untile so switching has something visible to do.
  await page.getByTestId("layout-menu").click();
  await page.getByTestId("layout-free").click();
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("window")).toHaveCount(3);
  await page.getByTestId("workspaces-menu").click();
  const menu = page.getByTestId("workspaces-menu-menu");
  await expect(menu).toContainText("Desk");
  await expect(menu).toContainText("Grid");
  await menu.getByRole("menuitemradio", { name: "Review" }).click();
  await expect(page.locator('.pos-window[data-tiled="true"]')).toHaveCount(3);
  await expect(page.getByTestId("workspaces-menu")).toContainText("Review");
});

test("drag detaches a tiled window; drop swaps on center and inserts on edges", async ({
  page,
}) => {
  await page.goto("/");
  await openWindows(page, 3);
  await page.getByTestId("layout-menu").click();
  await page.getByTestId("layout-columns").click();
  const tiled = page.locator('.pos-window[data-tiled="true"]');
  const floating = page.locator('.pos-window[data-tiled="false"]');
  await expect(tiled).toHaveCount(3);

  // Drag the first column's title bar: past the threshold it floats and the others reflow.
  const first = page.locator(".pos-window").first();
  const bar = (await first.locator(".pos-window__titlebar").boundingBox())!;
  await page.mouse.move(bar.x + 40, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + 40, bar.y + 120, { steps: 8 });
  await expect(tiled).toHaveCount(2);
  await expect(floating).toHaveCount(1);
  await expect(page.getByTestId("gutter")).toHaveCount(1);

  // Hover the center of a tiled window: the hint shows the center zone.
  const target = (await tiled.last().boundingBox())!;
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 8 }
  );
  const hint = page.getByTestId("drop-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute("data-zone", "center");
  await page.mouse.up();
  // Swapped: the dragged window took the cell, the target now floats.
  await expect(tiled).toHaveCount(2);
  await expect(floating).toHaveCount(1);

  // Drag the floating window onto the left edge of a tiled one: it is inserted.
  const loose = (await floating
    .first()
    .locator(".pos-window__titlebar")
    .boundingBox())!;
  await page.mouse.move(loose.x + 40, loose.y + loose.height / 2);
  await page.mouse.down();
  const cell = (await tiled.first().boundingBox())!;
  await page.mouse.move(cell.x + 12, cell.y + cell.height / 2, { steps: 10 });
  await expect(hint).toHaveAttribute("data-zone", "left");
  await page.mouse.up();
  await expect(tiled).toHaveCount(3);
  await expect(floating).toHaveCount(0);
  await expect(page.getByTestId("gutter")).toHaveCount(2);
});
