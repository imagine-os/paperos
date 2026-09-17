/**
 * `browser.fetch` and `browser.screenshot`: a real browser on the user's
 * machine for the sites that refuse to be embedded in the Browser window.
 * Playwright is optional: when it is installed next to the CLI (or globally
 * resolvable) pages render with Chromium; otherwise `browser.fetch` falls
 * back to Node's fetch (no JavaScript, text only) and `browser.screenshot`
 * explains how to install it.
 */
import { num, str, type LocalTool } from "./local-tools.js";

export const PLAYWRIGHT_HINT =
  "Playwright is not installed for the bridge. Install it once with: npm --prefix tools/paperos-mcp install playwright && npx --prefix tools/paperos-mcp playwright install chromium";

interface PlaywrightLike {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<{
      newPage(options?: {
        viewport?: { width: number; height: number };
      }): Promise<PageLike>;
      close(): Promise<void>;
    }>;
  };
}

interface PageLike {
  goto(
    url: string,
    options?: { waitUntil?: string; timeout?: number }
  ): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  innerText(selector: string): Promise<string>;
  screenshot(options?: { fullPage?: boolean; type?: "png" }): Promise<Buffer>;
  waitForTimeout(ms: number): Promise<void>;
}

let playwright: PlaywrightLike | null | undefined;

/** The Playwright module when it can be loaded, else null (remembered). */
export async function loadPlaywright(): Promise<PlaywrightLike | null> {
  if (playwright !== undefined) return playwright;
  try {
    const name = "playwright";
    playwright = (await import(name)) as PlaywrightLike;
  } catch {
    playwright = null;
  }
  return playwright;
}

/** For tests: pretend Playwright is (un)available. */
export function setPlaywrightForTests(
  mod: PlaywrightLike | null | undefined
): void {
  playwright = mod;
}

function checkUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only http(s) URLs can be fetched");
  return url.toString();
}

/** Rough HTML -> text for the no-Playwright fallback. */
export function htmlToText(html: string): { title: string; text: string } {
  const title =
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const text = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return { title: decode(title), text };
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function withPage<T>(
  pw: PlaywrightLike,
  viewport: { width: number; height: number },
  fn: (page: PageLike) => Promise<T>
): Promise<T> {
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export const browserFetch: LocalTool = {
  name: "browser.fetch",
  description:
    "Loads a web page in a real browser on this machine (Playwright, when installed; otherwise a plain HTTP fetch without JavaScript) and returns its title and visible text. For sites the PaperOS Browser window cannot embed.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "http(s) URL" },
      selector: {
        type: "string",
        description:
          "CSS selector to read instead of the whole body (Playwright only)",
      },
      maxChars: {
        type: "number",
        description: "Truncate the text (default 20000)",
      },
      waitMs: {
        type: "number",
        description:
          "Extra wait after load for client-rendered pages (default 0)",
      },
    },
    required: ["url"],
  },
  async run(args) {
    const url = checkUrl(str(args, "url"));
    const maxChars = Math.max(100, num(args, "maxChars", 20_000));
    const pw = await loadPlaywright();
    if (pw) {
      return withPage(pw, { width: 1280, height: 900 }, async (page) => {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        const wait = num(args, "waitMs", 0);
        if (wait > 0) await page.waitForTimeout(Math.min(wait, 15_000));
        const selector = str(args, "selector", false) || "body";
        const text = await page.innerText(selector);
        return {
          url: page.url(),
          title: await page.title(),
          text: truncate(text, maxChars),
          via: "playwright",
        };
      });
    }
    const res = await fetch(url, {
      redirect: "follow",
      headers: { accept: "text/html,*/*" },
    });
    const body = await res.text();
    const { title, text } = htmlToText(body);
    return {
      url: res.url || url,
      status: res.status,
      title,
      text: truncate(text, maxChars),
      via: "fetch",
      note: `Fetched without a browser (no JavaScript ran). ${PLAYWRIGHT_HINT}`,
    };
  },
};

export const browserScreenshot: LocalTool = {
  name: "browser.screenshot",
  description:
    "Opens a web page in a real browser on this machine (Playwright) and returns a PNG screenshot. Needs Playwright installed for the bridge; the error says how.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "http(s) URL" },
      width: { type: "number", description: "Viewport width (default 1280)" },
      height: { type: "number", description: "Viewport height (default 800)" },
      fullPage: {
        type: "boolean",
        description: "Capture the whole page (default false)",
      },
      waitMs: {
        type: "number",
        description: "Extra wait after load (default 0)",
      },
    },
    required: ["url"],
  },
  async run(args) {
    const url = checkUrl(str(args, "url"));
    const pw = await loadPlaywright();
    if (!pw) throw new Error(PLAYWRIGHT_HINT);
    const width = Math.min(4000, Math.max(200, num(args, "width", 1280)));
    const height = Math.min(4000, Math.max(200, num(args, "height", 800)));
    return withPage(pw, { width, height }, async (page) => {
      await page.goto(url, { waitUntil: "load", timeout: 30_000 });
      const wait = num(args, "waitMs", 0);
      if (wait > 0) await page.waitForTimeout(Math.min(wait, 15_000));
      const png = await page.screenshot({
        type: "png",
        fullPage: args.fullPage === true,
      });
      return {
        url: page.url(),
        title: await page.title(),
        dataUrl: `data:image/png;base64,${png.toString("base64")}`,
        width,
        height,
      };
    });
  },
};

function truncate(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`
    : text;
}

export const BROWSER_TOOLS: LocalTool[] = [browserFetch, browserScreenshot];
