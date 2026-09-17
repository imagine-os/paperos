/**
 * Design tokens: `design/tokens.json` as data, with defaults, a tolerant
 * parser and CSS variable generation. Everything here is pure; the bundler
 * injects the generated CSS (`--ds-*` variables) into the preview and the
 * Design window edits the file.
 *
 * Shape of the file:
 *   {
 *     "preset": "paper",
 *     "color": { "primary": "#e85d2f", "bg": { "light": "#f7f4ec", "dark": "#0d0c11" }, ... },
 *     "typography": { "fontFamily": { "sans", "display", "mono" }, "fontSize": { "xs".."3xl" },
 *                     "fontWeight": {...}, "lineHeight": {...}, "letterSpacing": {...} },
 *     "spacing": { "1": "4px", ... }, "radius": {...}, "shadow": {...}, "breakpoint": {...},
 *     "motion": { "ease": "cubic-bezier(...)", "fast": "180ms", "slow": "700ms" }
 *   }
 * A color is a string (same in both schemes) or `{light, dark}`. The theme
 * presets (Paper, Ink, Studio, Bold) in `presets.ts` are whole token sets.
 */

export const TOKENS_PATH = "design/tokens.json";

export const SEMANTIC_COLORS = [
  "bg",
  "bg2",
  "surface",
  "surface2",
  "glass",
  "ink",
  "text",
  "muted",
  "border",
  "borderStrong",
  "dot",
  "primary",
  "accent",
  "accent2",
  "accentInk",
  "ok",
  "warn",
  "danger",
] as const;

export type SemanticColor = (typeof SEMANTIC_COLORS)[number];

export interface ColorValue {
  light: string;
  dark: string;
}

export interface DesignTokens {
  /** Theme preset the tokens were last set from (paper, ink, studio, bold), if any. */
  preset?: string;
  color: Record<string, ColorValue>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
    letterSpacing: Record<string, string>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  breakpoint: Record<string, string>;
  /** Easing and durations: `ease`, `fast`, `slow`. */
  motion: Record<string, string>;
}

/** The body, display and mono stacks (system fonts only, see docs/BRAND.md). */
export const FONT_STACKS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display:
    '"SF Pro Display", "Segoe UI Variable Display", "Avenir Next", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
} as const;

const HEX_RE = /^#[0-9a-f]{3,8}$/i;
const COLOR_FN_RE =
  /^(rgb|rgba|hsl|hsla|oklch|oklab|color|color-mix|var|light-dark)\(/i;

/** True for a CSS color literal a swatch can show (hex, a color function, or a named color). */
export function isColor(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const v = value.trim();
  return (
    HEX_RE.test(v) || COLOR_FN_RE.test(v) || /^[a-z]+$/i.test(v) // named colors
  );
}

/**
 * The "Paper" theme: warm paper with ink, one rose → ember → amber accent
 * gradient, hairlines and layered shadows (docs/BRAND.md). Dark mode inverts
 * the metaphor (ink page, paper text).
 */
export function defaultTokens(): DesignTokens {
  const c = (light: string, dark: string): ColorValue => ({ light, dark });
  return {
    preset: "paper",
    color: {
      bg: c("#f7f4ec", "#0d0c11"),
      bg2: c("#efebe1", "#121118"),
      surface: c("#fffdf8", "#17161d"),
      surface2: c("#f3efe6", "#1e1d25"),
      glass: c("rgba(255, 253, 248, 0.72)", "rgba(23, 22, 29, 0.66)"),
      ink: c("#15141a", "#f2ead9"),
      text: c("#2b2931", "#d8d2c6"),
      muted: c("#6b6774", "#958f86"),
      border: c("rgba(21, 20, 26, 0.10)", "rgba(242, 234, 217, 0.10)"),
      borderStrong: c("rgba(21, 20, 26, 0.20)", "rgba(242, 234, 217, 0.20)"),
      dot: c("rgba(21, 20, 26, 0.16)", "rgba(242, 234, 217, 0.14)"),
      primary: c("#e85d2f", "#ff7a45"),
      accent: c("#e14b78", "#ff5c8a"),
      accent2: c("#f0a24a", "#ffc26b"),
      // Ink on the ember and rose accents: white fails AA (3.5:1) on both.
      accentInk: c("#1a0d08", "#1a0d08"),
      ok: c("#2f9e6a", "#5cd39a"),
      warn: c("#d97706", "#fbbf24"),
      danger: c("#c8322b", "#ff6b6b"),
    },
    typography: {
      fontFamily: {
        sans: FONT_STACKS.sans,
        display: FONT_STACKS.display,
        mono: FONT_STACKS.mono,
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        md: "16px",
        lg: "clamp(17px, 0.6vw + 14px, 20px)",
        xl: "clamp(20px, 1.2vw + 14px, 26px)",
        "2xl": "clamp(26px, 2.4vw + 14px, 40px)",
        "3xl": "clamp(36px, 4.6vw + 14px, 72px)",
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: { tight: "1.05", snug: "1.2", normal: "1.55", loose: "1.7" },
      letterSpacing: {
        display: "-0.022em",
        hero: "-0.035em",
        kicker: "0.06em",
      },
    },
    spacing: {
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "5": "24px",
      "6": "32px",
      "7": "48px",
      "8": "64px",
      "9": "96px",
      "10": "128px",
    },
    radius: { sm: "8px", md: "12px", lg: "20px", xl: "28px", full: "999px" },
    shadow: {
      sm: "0 1px 2px rgba(21, 20, 26, 0.06), 0 2px 8px rgba(21, 20, 26, 0.06)",
      md: "0 1px 2px rgba(21, 20, 26, 0.06), 0 8px 24px rgba(21, 20, 26, 0.08), 0 24px 64px rgba(21, 20, 26, 0.10)",
      lg: "0 2px 4px rgba(21, 20, 26, 0.06), 0 16px 48px rgba(21, 20, 26, 0.12), 0 48px 96px rgba(21, 20, 26, 0.14)",
      glow: "0 0 0 1px rgba(232, 93, 47, 0.25), 0 12px 40px rgba(232, 93, 47, 0.25)",
    },
    breakpoint: { mobile: "390px", tablet: "820px", desktop: "1280px" },
    motion: {
      ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      fast: "180ms",
      slow: "700ms",
    },
  };
}

function stringMap(
  raw: unknown,
  fallback: Record<string, string>,
  errors: string[],
  where: string
): Record<string, string> {
  if (raw === undefined) return { ...fallback };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    errors.push(`${where}: expected an object of name -> value`);
    return { ...fallback };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    else errors.push(`${where}.${k}: expected a string`);
  }
  return out;
}

function colorValue(
  raw: unknown,
  errors: string[],
  where: string
): ColorValue | null {
  if (typeof raw === "string") {
    if (!isColor(raw)) errors.push(`${where}: "${raw}" is not a color`);
    return { light: raw, dark: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    const light = typeof r.light === "string" ? r.light : undefined;
    const dark = typeof r.dark === "string" ? r.dark : undefined;
    if (!light && !dark) {
      errors.push(`${where}: expected a color or {light, dark}`);
      return null;
    }
    return { light: light ?? dark!, dark: dark ?? light! };
  }
  errors.push(`${where}: expected a color or {light, dark}`);
  return null;
}

/**
 * Parses `design/tokens.json`. Tolerant: missing groups fall back to the
 * defaults, bad entries are reported in `errors` and skipped.
 */
export function parseTokens(text: string): {
  tokens: DesignTokens;
  errors: string[];
} {
  const errors: string[] = [];
  const base = defaultTokens();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      tokens: base,
      errors: [
        `tokens.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { tokens: base, errors: ["tokens.json must be an object"] };
  const r = raw as Record<string, unknown>;

  const color: Record<string, ColorValue> = {};
  const rawColor = r.color ?? r.colors;
  if (rawColor === undefined) Object.assign(color, base.color);
  else if (typeof rawColor !== "object" || rawColor === null) {
    errors.push("color: expected an object");
    Object.assign(color, base.color);
  } else {
    for (const [k, v] of Object.entries(rawColor as Record<string, unknown>)) {
      const c = colorValue(v, errors, `color.${k}`);
      if (c) color[k] = c;
    }
    for (const k of SEMANTIC_COLORS) if (!color[k]) color[k] = base.color[k];
  }

  const t =
    typeof r.typography === "object" && r.typography !== null
      ? (r.typography as Record<string, unknown>)
      : {};
  if (
    r.typography !== undefined &&
    (typeof r.typography !== "object" || r.typography === null)
  )
    errors.push("typography: expected an object");

  const tokens: DesignTokens = {
    color,
    typography: {
      fontFamily: stringMap(
        t.fontFamily,
        base.typography.fontFamily,
        errors,
        "typography.fontFamily"
      ),
      fontSize: stringMap(
        t.fontSize,
        base.typography.fontSize,
        errors,
        "typography.fontSize"
      ),
      fontWeight: stringMap(
        t.fontWeight,
        base.typography.fontWeight,
        errors,
        "typography.fontWeight"
      ),
      lineHeight: stringMap(
        t.lineHeight,
        base.typography.lineHeight,
        errors,
        "typography.lineHeight"
      ),
      letterSpacing: stringMap(
        t.letterSpacing,
        base.typography.letterSpacing,
        errors,
        "typography.letterSpacing"
      ),
    },
    spacing: stringMap(r.spacing, base.spacing, errors, "spacing"),
    radius: stringMap(r.radius, base.radius, errors, "radius"),
    shadow: stringMap(r.shadow ?? r.shadows, base.shadow, errors, "shadow"),
    breakpoint: stringMap(
      r.breakpoint ?? r.breakpoints,
      base.breakpoint,
      errors,
      "breakpoint"
    ),
    motion: stringMap(r.motion, base.motion, errors, "motion"),
  };
  if (typeof r.preset === "string" && r.preset) tokens.preset = r.preset;
  return { tokens, errors };
}

/** The file form: colors with the same light and dark value collapse to a string. */
export function serializeTokens(tokens: DesignTokens): string {
  const color: Record<string, string | ColorValue> = {};
  for (const [k, v] of Object.entries(tokens.color))
    color[k] = v.light === v.dark ? v.light : v;
  return (
    JSON.stringify(
      {
        ...(tokens.preset ? { preset: tokens.preset } : {}),
        color,
        typography: tokens.typography,
        spacing: tokens.spacing,
        radius: tokens.radius,
        shadow: tokens.shadow,
        breakpoint: tokens.breakpoint,
        motion: tokens.motion,
      },
      null,
      2
    ) + "\n"
  );
}

/** `--ds-color-primary`, `--ds-font-size-md`, `--ds-space-4`, ... */
export function tokenVar(group: string, name: string): string {
  return `--ds-${group}-${name}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

const GROUP_PREFIX: Record<string, string> = {
  fontFamily: "font",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "tracking",
  spacing: "space",
  radius: "radius",
  shadow: "shadow",
  breakpoint: "breakpoint",
};

/**
 * CSS for the tokens: `:root` holds the light scheme and every scale,
 * `[data-theme="dark"]` and `prefers-color-scheme: dark` (without a forced
 * light theme) hold the dark colors. Values are emitted as written, plus one
 * derived variable, `--ds-gradient` (accent → primary → accent2).
 */
export function tokensToCss(tokens: DesignTokens): string {
  const light: string[] = [];
  const dark: string[] = [];
  for (const [k, v] of Object.entries(tokens.color)) {
    light.push(`  ${tokenVar("color", k)}: ${v.light};`);
    if (v.dark !== v.light) dark.push(`  ${tokenVar("color", k)}: ${v.dark};`);
  }
  const scales: string[] = [];
  const emit = (group: string, map: Record<string, string>) => {
    for (const [k, v] of Object.entries(map))
      scales.push(`  ${tokenVar(GROUP_PREFIX[group] ?? group, k)}: ${v};`);
  };
  emit("fontFamily", tokens.typography.fontFamily);
  emit("fontSize", tokens.typography.fontSize);
  emit("fontWeight", tokens.typography.fontWeight);
  emit("lineHeight", tokens.typography.lineHeight);
  emit("letterSpacing", tokens.typography.letterSpacing);
  emit("spacing", tokens.spacing);
  emit("radius", tokens.radius);
  emit("shadow", tokens.shadow);
  emit("breakpoint", tokens.breakpoint);
  emit("motion", tokens.motion);
  // Derived: the one accent gradient (rose → ember → amber in the Paper theme).
  scales.push(
    "  --ds-gradient: linear-gradient(120deg, var(--ds-color-accent), var(--ds-color-primary) 45%, var(--ds-color-accent2));"
  );
  let css = `:root {\n${[...light, ...scales].join("\n")}\n  color-scheme: light dark;\n}\n`;
  if (dark.length) {
    css += `:root[data-theme="dark"] {\n${dark.join("\n")}\n}\n`;
    css += `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${dark.map((l) => "  " + l).join("\n")}\n  }\n}\n`;
  }
  return css;
}

/** Sorted keys of a scale, numeric first (`1, 2, 10`), then by name. */
export function scaleKeys(map: Record<string, string>): string[] {
  return Object.keys(map).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const an = !Number.isNaN(na);
    const bn = !Number.isNaN(nb);
    if (an && bn) return na - nb;
    if (an) return -1;
    if (bn) return 1;
    return 0;
  });
}
