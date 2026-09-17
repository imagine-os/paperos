/**
 * WCAG 2.x contrast for the design tokens: `contrastRatio()` between two
 * colors (hex or rgb/rgba; an alpha color is composited over the
 * background first), and `checkPresetContrast()` which lists the text /
 * background pairs of a token set that fall under AA (4.5:1 for body text,
 * 3:1 for large text and UI). Pure TypeScript; the unit test runs it over
 * the four theme presets so a token change that breaks readability fails.
 */
import type { DesignTokens } from "./tokens";

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("").map((ch) => parseInt(ch + ch, 16));
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) {
    const n = parseInt(m[1], 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: m[2] ? parseInt(m[2], 16) / 255 : 1,
    };
  }
  m =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
      v
    );
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    };
  }
  return null;
}

/** `fg` with alpha composited over an opaque `bg`. */
export function composite(fg: Rgb, bg: Rgb): Rgb {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

export function luminance(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Contrast ratio (1..21) of `fg` text over `bg`; null when a color is unreadable. */
export function contrastRatio(fg: string, bg: string): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const back = b.a < 1 ? composite(b, { r: 255, g: 255, b: 255, a: 1 }) : b;
  const fore = f.a < 1 ? composite(f, back) : f;
  const l1 = luminance(fore);
  const l2 = luminance(back);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

export interface ContrastPair {
  /** `text on surface` and the like. */
  label: string;
  fg: string;
  bg: string;
  /** Minimum ratio the pair must reach. */
  min: number;
}

/** The pairs the components put on screen: body and muted text on the backgrounds, button text on the accents. */
export function tokenPairs(): ContrastPair[] {
  const text = (fg: string, bg: string): ContrastPair => ({
    label: `${fg} on ${bg}`,
    fg,
    bg,
    min: AA_TEXT,
  });
  return [
    text("text", "bg"),
    text("text", "bg2"),
    text("text", "surface"),
    text("text", "surface2"),
    text("ink", "bg"),
    text("ink", "surface"),
    text("muted", "bg"),
    text("muted", "surface"),
    text("muted", "surface2"),
    text("accentInk", "primary"),
    text("accentInk", "accent"),
    {
      label: "primary on surface (links, large text)",
      fg: "primary",
      bg: "surface",
      min: AA_LARGE,
    },
    {
      label: "ok on surface (badges, large)",
      fg: "ok",
      bg: "surface",
      min: AA_LARGE,
    },
    {
      label: "danger on surface (large)",
      fg: "danger",
      bg: "surface",
      min: AA_LARGE,
    },
  ];
}

export interface ContrastResult extends ContrastPair {
  scheme: "light" | "dark";
  ratio: number;
}

/** Every pair, in both schemes, with its ratio; `failures` are the ones under their minimum. */
export function checkPresetContrast(tokens: DesignTokens): {
  results: ContrastResult[];
  failures: ContrastResult[];
} {
  const results: ContrastResult[] = [];
  for (const scheme of ["light", "dark"] as const) {
    for (const pair of tokenPairs()) {
      const fg = tokens.color[pair.fg]?.[scheme];
      const bg = tokens.color[pair.bg]?.[scheme];
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio === null) continue;
      results.push({ ...pair, scheme, ratio: Math.round(ratio * 100) / 100 });
    }
  }
  return { results, failures: results.filter((r) => r.ratio < r.min) };
}
