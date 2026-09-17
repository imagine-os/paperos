# PaperOS brand and visual language

The landing page (`src/app/page.tsx`, `src/app/landing.css`) is the reference
implementation of this language. The design system (`design/tokens.json`,
the desktop's `--pos-*` variables in `src/app/globals.css`) should adopt these
values so the site and the app read as one product. Nothing here needs a
network request: no web fonts, no images.

## Principles

1. **Paper and ink.** The product is a canvas; the palette is a sheet of warm
   paper with ink on it. Dark mode inverts the metaphor (ink page, paper
   text), it does not switch to a generic blue-black.
2. **One accent, used sparingly.** A single warm gradient (rose, ember,
   amber) marks the one thing to do on a screen: the primary action, a
   focused window, a live connector. Never two accents on one surface.
3. **Hairlines and soft depth.** Surfaces are separated by 1px lines with a
   faint gradient and by layered, low-contrast shadows, not by heavy fills.
4. **Quiet motion.** Things arrive; they do not bounce. Every animation is
   disabled by `prefers-reduced-motion`.
5. **The dotted canvas is the motif.** A 24px dot grid at low contrast says
   "canvas" wherever a background needs texture.

## Palette

Light (paper) is the default; dark (ink) follows `prefers-color-scheme` and
`data-theme="dark"`.

| Token                | Light                         | Dark                          | Use                                   |
| -------------------- | ----------------------------- | ----------------------------- | ------------------------------------- |
| `--land-bg`          | `#f7f4ec`                     | `#0d0c11`                     | Page background                       |
| `--land-bg-2`        | `#efebe1`                     | `#121118`                     | Alternate section, canvas             |
| `--land-surface`     | `#fffdf8`                     | `#17161d`                     | Cards, windows                        |
| `--land-surface-2`   | `#f3efe6`                     | `#1e1d25`                     | Hover fills, code chips, active rows  |
| `--land-glass`       | `rgba(255,253,248,.72)`       | `rgba(23,22,29,.66)`          | Sticky header, chips (with blur 14px) |
| `--land-ink`         | `#15141a`                     | `#f2ead9`                     | Headings, brand                       |
| `--land-text`        | `#2b2931`                     | `#d8d2c6`                     | Body text                             |
| `--land-muted`       | `#6b6774`                     | `#958f86`                     | Secondary text                        |
| `--land-line`        | `rgba(21,20,26,.10)`          | `rgba(242,234,217,.10)`       | Hairlines                             |
| `--land-line-strong` | `rgba(21,20,26,.20)`          | `rgba(242,234,217,.20)`       | Borders on interactive elements       |
| `--land-dot`         | `rgba(21,20,26,.16)`          | `rgba(242,234,217,.14)`       | Dot grid                              |
| `--land-accent`      | `#e85d2f`                     | `#ff7a45`                     | Ember: primary action, focus, links   |
| `--land-accent-2`    | `#f0a24a`                     | `#ffc26b`                     | Amber: gradient end                   |
| `--land-accent-3`    | `#e14b78`                     | `#ff5c8a`                     | Rose: gradient start                  |
| `--land-accent-ink`  | `#ffffff`                     | `#1a0d08`                     | Text on the accent gradient           |
| `--land-ok`          | `#2f9e6a`                     | `#5cd39a`                     | Success, "connected"                  |
| `--land-code-a/b/c`  | `#c94a1f` `#2f6fd6` `#2f9e6a` | `#ff9a6b` `#7fb0ff` `#6fd8a8` | Code tokens: keyword, call, string    |

Accent gradient: `linear-gradient(120deg, accent-3, accent 45%, accent-2)`.
Gradient text uses the same stops with `background-clip: text`.

Contrast: body text on the page background is at least 7:1 in both schemes;
muted text at least 4.5:1; accent-ink on the gradient at least 4.5:1.

## Type

System fonts only.

- Body: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif`, 16px, line-height 1.55.
- Display (headings, brand): the tighter display cut where the platform has
  one, `"SF Pro Display", "Segoe UI Variable Display", "Avenir Next"`, then
  the body stack. Weight 700 (650 for h3), letter-spacing -0.022em
  (-0.035em on the hero), line-height 1.02 to 1.1, `text-wrap: balance`.
- Mono: `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas,
"Liberation Mono", monospace`, 0.85em inside prose.

Fluid scale (`clamp`): xs 12, sm 14, md 16, lg 17-20, xl 20-26, 2xl 26-40,
hero 38-76px. Kickers are sm, 600, uppercase, 0.06em tracking, in the accent.

## Spacing, radii, shadows

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Sections use
  `clamp(48px, 8vw, 96px)` of vertical padding; content is capped at 1160px
  with 16px gutters (32px from 720px).
- Radii: 8 (small controls, focus rings), **12 (default)**, 20 (large
  frames), pill for buttons and badges.
- Borders: 1px. Cards draw the border as a gradient
  (`line-strong` to `line`, top to bottom) with the two-background trick
  (`padding-box` / `border-box`).
- Shadows, layered and soft:
  - sm: `0 1px 2px rgba(ink,.06), 0 2px 8px rgba(ink,.06)`
  - md: `0 1px 2px .06, 0 8px 24px .08, 0 24px 64px .10`
  - glow (primary hover): `0 0 0 1px accent/.25, 0 12px 40px accent/.25`
  - dark mode uses black at .3 to .4 instead of ink.
- Glass: `--land-glass` background with `backdrop-filter: saturate(140%)
blur(14px)` for the sticky header; `blur(10px)` for chips.

## Motion

- Easing `cubic-bezier(0.2, 0.7, 0.2, 1)` everywhere.
- Hover and focus transitions: 180ms. Buttons lift 1px; cards lift 3px and
  gain the md shadow; icons tilt -4deg and scale 1.05.
- Entrances: 700ms fade + 10-14px rise, staggered 60-120ms. The hero scene's
  connectors draw with `stroke-dashoffset` over 1.1s after the windows land.
- Loops are limited to a blinking cursor and one pulsing status dot.
- `prefers-reduced-motion: reduce` collapses every animation and transition
  to 0.01ms and shows the finished state.

## Components on the landing page

- **Button**: 44px (48px in the hero) pill, 600 weight. Primary = gradient +
  accent-ink text; secondary = surface + `line-strong` border; ghost = no
  border, `surface-2` on hover. Focus ring: 2px accent, 3px offset.
- **Card / tile**: surface, gradient hairline, radius 12, 24px padding,
  40px icon tile tinted with the accent at 12% (border 25%).
- **Badge**: uppercase xs, `line-strong` border, pill.
- **Step number**: 44px gradient circle, ringed by the page background so it
  sits on the connecting hairline.
- **Status list**: 10px rings; done = filled `ok`, in progress = accent at
  40%, later = `line-strong` ring.

## Mapping to the design system

Suggested names for `design/tokens.json` (values from the table above):
`color.bg`, `color.bg2`, `color.surface`, `color.surface2`, `color.glass`,
`color.ink`, `color.text`, `color.muted`, `color.line`, `color.lineStrong`,
`color.dot`, `color.accent`, `color.accent2`, `color.accent3`,
`color.accentInk`, `color.ok`, `color.code.{a,b,c}`; `font.{body,display,mono}`;
`text.{xs,sm,md,lg,xl,2xl,hero}`; `space.{1..10}`; `radius.{sm,md,lg,pill}`;
`shadow.{sm,md,glow}`; `motion.{ease,fast,slow}`. The desktop's `--pos-*`
variables can alias these one to one (`--pos-bg: var(--land-bg)` and so on).
