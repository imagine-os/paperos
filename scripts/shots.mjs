// Landing screenshots: `npm run shots` drives the production build with
// Playwright and writes public/shots/<name>.webp (1600 wide) and
// <name>@2x.webp (3200 wide). Run `npm run build` first; the script starts
// `next start` on a spare port and stops it afterwards. Chromium must be
// available to Playwright (PLAYWRIGHT_BROWSERS_PATH or a prior install).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "shots");
const port = Number(process.env.SHOTS_PORT ?? 3411);
const base = process.env.SHOTS_BASE_URL ?? `http://localhost:${port}`;
const WIDTH = 1600;
const HEIGHT = 1000;

/** The scenes, in carousel order. Each returns when the page is ready to shoot. */
const SCENES = [
  {
    name: "desktop-ide",
    title: "The desktop: Files, editor, preview and console tiled",
    async setup(page) {
      await page.goto(`${base}/app`);
      await page
        .locator(".pos-editor__host .cm-content")
        .waitFor({ timeout: 60000 });
      await page
        .getByTestId("console-list")
        .getByText("Hello from app.js")
        .waitFor({ timeout: 20000 });
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "board-build-product",
    title:
      "A board: data, schema, design, page builder and previews left to right",
    async setup(page) {
      await page.evaluate(() => paperos.boards.open("build-product"));
      // Let the board's own camera animation finish before reframing.
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        // The whole board is wide; frame the first four sections.
        const sections = paperos.sections
          .list()
          .sort((a, b) => a.x - b.x)
          .slice(0, 4)
          .map((s) => s.id);
        const windows = paperos.windows
          .list()
          .filter((w) => sections.includes(w.section))
          .map((w) => w.id);
        paperos.canvas.zoomTo(windows.length ? windows : sections);
      });
      await page.waitForTimeout(3500);
    },
  },
  {
    name: "data-lineage",
    title: "Data lineage: tables, components and pages with labeled arrows",
    async setup(page) {
      await page.evaluate(async () => {
        for (const w of paperos.windows.list()) paperos.windows.close(w.id);
        await paperos.lineage.open();
      });
      await page.waitForTimeout(2500);
    },
  },
  {
    name: "showcase-saas",
    title: "The Small Business SaaS sample and its showcase board",
    async setup(page) {
      await page.evaluate(async () => {
        for (const w of paperos.windows.list()) paperos.windows.close(w.id);
        await paperos.projects.open("saas");
        await paperos.boards.open("showcase");
      });
      await page.waitForTimeout(5000);
    },
  },
  {
    name: "share-window",
    title: "Share: a live room with cursors and shared files, no account",
    async setup(page) {
      await page.evaluate(() => {
        for (const w of paperos.windows.list()) paperos.windows.close(w.id);
        paperos.canvas.setCamera({ x: 0, y: 0, z: 1 });
        paperos.windows.create({
          kind: "share",
          rect: { x: 80, y: 90, w: 440, h: 560 },
        });
        paperos.windows.create({
          kind: "note",
          title: "Invite",
          content:
            "Create a room, copy the link, send it.\nEveryone sees the same windows and files;\ncursors and selections are live.",
          rect: { x: 580, y: 90, w: 420, h: 220 },
        });
        paperos.windows.create({
          kind: "preview",
          rect: { x: 580, y: 350, w: 900, h: 560 },
        });
        paperos.windows.create({
          kind: "editor",
          content: JSON.stringify({
            project: paperos.projects.current().id,
            path: "index.html",
          }),
          rect: { x: 1040, y: 90, w: 480, h: 220 },
        });
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(2500);
    },
  },
];

async function reachable(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await reachable(`${base}/app`)) return null;
  const next = path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next"
  );
  const child = spawn(next, ["start", "-p", String(port)], {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await reachable(`${base}/app`)) return child;
  }
  child.kill();
  throw new Error(
    `next start did not answer on ${base} (run npm run build first)`
  );
}

/** Re-encodes a PNG buffer as WebP at `width` through a canvas in the browser. */
async function toWebp(browser, png, width) {
  const page = await browser.newPage();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const result = await page.evaluate(
    async ([src, w]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = w / img.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.86);
    },
    [dataUrl, width]
  );
  await page.close();
  return Buffer.from(result.split(",")[1], "base64");
}

const server = await startServer();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
const page = await context.newPage();
await page.addInitScript(() =>
  localStorage.setItem("paperos-v2:welcome-seen", "shots")
);
const manifest = [];
try {
  for (const scene of SCENES) {
    await scene.setup(page);
    const png = await page.screenshot({ type: "png" });
    writeFileSync(
      path.join(out, `${scene.name}@2x.webp`),
      await toWebp(browser, png, WIDTH * 2)
    );
    writeFileSync(
      path.join(out, `${scene.name}.webp`),
      await toWebp(browser, png, WIDTH)
    );
    manifest.push({
      name: scene.name,
      title: scene.title,
      width: WIDTH,
      height: HEIGHT,
    });
    console.log(`shot ${scene.name}`);
  }
  writeFileSync(
    path.join(out, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
} finally {
  await browser.close();
  server?.kill();
}
console.log(`Wrote ${manifest.length} scenes to public/shots/`);
