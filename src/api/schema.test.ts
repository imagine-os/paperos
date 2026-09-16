import { describe, expect, it } from "vitest";
import {
  argsToPositional,
  bridgeTools,
  fromMcpName,
  getTool,
  takesOptionsObject,
  toMcpName,
  toolInputSchema,
  TOOLS,
} from "./schema";

describe("tool schema", () => {
  it("has unique dotted names and required-before-optional params", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(t.description.length).toBeGreaterThan(10);
      let optionalSeen = false;
      for (const p of t.params) {
        if (!p.required) optionalSeen = true;
        else
          expect(optionalSeen, `${t.name}: required after optional`).toBe(
            false
          );
      }
    }
  });

  it("maps to and from MCP names", () => {
    expect(toMcpName("windows.list")).toBe("windows_list");
    expect(fromMcpName("windows_list")).toBe("windows.list");
    expect(fromMcpName("nope")).toBeNull();
    const mcp = bridgeTools().map((t) => toMcpName(t.name));
    expect(mcp.every((n) => /^[a-zA-Z0-9_-]{1,64}$/.test(n))).toBe(true);
    expect(mcp).not.toContain("events_on");
  });

  it("builds an input schema per tool", () => {
    const create = toolInputSchema(getTool("windows.create")!);
    expect(create.type).toBe("object");
    expect(create.required).toEqual(["kind"]);
    expect(create.properties?.kind.type).toBe("string");

    const move = toolInputSchema(getTool("windows.move")!);
    expect(Object.keys(move.properties ?? {})).toEqual(["id", "x", "y"]);
    expect(move.required).toEqual(["id", "x", "y"]);

    const list = toolInputSchema(getTool("windows.list")!);
    expect(list).toEqual({ type: "object", properties: {} });

    // An enum-typed single param is not an options object.
    expect(takesOptionsObject(getTool("layout.apply")!)).toBe(false);
    expect(takesOptionsObject(getTool("windows.create")!)).toBe(true);
  });

  it("converts object args to positional ones", () => {
    expect(
      argsToPositional(getTool("windows.move")!, { id: "a", x: 1, y: 2 })
    ).toEqual(["a", 1, 2]);
    expect(
      argsToPositional(getTool("windows.create")!, { kind: "note" })
    ).toEqual([{ kind: "note" }]);
    expect(argsToPositional(getTool("layout.tile")!, {})).toEqual([]);
    expect(argsToPositional(getTool("files.create")!, { path: "a" })).toEqual([
      "a",
    ]);
    expect(() =>
      argsToPositional(getTool("files.rename")!, { from: "a" })
    ).toThrow(/missing required argument to/);
  });
});
