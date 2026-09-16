import { describe, expect, it } from "vitest";
import {
  fuzzyScore,
  listCommands,
  registerCommand,
  registerCommandSource,
  runCommand,
  searchCommands,
  type Command,
} from "./commands";

const cmd = (
  id: string,
  title: string,
  group = "Test",
  keywords?: string
): Command => ({
  id,
  title,
  group,
  keywords,
  run: () => {},
});

describe("fuzzyScore", () => {
  it("requires every character in order", () => {
    expect(fuzzyScore("lg", "Layout: Grid")).toBeGreaterThan(0);
    expect(fuzzyScore("gl", "Layout: Grid")).toBe(0);
    expect(fuzzyScore("", "anything")).toBe(1);
  });

  it("prefers word starts and consecutive runs", () => {
    expect(fuzzyScore("grid", "Layout: Grid")).toBeGreaterThan(
      fuzzyScore("grid", "g r i d spread")
    );
    expect(fuzzyScore("nw", "New window")).toBeGreaterThan(
      fuzzyScore("nw", "unwind")
    );
  });
});

describe("command registry", () => {
  it("registers, lists, searches and runs", async () => {
    let ran = 0;
    const off = registerCommand({
      ...cmd("t-run", "Run me"),
      run: () => void ran++,
    });
    const offSource = registerCommandSource(() => [
      cmd("t-dyn", "Open file: app.js", "File"),
    ]);
    expect(listCommands().map((c) => c.id)).toEqual(
      expect.arrayContaining(["t-run", "t-dyn"])
    );
    expect(await runCommand("t-run")).toBe(true);
    expect(ran).toBe(1);
    expect(await runCommand("nope")).toBe(false);
    expect(searchCommands("appjs")[0].id).toBe("t-dyn");
    off();
    offSource();
    expect(
      listCommands().some((c) => c.id === "t-run" || c.id === "t-dyn")
    ).toBe(false);
  });

  it("ranks title matches above keyword matches and keeps order for empty queries", () => {
    const list = [
      cmd("a", "Toggle theme", "View", "dark light"),
      cmd("b", "Layout: Grid", "Layout"),
      cmd("c", "Dark side", "Misc"),
    ];
    expect(searchCommands("", list).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(searchCommands("dark", list).map((c) => c.id)).toEqual(["c", "a"]);
    expect(searchCommands("grid", list).map((c) => c.id)).toEqual(["b"]);
  });
});
