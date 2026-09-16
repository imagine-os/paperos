#!/usr/bin/env node
/**
 * End-to-end demo of the agent bridge, no vendor involved:
 *
 *   1. starts the MCP CLI (dist/index.js) over stdio, like Claude Desktop would
 *   2. opens PaperOS in a headless Chromium with ?bridge=1 (records a video)
 *   3. drives the canvas through MCP tool calls (windows_create, layout_apply,
 *      canvas_screenshot) and saves a screenshot + the video
 *
 * Usage (from the repo root, with `npm start` or `npm run dev` serving :3000):
 *   node tools/paperos-mcp/scripts/demo.mjs [outDir] [baseUrl]
 * Requires the root devDependencies (Playwright + a Chromium, see README).
 */
import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, "..", "demo-out"));
const baseUrl = process.argv[3] ?? "http://localhost:3000";
const port = Number(process.env.PAPEROS_BRIDGE_PORT ?? 7331);
mkdirSync(outDir, { recursive: true });

const log = (...a) => console.log("[demo]", ...a);

// 1. MCP client -> CLI over stdio.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(here, "..", "dist", "index.js"), "--port", String(port)],
  stderr: "pipe",
});
const client = new Client({ name: "paperos-demo", version: "0.1.0" });
await client.connect(transport);
transport.stderr?.on("data", (d) => process.stderr.write(`  [cli] ${d}`));
const { tools } = await client.listTools();
log(
  `${tools.length} MCP tools, e.g. ${tools
    .slice(0, 5)
    .map((t) => t.name)
    .join(", ")}`
);

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  if (res.isError) throw new Error(`${name}: ${text}`);
  log(
    `${name}(${JSON.stringify(args)}) -> ${text.slice(0, 90).replace(/\s+/g, " ")}`
  );
  return res;
};

// Without a tab, tools fail with a clear message.
const noTab = await client.callTool({ name: "windows_list", arguments: {} });
log(
  "before the tab connects:",
  noTab.isError ? "error as expected:" : "unexpected success",
  noTab.content[0].text.slice(0, 80)
);

// 2. The browser tab, connected with ?bridge=1.
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.addInitScript(() =>
  localStorage.setItem("paperos-v2:ide-initialized", "demo")
);
await page.goto(`${baseUrl}/?bridge=1`);
await page.getByTestId("bridge-toggle").waitFor();
await page.waitForFunction(
  () =>
    document.querySelector('[data-testid="bridge-toggle"]')?.dataset.status ===
    "connected",
  null,
  { timeout: 20000 }
);
log("tab connected");
const status = await call("bridge_status");
log("bridge_status:", status.content[0].text.replace(/\s+/g, " "));

// Open the Agent window so the transcript is visible in the recording.
await page.getByTestId("new-window-menu").click();
await page.getByTestId("new-window-agent").click();
await page.waitForTimeout(400);

// 3. Drive the canvas.
const created = [];
for (const [title, content] of [
  ["Plan", "1. Read the brief\n2. Sketch the layout\n3. Ship"],
  ["Notes from the agent", "Created over MCP through the local bridge."],
  [
    "Checklist",
    "[x] bridge connected\n[x] windows created\n[ ] layout applied",
  ],
]) {
  const res = await call("windows_create", { kind: "note", title, content });
  created.push(JSON.parse(res.content[0].text).id);
  await page.waitForTimeout(250);
}
await call("windows_create", { kind: "script", title: "Script" });
await page.waitForTimeout(300);
await call("layout_apply", { preset: "bento-1-2" });
await page.waitForTimeout(600);
await call("windows_update", {
  id: created[2],
  patch: {
    content: "[x] bridge connected\n[x] windows created\n[x] layout applied",
  },
});
await call("canvas_zoomTo");
await page.waitForTimeout(700);
const list = await call("windows_list");
const windows = JSON.parse(list.content[0].text);
log(
  `${windows.length} windows, ${windows.filter((w) => w.tiled).length} tiled`
);
const shot = await client.callTool({
  name: "canvas_screenshot",
  arguments: { scale: 0.5 },
});
const image = shot.content.find((c) => c.type === "image");
if (image)
  writeFileSync(
    join(outDir, "m3-07-mcp-canvas-export.png"),
    Buffer.from(image.data, "base64")
  );
log(
  "canvas_screenshot ->",
  image ? `${image.mimeType}, ${image.data.length} base64 chars` : "no image"
);
const events = await call("events_poll", { since: 0 });
log(
  "events:",
  JSON.parse(events.content[0].text)
    .events.map((e) => e.name)
    .join(", ")
);

await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "m3-07-mcp-drive.png") });
const videoPath = await page.video()?.path();
await context.close();
await browser.close();
if (videoPath) {
  const target = join(outDir, "m3-07-mcp-drive.webm");
  renameSync(videoPath, target);
  log("video:", target);
}
for (const f of readdirSync(outDir))
  if (/^[0-9a-f]{20,}\.webm$/.test(f))
    renameSync(join(outDir, f), join(outDir, f));
await client.close();
log("done ->", outDir);
process.exit(0);
