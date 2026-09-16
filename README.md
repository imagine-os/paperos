# PaperOS

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive: everything you open lives in a window you can move, resize and
arrange. A tiling engine arranges windows into layouts, the windows hold IDE
tools (file tree, editors, previews, consoles), and a Canvas API later makes
the whole desktop programmable.

**Status:** v2 preview, milestone M1 (window manager). The desktop renders,
you can open, move, resize, edit and close windows, tile them with layout
presets or an i3-style split tree, drag windows between tiles, resize tiles by
dragging the gaps, and save arrangements as workspaces. Everything survives a
refresh. The rest of the roadmap is in [`docs/PLAN.md`](docs/PLAN.md).

The 2025 prototype (a tldraw whiteboard with a code editor and a project
browser) still runs at `/legacy`.

## Run it

Requirements: Node 20 or newer, npm.

```bash
npm ci          # install exactly what package-lock.json says
npm run dev     # http://localhost:3000
```

No accounts, keys or paid services are needed. The canvas shows the tldraw
"made with tldraw" watermark, which is allowed under the tldraw free tier.

Other commands:

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `npm run check`  | Typecheck, lint and unit tests. Run before every push. |
| `npm run build`  | Production build (what Vercel runs).                   |
| `npm start`      | Serve the production build.                            |
| `npm test`       | Unit tests (Vitest).                                   |
| `npm run e2e`    | Browser smoke test (Playwright, needs Chromium).       |
| `npm run format` | Prettier.                                              |

For `npm run e2e`, Playwright needs a Chromium. Either run
`npx playwright install chromium` once, or point
`PLAYWRIGHT_BROWSERS_PATH` at an existing install.

## Window manager

Windows float by default. The **Layout** menu (top bar) arranges every window
on the page inside the current viewport:

| Layout                       | What it does                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Free                         | No layout; windows float.                                                                                     |
| Columns                      | N equal columns. Collapses to one column when the viewport is narrower than 720 px.                           |
| Grid                         | Square-ish rows x columns.                                                                                    |
| Bento (1 + 2, 2 + 1, mosaic) | Asymmetric presets: one large + two small, two over one, four-cell mosaic. Extra windows share the last cell. |
| Split tree                   | i3-style binary tree you build yourself: tile a window left/right/top/bottom of another.                      |

Tiled windows have flush corners and no shadow, sit below floating windows,
and cannot be resized with the corner handles: drag the gap between two tiled
windows instead. Drag a tiled window's title bar to detach it (the others
reflow); drop a floating window on a tiled one to insert it left/right/top/
bottom, or on the center to swap places. Each window has a menu (the `...`
button, or long-press the title bar on touch) with Tile / Float, Tile
left/right/top/bottom, Rename, Focus mode, Duplicate and Close.

The layout region is the viewport as it was when the layout was applied; it
stays on the canvas while you pan and zoom, and is re-captured when the browser
window is resized. "Show layout" in the Layout menu zooms back to it.

### Keyboard shortcuts

All PaperOS shortcuts use `Alt` so they do not clash with tldraw's own. They
are listed in tldraw's shortcuts dialog too (`?`). Two tldraw defaults moved
to make room: change page is `Alt+PageUp` / `Alt+PageDown` and tldraw's own
focus mode is `Alt+Shift+F`.

| Shortcut           | Action                                                  |
| ------------------ | ------------------------------------------------------- |
| `W`                | Window tool: click the canvas to open a window there.   |
| `Alt+N`            | New window at the viewport center.                      |
| `Alt+1` .. `Alt+5` | Layout: Free, Columns, Grid, Bento (1 + 2), Split tree. |
| `Alt+Arrow`        | Move focus to the tiled window in that direction.       |
| `Alt+Shift+Arrow`  | Swap the focused window with its neighbour.             |
| `Alt+Enter`        | Tile or float the focused window.                       |
| `Alt+F`            | Focus mode: zoom the camera to the focused window.      |

### Workspaces

A workspace is a saved arrangement: layout preset, layout tree, the windows in
it, the layout region and the camera. The **Workspaces** menu lists them and
lets you save the current arrangement, update, rename, duplicate or delete the
active one. Switching applies the layout and animates the camera to it. A fresh
install has two: "Desk" (free) and "Grid" (tiles whatever is on the page in a
grid). Workspaces live in this browser's `localStorage` under
`paperos-v2:workspaces`; the live arrangement is kept under `paperos-v2:wm` so
a reload comes back tiled.

## Environment variables

All optional. Copy `.env.example` to `.env.local` if you want to set any.

| Variable                         | Used by   | Effect                                                         |
| -------------------------------- | --------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | `/`       | tldraw SDK license key. Removes the watermark. No code change. |
| `LIVEBLOCKS_SECRET_KEY`          | `/legacy` | Lets the 2025 prototype's collaboration client connect.        |

## Routes

| Route     | What                                                          |
| --------- | ------------------------------------------------------------- |
| `/`       | PaperOS v2 desktop. Top bar, persistent canvas, Window shape. |
| `/legacy` | The 2025 prototype, frozen. Has a banner linking back to `/`. |

Both pages link to each other.

## Architecture

```
src/
  app/            Next.js App Router: routes, root layout, global tokens
    page.tsx      /        -> the v2 desktop
    legacy/       /legacy  -> the frozen prototype (own layout + providers)
    api/liveblocks-auth/   legacy-only auth route (optional key)
  desktop/        The v2 desktop
    desktop.tsx        tldraw canvas + top bar + toolbar overrides
    window-shape.tsx   the Window shape (title bar, menu, tiled/focused state,
                       drag detach + drop hooks, editable title, long-press)
    window-menu.tsx    per-window menu (tile/float, tile to a side, duplicate, close)
    wm-overlay.tsx     resize gutters and the drop-zone hint (screen space)
    wm-actions.ts      Alt-based keyboard shortcuts as tldraw actions
    top-bar.tsx        Layout and Workspaces menus, New window, About
    menu.tsx           small dropdown/menu primitives for the top bar
    window-tool.ts     toolbar tool: press "w", click to open a window
    window-kinds.tsx   registry of what a window can show (note, about, ...)
    kinds/             one file per kind
    create-window.ts   create a window with cascading placement
    cascade.ts         pure placement helper (unit tested)
  wm/             Window manager (pure TypeScript except window-manager.ts)
    types.ts           layout tree (leaf / split / grid), presets, workspace
    layout-engine.ts   layout(): rectangles for a tree in a region (gaps, padding, min sizes)
    presets.ts         columns, grid, bento templates, split tree
    operations.ts      insert, splitLeaf, swap, resizeRatio, remove, tile
    geometry.ts        drop zones, neighbour search, reading order
    window-manager.ts  applies trees to Window shapes via the tldraw editor
    workspace-store.ts localStorage-backed workspaces; wm-state.ts live arrangement
  lib/            Shared helpers: env, bundled tldraw assets
  legacy/         The 2025 prototype, moved verbatim (see src/legacy/README.md)
e2e/              Playwright: smoke test and window-manager test
docs/PLAN.md      Milestones and architecture decisions
tasks/todo.md     Working checklist and review notes
```

Design tokens live in `src/app/globals.css` as CSS variables (`--pos-*`),
with a dark set under `prefers-color-scheme: dark`. The tldraw canvas follows
the same system preference.

tldraw's icons, fonts and translations are bundled from `@tldraw/assets`
(see `src/lib/tldraw-assets.ts` and `next.config.ts`), so the app does not
load anything from `cdn.tldraw.com`.

## Upgrading later

- **Remove the tldraw watermark:** buy a tldraw license, set
  `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` in your environment (Vercel: Project
  Settings -> Environment Variables) and redeploy. `src/lib/env.ts` passes it
  to `<Tldraw licenseKey>`.
- **Real-time collaboration (M4):** the v2 canvas uses tldraw's local
  persistence (`persistenceKey="paperos-v2"`, IndexedDB). Swapping in a sync
  backend means replacing that one prop with a store from a sync provider
  (tldraw sync, Liveblocks, Yjs over WebSocket, ...) in
  `src/desktop/desktop.tsx`. No other code depends on where the store lives.
- **tldraw version:** one `tldraw` version serves both `/` and `/legacy`;
  bump `tldraw` and `@tldraw/assets` together in `package.json`.
