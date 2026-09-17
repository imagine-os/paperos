import { describe, expect, it } from "vitest";
import {
  addressTitle,
  formatAddress,
  hostOf,
  normalizeAddress,
  parseAddress,
} from "./address";
import { isBlockedHost, judgeEmbed } from "./embed";
import {
  activeTab,
  closeTab,
  createState,
  currentAddress,
  describeTabs,
  goBack,
  goForward,
  navigate,
  openTab,
  parseState,
  reload,
  serializeState,
  setTabTitle,
} from "./tabs";
import {
  addBookmark,
  DEFAULT_BOOKMARKS,
  isBookmarked,
  parseBookmarks,
  removeBookmark,
  serializeBookmarks,
} from "./bookmarks";

describe("addresses", () => {
  it("parses internal paperos:// targets", () => {
    expect(parseAddress("paperos://preview/index.html")).toEqual({
      type: "preview",
      entry: "index.html",
    });
    expect(parseAddress("paperos://preview/pages/home.json?tenant=2")).toEqual({
      type: "preview",
      entry: "pages/home.json?tenant=2",
    });
    expect(parseAddress("paperos://preview/")).toEqual({
      type: "preview",
      entry: "",
    });
    expect(parseAddress("paperos://docs")).toEqual({
      type: "docs",
      doc: "README.md",
    });
    expect(parseAddress("paperos://docs/docs/MCP.md")).toEqual({
      type: "docs",
      doc: "docs/MCP.md",
    });
    expect(parseAddress("PAPEROS://legacy")).toEqual({ type: "legacy" });
    expect(parseAddress("paperos://home")).toEqual({ type: "home" });
    expect(parseAddress("paperos://")).toEqual({ type: "home" });
    expect(parseAddress("paperos://index.html")).toEqual({
      type: "preview",
      entry: "index.html",
    });
  });

  it("parses http(s) and bare hosts", () => {
    expect(parseAddress("https://example.com/a?b=1")).toEqual({
      type: "http",
      url: "https://example.com/a?b=1",
    });
    expect(parseAddress("example.com")).toEqual({
      type: "http",
      url: "https://example.com",
    });
    expect(parseAddress("localhost:3000/app")).toEqual({
      type: "http",
      url: "http://localhost:3000/app",
    });
    expect(parseAddress("192.168.1.5:8080")).toEqual({
      type: "http",
      url: "http://192.168.1.5:8080",
    });
  });

  it("treats project paths as preview entries and rejects other schemes", () => {
    expect(parseAddress("/index.html")).toEqual({
      type: "preview",
      entry: "index.html",
    });
    expect(parseAddress("pages/home.json")).toEqual({
      type: "preview",
      entry: "pages/home.json",
    });
    expect(parseAddress("javascript:alert(1)")).toEqual({ type: "blank" });
    expect(parseAddress("")).toEqual({ type: "blank" });
    expect(parseAddress("about:blank")).toEqual({ type: "blank" });
    expect(parseAddress("just some words")).toEqual({ type: "blank" });
  });

  it("formats and normalizes round trips", () => {
    for (const a of [
      "paperos://preview/index.html",
      "paperos://docs/README.md",
      "paperos://legacy",
      "paperos://home",
      "about:blank",
      "https://example.com",
    ]) {
      expect(formatAddress(parseAddress(a))).toBe(a);
    }
    expect(normalizeAddress("example.com")).toBe("https://example.com");
    expect(normalizeAddress("paperos://docs")).toBe("paperos://docs/README.md");
  });

  it("titles and hosts", () => {
    expect(hostOf("https://www.Example.com/x")).toBe("example.com");
    expect(hostOf("paperos://home")).toBe("");
    expect(addressTitle("https://developer.mozilla.org/")).toBe(
      "developer.mozilla.org"
    );
    expect(addressTitle("paperos://preview/pages/home.json?tenant=2")).toBe(
      "Preview: pages/home.json"
    );
    expect(addressTitle("paperos://docs/docs/MCP.md")).toBe("MCP.md");
    expect(addressTitle("about:blank")).toBe("New tab");
  });
});

describe("embed refusal", () => {
  it("knows hosts that refuse framing, including subdomains", () => {
    expect(isBlockedHost("https://github.com/imagine-os/paperos")).toBe(true);
    expect(isBlockedHost("https://docs.github.com/x")).toBe(true);
    expect(isBlockedHost("https://mygithub.com")).toBe(false);
    expect(isBlockedHost("https://developer.mozilla.org/")).toBe(false);
    expect(isBlockedHost("paperos://home")).toBe(false);
  });

  it("judges from the list, the load event and the timeout", () => {
    const base = { url: "https://example.com", startedAt: 1000 };
    expect(judgeEmbed({ ...base, now: 1500, loaded: false })).toBe("loading");
    expect(judgeEmbed({ ...base, now: 1500, loaded: true })).toBe("loaded");
    expect(judgeEmbed({ ...base, now: 9500, loaded: false })).toBe("refused");
    expect(
      judgeEmbed({ ...base, now: 1200, loaded: false, timeoutMs: 100 })
    ).toBe("refused");
    const gh = { url: "https://github.com", startedAt: 0, now: 10 };
    expect(judgeEmbed({ ...gh, loaded: true })).toBe("refused");
    expect(judgeEmbed({ ...gh, loaded: true, force: true })).toBe("loaded");
    expect(judgeEmbed({ ...gh, loaded: false, force: true })).toBe("loading");
  });
});

describe("tab state", () => {
  it("starts with one tab and navigates with history", () => {
    let s = createState("paperos://home");
    expect(s.tabs).toHaveLength(1);
    expect(currentAddress(activeTab(s))).toBe("paperos://home");
    s = navigate(s, "example.com");
    s = navigate(s, "paperos://docs");
    const t = activeTab(s);
    expect(t.history).toEqual([
      "paperos://home",
      "https://example.com",
      "paperos://docs/README.md",
    ]);
    expect(t.index).toBe(2);
    s = goBack(s);
    expect(currentAddress(activeTab(s))).toBe("https://example.com");
    s = goBack(s);
    s = goBack(s); // no-op at the start
    expect(currentAddress(activeTab(s))).toBe("paperos://home");
    s = goForward(s);
    expect(currentAddress(activeTab(s))).toBe("https://example.com");
    // Navigating from the middle drops the forward entries.
    s = navigate(s, "paperos://legacy");
    expect(activeTab(s).history).toEqual([
      "paperos://home",
      "https://example.com",
      "paperos://legacy",
    ]);
    expect(describeTabs(s)[0]).toMatchObject({
      url: "paperos://legacy",
      title: "Legacy prototype",
      active: true,
      canGoBack: true,
      canGoForward: false,
    });
  });

  it("navigating to the same address only clears the title", () => {
    let s = setTabTitle(
      createState("paperos://home"),
      createState().active,
      "x"
    );
    s = setTabTitle(s, s.active, "Landing");
    expect(activeTab(s).title).toBe("Landing");
    s = navigate(s, "paperos://home");
    expect(activeTab(s).history).toHaveLength(1);
    expect(activeTab(s).title).toBeUndefined();
  });

  it("opens, activates and closes tabs, never leaving zero", () => {
    let s = createState("paperos://home");
    const first = s.active;
    s = openTab(s, "example.com");
    expect(s.tabs).toHaveLength(2);
    expect(s.active).not.toBe(first);
    s = openTab(s, "paperos://legacy", { activate: false });
    expect(s.tabs).toHaveLength(3);
    expect(s.active).toBe(s.tabs[1].id);
    s = closeTab(s, s.active);
    expect(s.tabs).toHaveLength(2);
    expect(s.active).toBe(s.tabs[1].id);
    s = closeTab(s, s.tabs[0].id);
    s = closeTab(s, s.tabs[0].id);
    expect(s.tabs).toHaveLength(1);
    expect(currentAddress(activeTab(s))).toBe("about:blank");
    expect(closeTab(s, "nope")).toBe(s);
  });

  it("reload bumps a counter and the state round-trips through content", () => {
    let s = createState("paperos://preview/index.html");
    s = reload(s);
    const back = parseState(serializeState(s));
    expect(back).toEqual(s);
  });

  it("reads board specs, bare addresses and garbage", () => {
    const board = parseState(
      JSON.stringify({ tabs: [{ address: "paperos://preview/index.html" }] })
    );
    expect(currentAddress(activeTab(board))).toBe(
      "paperos://preview/index.html"
    );
    expect(currentAddress(activeTab(parseState("example.com")))).toBe(
      "https://example.com"
    );
    expect(
      currentAddress(
        activeTab(parseState(JSON.stringify({ url: "paperos://home" })))
      )
    ).toBe("paperos://home");
    expect(parseState("").tabs).toHaveLength(1);
    expect(parseState("{}").tabs).toHaveLength(1);
    expect(parseState('{"tabs":[null, 3]}').tabs).toHaveLength(1);
  });
});

describe("bookmarks", () => {
  it("defaults when there is no file, and tolerates bad entries", () => {
    expect(parseBookmarks(null)).toEqual(DEFAULT_BOOKMARKS);
    expect(parseBookmarks("not json")).toEqual([]);
    expect(
      parseBookmarks(
        JSON.stringify({
          bookmarks: [
            { title: "MDN", url: "developer.mozilla.org" },
            { url: "paperos://docs" },
            "paperos://legacy",
            { title: "no url" },
            7,
          ],
        })
      )
    ).toEqual([
      { title: "MDN", url: "https://developer.mozilla.org" },
      { title: "README.md", url: "paperos://docs/README.md" },
      { title: "Legacy prototype", url: "paperos://legacy" },
    ]);
  });

  it("adds (one per URL), removes and serializes", () => {
    let list = parseBookmarks(serializeBookmarks([]));
    expect(list).toEqual([]);
    list = addBookmark(list, { title: "", url: "example.com" });
    list = addBookmark(list, { title: "Example", url: "https://example.com" });
    expect(list).toEqual([{ title: "Example", url: "https://example.com" }]);
    expect(isBookmarked(list, "example.com")).toBe(true);
    expect(serializeBookmarks(list)).toContain('"bookmarks"');
    list = removeBookmark(list, "example.com");
    expect(list).toEqual([]);
  });
});

describe("docs", () => {
  it("resolves relative links between bundled docs", async () => {
    const { resolveDocLink, docDocument } = await import("./docs");
    expect(resolveDocLink("docs/MCP.md", "CANVAS_API.md")).toBe(
      "docs/CANVAS_API.md"
    );
    expect(resolveDocLink("docs/MCP.md", "../README.md")).toBe("README.md");
    expect(resolveDocLink("README.md", "docs/PLAN.md#m7")).toBe("docs/PLAN.md");
    expect(resolveDocLink("README.md", "https://x.y/z.md")).toBeNull();
    expect(resolveDocLink("README.md", "#anchor")).toBeNull();
    expect(resolveDocLink("README.md", "src/legacy/README.md")).toBeNull();
    expect(docDocument("T<", "<p>x</p>")).toContain("<title>T&lt;</title>");
  });
});
