import { describe, expect, it } from "vitest";
import {
  defaultTokens,
  isColor,
  parseTokens,
  scaleKeys,
  serializeTokens,
  tokensToCss,
  tokenVar,
} from "./tokens";

describe("tokens", () => {
  it("parses a file, falls back to defaults and reports problems", () => {
    const { tokens, errors } = parseTokens(
      JSON.stringify({
        color: {
          primary: "#ff0000",
          bg: { light: "#fff", dark: "#000" },
          bad: 12,
          onlyDark: { dark: "#111" },
        },
        spacing: { "1": "2px", "2": 8 },
        typography: { fontSize: { md: "16px" } },
        radius: "nope",
      })
    );
    expect(tokens.color.primary).toEqual({ light: "#ff0000", dark: "#ff0000" });
    expect(tokens.color.bg).toEqual({ light: "#fff", dark: "#000" });
    expect(tokens.color.onlyDark).toEqual({ light: "#111", dark: "#111" });
    expect(tokens.color.bad).toBeUndefined();
    // Semantic colors that are missing come from the defaults.
    expect(tokens.color.danger).toEqual(defaultTokens().color.danger);
    expect(tokens.spacing).toEqual({ "1": "2px", "2": "8" });
    expect(tokens.typography.fontSize).toEqual({ md: "16px" });
    expect(tokens.typography.fontWeight).toEqual(
      defaultTokens().typography.fontWeight
    );
    expect(tokens.radius).toEqual(defaultTokens().radius);
    expect(errors).toEqual([
      "color.bad: expected a color or {light, dark}",
      "radius: expected an object of name -> value",
    ]);
  });

  it("survives invalid JSON and non-objects", () => {
    expect(parseTokens("{").errors[0]).toMatch(/not valid JSON/);
    expect(parseTokens("[]").tokens).toEqual(defaultTokens());
  });

  it("round-trips through serialize", () => {
    const t = defaultTokens();
    t.color.primary = { light: "#123456", dark: "#654321" };
    const text = serializeTokens(t);
    const parsed = JSON.parse(text);
    expect(parsed.color.primary).toEqual({ light: "#123456", dark: "#654321" });
    expect(parsed.color.muted).toBeTypeOf("object");
    expect(parseTokens(text).tokens).toEqual(t);
  });

  it("generates --ds-* variables with a dark block", () => {
    const css = tokensToCss(defaultTokens());
    expect(css).toContain("--ds-color-primary: #2563eb;");
    expect(css).toContain("--ds-font-size-md: 15px;");
    expect(css).toContain("--ds-space-4: 16px;");
    expect(css).toContain("--ds-radius-lg: 14px;");
    expect(css).toContain("--ds-shadow-md:");
    expect(css).toContain("--ds-breakpoint-mobile: 390px;");
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toMatch(
      /prefers-color-scheme: dark[\s\S]*--ds-color-primary: #60a5fa/
    );
    expect(tokenVar("color", "bg")).toBe("--ds-color-bg");
    expect(tokenVar("font-size", "2xl")).toBe("--ds-font-size-2xl");
  });

  it("omits the dark block when every color is the same in both schemes", () => {
    const t = defaultTokens();
    for (const c of Object.values(t.color)) c.dark = c.light;
    expect(tokensToCss(t)).not.toContain("data-theme");
  });

  it("recognizes colors and sorts scales numerically", () => {
    expect(isColor("#fff")).toBe(true);
    expect(isColor("rgb(1, 2, 3)")).toBe(true);
    expect(isColor("rebeccapurple")).toBe(true);
    expect(isColor("12px")).toBe(false);
    expect(isColor("")).toBe(false);
    expect(scaleKeys({ "10": "a", "2": "b", xs: "c", "1": "d" })).toEqual([
      "1",
      "2",
      "10",
      "xs",
    ]);
  });
});
