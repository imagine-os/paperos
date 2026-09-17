import { expect, test, type Browser, type Page } from "@playwright/test";
import { skipFirstRun } from "./helpers";

// Two browser contexts share one room through the local sync server that
// playwright.config.ts starts (tools/paperos-sync on 17334). No public
// signaling server is involved.
const SYNC = "ws://127.0.0.1:17334";

interface ApiShape {
  collab: {
    create(options?: { transport?: string; url?: string }): Promise<{
      room: string;
      status: string;
      link: string;
    }>;
    status(): { room: string | null; status: string; peers: number };
    participants(): { name: string; local: boolean; agent: boolean }[];
    setName(name: string): { name: string };
    leave(): { left: boolean };
  };
  windows: {
    list(): { id: string; kind: string; title: string }[];
    create(o: { kind: string; title?: string; content?: string }): {
      id: string;
    };
    focus(id: string): unknown;
  };
  files: {
    open(path: string): unknown;
    read(path: string): Promise<{ text: string }>;
  };
  canvas: { zoomTo(ids: string[]): unknown };
  projects: { current(): { id: string; name: string; source: string } | null };
}
type W = { paperos: ApiShape };

async function openPeer(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await skipFirstRun(page);
  await page.goto(url);
  await expect(page.getByTestId("topbar")).toBeVisible();
  await page.waitForFunction(
    () => !!(window as unknown as W).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
  return page;
}

/** Focuses the first editor window's CodeMirror through the API (windows may overlap). */
async function focusEditor(page: Page) {
  await page.waitForSelector(".cm-content", { timeout: 20000 });
  await page.evaluate(() => {
    const api = (window as unknown as W).paperos;
    const w = api.windows.list().find((x) => x.kind === "editor")!;
    api.windows.focus(w.id);
    api.canvas.zoomTo([w.id]);
    document
      .querySelector<HTMLElement>(`[data-shape-id="${w.id}"] .cm-content`)
      ?.focus();
  });
}

test("two browsers share a room: windows, files, cursors and participants", async ({
  browser,
}) => {
  const a = await openPeer(browser, "/app");
  await a.evaluate(() =>
    (window as unknown as W).paperos.collab.setName("Ada")
  );
  const room = await a.evaluate(
    (sync) =>
      (window as unknown as W).paperos.collab.create({
        transport: "websocket",
        url: sync,
      }),
    SYNC
  );
  expect(room.room).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  expect(room.status).toBe("connected");
  expect(room.link).toContain(`/app?room=${room.room}`);
  await expect(a.getByTestId("share-button")).toHaveAttribute(
    "data-status",
    "connected"
  );
  await a.evaluate(() =>
    (window as unknown as W).paperos.windows.create({
      kind: "note",
      title: "Shared note",
      content: "hello from Ada",
    })
  );

  // B joins through the link and adopts the room's canvas and project.
  const b = await openPeer(
    browser,
    `/app?room=${room.room}&sync=${encodeURIComponent(SYNC)}`
  );
  await b.evaluate(() =>
    (window as unknown as W).paperos.collab.setName("Bob")
  );
  await b.waitForFunction(
    () =>
      (window as unknown as W).paperos.collab.status().status === "connected",
    null,
    { timeout: 30000 }
  );
  await expect(
    b.locator(".pos-window[data-kind=note] .pos-window__title", {
      hasText: "Shared note",
    })
  ).toBeVisible({ timeout: 15000 });
  const projectA = await a.evaluate(() =>
    (window as unknown as W).paperos.projects.current()
  );
  const projectB = await b.evaluate(() =>
    (window as unknown as W).paperos.projects.current()
  );
  expect(projectB?.id).toBe(projectA?.id);
  expect(projectB?.source).toBe("room");

  // Both see each other.
  await a.waitForFunction(
    () => (window as unknown as W).paperos.collab.status().peers === 1,
    null,
    { timeout: 15000 }
  );
  const namesOnA = await a.evaluate(() =>
    (window as unknown as W).paperos.collab
      .participants()
      .map((p) => `${p.name}:${p.local}`)
  );
  expect(namesOnA).toEqual(["Ada:true", "Bob:false"]);
  await expect(a.getByTestId("share-button")).toContainText("Share · 2");

  // The Share window lists the room, its link and the participants.
  await a.getByTestId("share-button").click();
  const share = a.getByTestId("share-window");
  await expect(share).toBeVisible();
  await expect(a.getByTestId("share-room-id")).toHaveText(room.room);
  await expect(a.getByTestId("share-link")).toHaveValue(room.link);
  await expect(a.getByTestId("share-participant")).toHaveCount(2);
  await expect(a.getByTestId("share-status")).toContainText(
    "Connected · 1 peer"
  );
  await expect(a.getByTestId("share-status")).toContainText("Sync server");

  // An edit in A's editor shows up in B's editor on the same file, with A's cursor.
  await a.evaluate(() =>
    (window as unknown as W).paperos.files.open("index.html")
  );
  await b.evaluate(() =>
    (window as unknown as W).paperos.files.open("index.html")
  );
  await focusEditor(a);
  await focusEditor(b);
  await a.keyboard.press("Control+Home");
  await a.keyboard.type("<!-- typed by Ada -->");
  await expect(b.locator(".cm-content").first()).toContainText("typed by Ada", {
    timeout: 15000,
  });
  await expect(b.locator(".cm-ySelectionCaret").first()).toBeVisible();
  // Both backends follow the shared buffer.
  await expect
    .poll(
      async () =>
        (
          await b.evaluate(() =>
            (window as unknown as W).paperos.files.read("index.html")
          )
        ).text,
      { timeout: 10000 }
    )
    .toContain("typed by Ada");

  // The title-bar chip on A's editor shows Bob (he focuses the same file).
  await expect(
    a
      .locator(".pos-window[data-kind=editor] [data-testid=window-peers]")
      .first()
  ).toContainText("B", { timeout: 15000 });

  // B leaves: A is alone again, B keeps its copy of the canvas.
  await b.evaluate(() => (window as unknown as W).paperos.collab.leave());
  await a.waitForFunction(
    () => (window as unknown as W).paperos.collab.status().peers === 0,
    null,
    { timeout: 15000 }
  );
  await expect(b.getByTestId("share-button")).toHaveAttribute(
    "data-status",
    "off"
  );
  const bWindows = await b.evaluate(() =>
    (window as unknown as W).paperos.windows.list().map((w) => w.title)
  );
  expect(bWindows).toContain("Shared note");
  await a.context().close();
  await b.context().close();
});
