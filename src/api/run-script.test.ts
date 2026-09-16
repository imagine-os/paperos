import { describe, expect, it } from "vitest";
import { formatValue, runScript } from "./run-script";

describe("runScript", () => {
  it("runs with await, captures console and returns the result", async () => {
    const paperos = { add: async (a: number, b: number) => a + b };
    const lines: string[] = [];
    const r = await runScript(
      "console.log('start', {a: 1}); const n = await paperos.add(40, 2); return n;",
      { paperos },
      (l) => lines.push(`${l.level}:${l.text}`),
      () => 0
    );
    expect(r.ok).toBe(true);
    expect(r.value).toBe("42");
    expect(lines).toEqual(['log:start {\n  "a": 1\n}', "result:42"]);
  });

  it("reports syntax and runtime errors", async () => {
    const bad = await runScript("return (", {});
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/SyntaxError/);
    const thrown = await runScript("throw new TypeError('nope')", {});
    expect(thrown.ok).toBe(false);
    expect(thrown.error).toBe("TypeError: nope");
    expect(thrown.lines).toEqual([{ level: "error", text: "TypeError: nope" }]);
  });

  it("does not add a result line for undefined", async () => {
    const r = await runScript("console.warn('w')", {});
    expect(r.lines).toEqual([{ level: "warn", text: "w" }]);
    expect(r.value).toBe("undefined");
  });

  it("formats values", () => {
    expect(formatValue("s")).toBe("s");
    expect(formatValue(undefined)).toBe("undefined");
    expect(formatValue(null)).toBe("null");
    expect(formatValue([1, 2])).toBe("[\n  1,\n  2\n]");
    expect(formatValue(new Error("x"))).toBe("Error: x");
    expect(formatValue(function named() {})).toBe("[function named]");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(formatValue(cyclic)).toBe("[object Object]");
  });
});
