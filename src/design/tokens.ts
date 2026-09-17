/**
 * Design tokens: `design/tokens.json` as data, with defaults, a tolerant
 * parser and CSS variable generation. Everything here is pure; the bundler
 * injects the generated CSS (`--ds-*` variables) into the preview and the
 * Design window edits the file.
 *
 * Shape of the file:
 *   {
 *     "color": { "primary": "#2563eb", "bg": { "light": "#fff", "dark": "#111" }, ... },
 *     "typography": { "fontFamily": { "sans", "mono" }, "fontSize": { "xs".."3xl" },
 *                     "fontWeight": { "regular", "medium", "bold" }, "lineHeight": {...} },
 *     "spacing": { "1": "4px", ... }, "radius": {...}, "shadow": {...}, "breakpoint": {...}
 *   }
 * A color is a string (same in both schemes) or `{light, dark}`.
 */

export const TOKENS_PATH = "design/tokens.json";

export const SEMANTIC_COLORS = [
  "bg",
  "surface",
  "text",
  "muted",
  "primary",
  "accent",
  "danger",
  "border",
] as const;

export type SemanticColor = (typeof SEMANTIC_COLORS)[number];

export interface ColorValue {
  light: string;
  dark: string;
}

export interface DesignTokens {
  color: Record<string, ColorValue>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  breakpoint: Record<string, string>;
}

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

export function defaultTokens(): DesignTokens {
  const c = (light: string, dark: string): ColorValue => ({ light, dark });
  return {
    color: {
      bg: c("#f4f4f8", "#0f1117"),
      surface: c("#ffffff", "#181b24"),
      text: c("#18181b", "#e7e7ee"),
      muted: c("#6b7280", "#9aa0ae"),
      primary: c("#2563eb", "#60a5fa"),
      accent: c("#7c3aed", "#a78bfa"),
      danger: c("#dc2626", "#f87171"),
      border: c("#e4e4ea", "#2a2f3d"),
    },
    typography: {
      fontFamily: {
        sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      },
      fontSize: {
        xs: "12px",
        sm: "13px",
        md: "15px",
        lg: "18px",
        xl: "22px",
        "2xl": "28px",
        "3xl": "36px",
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: { tight: "1.2", normal: "1.5", loose: "1.7" },
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
    },
    radius: { sm: "4px", md: "8px", lg: "14px", xl: "20px", full: "999px" },
    shadow: {
      sm: "0 1px 2px rgba(0, 0, 0, 0.08)",
      md: "0 6px 18px rgba(0, 0, 0, 0.1)",
      lg: "0 16px 40px rgba(0, 0, 0, 0.14)",
    },
    breakpoint: { mobile: "390px", tablet: "820px", desktop: "1280px" },
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

  return {
    tokens: {
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
    },
    errors,
  };
}

/** The file form: colors with the same light and dark value collapse to a string. */
export function serializeTokens(tokens: DesignTokens): string {
  const color: Record<string, string | ColorValue> = {};
  for (const [k, v] of Object.entries(tokens.color))
    color[k] = v.light === v.dark ? v.light : v;
  return (
    JSON.stringify(
      {
        color,
        typography: tokens.typography,
        spacing: tokens.spacing,
        radius: tokens.radius,
        shadow: tokens.shadow,
        breakpoint: tokens.breakpoint,
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
  spacing: "space",
  radius: "radius",
  shadow: "shadow",
  breakpoint: "breakpoint",
};

/**
 * CSS for the tokens: `:root` holds the light scheme and every scale,
 * `[data-theme="dark"]` and `prefers-color-scheme: dark` (without a forced
 * light theme) hold the dark colors. Values are emitted as written.
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
  emit("spacing", tokens.spacing);
  emit("radius", tokens.radius);
  emit("shadow", tokens.shadow);
  emit("breakpoint", tokens.breakpoint);
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
