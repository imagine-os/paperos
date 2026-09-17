/**
 * Theme presets: whole token sets the Design window applies by swapping the
 * colors, radii, shadows and motion of `design/tokens.json` (typography,
 * spacing and breakpoints are the project's own and stay). "Paper" is the
 * default from docs/BRAND.md; "Ink" is the same language dark-first;
 * "Studio" is neutral; "Bold" is saturated.
 */
import { defaultTokens, type ColorValue, type DesignTokens } from "./tokens";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  tokens(): DesignTokens;
}

const c = (light: string, dark: string): ColorValue => ({ light, dark });
const same = (v: string): ColorValue => ({ light: v, dark: v });

function ink(): DesignTokens {
  const base = defaultTokens();
  const color: Record<string, ColorValue> = {};
  for (const [k, v] of Object.entries(base.color)) color[k] = same(v.dark);
  return {
    ...base,
    preset: "ink",
    color,
    shadow: {
      sm: "0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3)",
      md: "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.35), 0 24px 64px rgba(0, 0, 0, 0.4)",
      lg: "0 2px 4px rgba(0, 0, 0, 0.3), 0 16px 48px rgba(0, 0, 0, 0.4), 0 48px 96px rgba(0, 0, 0, 0.45)",
      glow: "0 0 0 1px rgba(255, 122, 69, 0.3), 0 12px 40px rgba(255, 122, 69, 0.3)",
    },
  };
}

function studio(): DesignTokens {
  const base = defaultTokens();
  return {
    ...base,
    preset: "studio",
    color: {
      bg: c("#f4f4f5", "#111113"),
      bg2: c("#ececee", "#161618"),
      surface: c("#ffffff", "#1b1b1f"),
      surface2: c("#f4f4f6", "#222227"),
      glass: c("rgba(255, 255, 255, 0.74)", "rgba(27, 27, 31, 0.7)"),
      ink: c("#111114", "#f4f4f6"),
      text: c("#26262b", "#d9d9df"),
      muted: c("#6f6f78", "#9a9aa4"),
      border: c("rgba(17, 17, 20, 0.10)", "rgba(244, 244, 246, 0.10)"),
      borderStrong: c("rgba(17, 17, 20, 0.20)", "rgba(244, 244, 246, 0.20)"),
      dot: c("rgba(17, 17, 20, 0.14)", "rgba(244, 244, 246, 0.12)"),
      primary: c("#1f1f26", "#f4f4f6"),
      accent: c("#3f3f4c", "#c9c9d4"),
      accent2: c("#7a7a89", "#8a8a99"),
      accentInk: c("#ffffff", "#111114"),
      ok: c("#2f8f5b", "#63d39a"),
      warn: c("#b7791f", "#f6c453"),
      danger: c("#b42323", "#ff6b6b"),
    },
    radius: { sm: "6px", md: "10px", lg: "16px", xl: "22px", full: "999px" },
    shadow: {
      sm: "0 1px 2px rgba(17, 17, 20, 0.08)",
      md: "0 2px 6px rgba(17, 17, 20, 0.08), 0 12px 32px rgba(17, 17, 20, 0.10)",
      lg: "0 4px 12px rgba(17, 17, 20, 0.10), 0 32px 72px rgba(17, 17, 20, 0.16)",
      glow: "0 0 0 1px rgba(31, 31, 38, 0.2), 0 12px 32px rgba(31, 31, 38, 0.18)",
    },
  };
}

function bold(): DesignTokens {
  const base = defaultTokens();
  return {
    ...base,
    preset: "bold",
    color: {
      bg: c("#f5f2ff", "#0c0820"),
      bg2: c("#ece7ff", "#120c2b"),
      surface: c("#ffffff", "#181033"),
      surface2: c("#f3efff", "#20163f"),
      glass: c("rgba(255, 255, 255, 0.72)", "rgba(24, 16, 51, 0.7)"),
      ink: c("#160f3a", "#f6f1ff"),
      text: c("#2a2151", "#ddd6f3"),
      muted: c("#6d6590", "#a79fc9"),
      border: c("rgba(22, 15, 58, 0.12)", "rgba(246, 241, 255, 0.12)"),
      borderStrong: c("rgba(22, 15, 58, 0.24)", "rgba(246, 241, 255, 0.24)"),
      dot: c("rgba(22, 15, 58, 0.18)", "rgba(246, 241, 255, 0.16)"),
      primary: c("#6d28d9", "#a78bfa"),
      accent: c("#db2777", "#f472b6"),
      accent2: c("#06b6d4", "#22d3ee"),
      accentInk: c("#ffffff", "#120c2b"),
      ok: c("#059669", "#34d399"),
      warn: c("#d97706", "#fbbf24"),
      danger: c("#dc2626", "#f87171"),
    },
    radius: { sm: "10px", md: "16px", lg: "24px", xl: "32px", full: "999px" },
    shadow: {
      sm: "0 1px 2px rgba(22, 15, 58, 0.08), 0 4px 12px rgba(109, 40, 217, 0.10)",
      md: "0 2px 4px rgba(22, 15, 58, 0.08), 0 12px 32px rgba(109, 40, 217, 0.16), 0 32px 80px rgba(219, 39, 119, 0.10)",
      lg: "0 4px 8px rgba(22, 15, 58, 0.10), 0 24px 64px rgba(109, 40, 217, 0.22), 0 64px 120px rgba(219, 39, 119, 0.14)",
      glow: "0 0 0 1px rgba(109, 40, 217, 0.35), 0 16px 48px rgba(219, 39, 119, 0.35)",
    },
    motion: { ...base.motion, fast: "220ms", slow: "800ms" },
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "paper",
    name: "Paper",
    description: "Warm paper and ink, rose → ember → amber accent (default).",
    tokens: defaultTokens,
  },
  {
    id: "ink",
    name: "Ink",
    description: "Dark-first: the ink page in both schemes.",
    tokens: ink,
  },
  {
    id: "studio",
    name: "Studio",
    description: "Neutral grays, graphite accent, crisp corners.",
    tokens: studio,
  },
  {
    id: "bold",
    name: "Bold",
    description: "Saturated violet, magenta and cyan, big radii.",
    tokens: bold,
  },
];

export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

/**
 * Applies a preset to existing tokens: colors, radius, shadow and motion come
 * from the preset; typography, spacing and breakpoints stay as they are.
 */
export function applyThemePreset(
  current: DesignTokens,
  presetId: string
): DesignTokens {
  const preset = getThemePreset(presetId);
  if (!preset) throw new Error(`Unknown theme preset "${presetId}"`);
  const t = preset.tokens();
  return {
    ...current,
    preset: preset.id,
    color: t.color,
    radius: t.radius,
    shadow: t.shadow,
    motion: t.motion,
  };
}
