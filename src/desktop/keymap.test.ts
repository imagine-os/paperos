import { describe, expect, it } from "vitest";
import {
  buildKeymap,
  filterKeymap,
  keyCaps,
  normalizeKeys,
  tldrawGroup,
} from "./keymap";

describe("normalizeKeys", () => {
  it("reads tldraw's spellings and ours into one form", () => {
    expect(normalizeKeys("cmd+shift+z,ctrl+shift+z")).toBe("Ctrl+Shift+Z");
    expect(normalizeKeys("$k")).toBe("Ctrl+K");
    expect(normalizeKeys("!0")).toBe("Shift+0");
    expect(normalizeKeys("?a")).toBe("Alt+A");
    expect(normalizeKeys("alt+A")).toBe("Alt+A");
    expect(normalizeKeys("alt+shift+left")).toBe("Alt+Shift+Left");
    expect(normalizeKeys("Alt+Shift+Left")).toBe("Alt+Shift+Left");
    expect(normalizeKeys("shift+0")).toBe("Shift+0");
    expect(normalizeKeys("⌫,del")).toBe("Backspace");
    expect(normalizeKeys("cmd+=,ctrl+=,=")).toBe("Ctrl+=");
    expect(normalizeKeys("?")).toBe("?");
    expect(normalizeKeys("v")).toBe("V");
    expect(normalizeKeys("alt+enter")).toBe("Alt+Enter");
  });
});

describe("buildKeymap", () => {
  const commands = [
    {
      id: "layout.columns",
      title: "Layout: Columns",
      group: "Layout",
      shortcut: "Alt+2",
    },
    {
      id: "window.focus.left",
      title: "Focus window left",
      group: "Window",
      shortcut: "Alt+Left",
    },
    { id: "window.close", title: "Close focused window", group: "Window" },
    {
      id: "view.toggle-theme",
      title: "Toggle theme",
      group: "View",
      shortcut: "Ctrl+Shift+L",
    },
  ];
  const tldraw = [
    { id: "undo", label: "Undo", kbd: "cmd+z,ctrl+z" },
    { id: "wm-focus-left", label: "Focus window left", kbd: "alt+left" },
    { id: "wm-layout-columns", label: "Layout: Columns", kbd: "alt+2" },
    { id: "window", label: "Window", kbd: "w" },
    { id: "ide-command-palette", label: "Command palette", kbd: "$k" },
  ];

  it("lists every command shortcut once, grouped, and does not repeat a key tldraw also has", () => {
    const groups = buildKeymap(commands, tldraw);
    const flat = groups.flatMap((g) => g.bindings);
    const shortcuts = commands.filter((c) => c.shortcut);
    for (const c of shortcuts)
      expect(flat.filter((b) => b.label === c.title)).toHaveLength(1);
    const layouts = groups.find((g) => g.group === "Layouts")!;
    expect(layouts.bindings.filter((b) => b.keys === "Alt+2")).toHaveLength(1);
    const windows = groups.find((g) => g.group === "Windows")!;
    expect(windows.bindings.map((b) => b.keys)).toContain("Alt+Left");
    expect(windows.bindings.map((b) => b.keys)).toContain("W");
    const canvas = groups.find((g) => g.group === "Canvas")!;
    expect(canvas.bindings.map((b) => b.keys)).toContain("Ctrl+Z");
    const desktop = groups.find((g) => g.group === "Desktop")!;
    expect(desktop.bindings.filter((b) => b.keys === "Ctrl+K")).toHaveLength(1);
    expect(desktop.bindings.map((b) => b.keys)).toContain("?");
    expect(groups.map((g) => g.group)).toEqual([
      "Desktop",
      "Windows",
      "Layouts",
      "Canvas",
      "Editors",
      "Terminal",
    ]);
  });

  it("filters by label or keys", () => {
    const groups = buildKeymap(commands, tldraw);
    expect(
      filterKeymap(groups, "toggle theme").flatMap((g) => g.bindings)
    ).toHaveLength(1);
    const alt = filterKeymap(groups, "alt+2").flatMap((g) => g.bindings);
    expect(alt.map((b) => b.keys)).toEqual(["Alt+2"]);
    expect(filterKeymap(groups, "zzz")).toEqual([]);
    expect(filterKeymap(groups, "")).toBe(groups);
  });

  it("assigns tldraw ids to groups", () => {
    expect(tldrawGroup("wm-layout-grid")).toBe("Layouts");
    expect(tldrawGroup("wm-swap-left")).toBe("Windows");
    expect(tldrawGroup("ide-command-palette")).toBe("Desktop");
    expect(tldrawGroup("zoom-in")).toBe("Canvas");
  });

  it("splits keys into caps", () => {
    expect(keyCaps("Alt+Shift+Left")).toEqual(["Alt", "Shift", "Left"]);
    expect(keyCaps("?")).toEqual(["?"]);
    expect(keyCaps("Ctrl+=")).toEqual(["Ctrl", "="]);
  });
});
