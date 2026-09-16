# PaperOS

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive: everything you open lives in a window you can move, resize and
arrange. A tiling engine arranges windows into layouts, the windows hold IDE
tools (file tree, editors, previews, consoles), and a Canvas API later makes
the whole desktop programmable.

**Status:** v2 preview, milestone M2 (IDE inside windows). The desktop
renders, windows tile into layouts and workspaces (M1), and the windows now
hold an IDE: a file tree over a project (a folder on disk, a ZIP, a public
GitHub repository or the built-in sample site), CodeMirror editors with one
shared document per file, a live preview with a console, Markdown rendering,
and a command palette. Everything runs in the browser and survives a refresh.
The rest of the roadmap is in [`docs/PLAN.md`](docs/PLAN.md).

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

Window-manager shortcuts use `Alt` so they do not clash with tldraw's own;
the IDE adds the usual `Ctrl+K` and `Ctrl+S`. They
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
| `Ctrl+K`           | Command palette.                                        |
| `Ctrl+S`           | Save the file in the focused editor.                    |
| `Shift+Alt+F`      | Format the file in the focused editor (Prettier).       |

### Workspaces

A workspace is a saved arrangement: layout preset, layout tree, the windows in
it, the layout region and the camera. The **Workspaces** menu lists them and
lets you save the current arrangement, update, rename, duplicate or delete the
active one. Switching applies the layout and animates the camera to it. A fresh
install has three: "IDE" (Files, Editor, Preview and Console; built when first
selected), "Desk" (free) and "Grid" (tiles whatever is on the page in a grid). Workspaces live in this browser's `localStorage` under
`paperos-v2:workspaces`; the live arrangement is kept under `paperos-v2:wm` so
a reload comes back tiled.

## IDE

The first visit opens the **IDE** workspace on the sample project: Files on
the left, an Editor in the center, Preview over Console on the right. The
same arrangement is in the Workspaces menu ("IDE") and the command palette
("Apply IDE workspace").

### Projects

A project is a virtual file tree. **Open** in the top bar (also in the Files
window and the palette) adds one:

| Source                 | Backend                                      | Writes back | Browsers                                                             |
| ---------------------- | -------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Open folder...         | File System Access API directory handle      | Yes         | Chromium (Chrome, Edge, Brave...). The picker is disabled elsewhere. |
| Open sample project    | In-browser (IndexedDB)                       | Yes         | All                                                                  |
| Import ZIP...          | In-browser (IndexedDB), text files only      | Yes         | All                                                                  |
| Import GitHub repo URL | In-browser (IndexedDB), text files only      | Yes         | All, when `api.github.com` is reachable (see below)                  |
| Drop on the canvas     | In-browser (IndexedDB); folders, ZIPs, files | Yes         | All                                                                  |

In-browser projects live in the IndexedDB database `paperos-v2:projects`
(metadata plus files). Folder projects keep only the directory handle there;
after a reload the browser requires a click to grant access again, which the
Files window asks for. `node_modules`, `.git` and build output folders are
skipped. Binary files are not imported in M2 (files are strings); images
referenced by a page render only when they are SVG.

GitHub import downloads `https://api.github.com/repos/<owner>/<repo>/zipball`
from the browser, without a token. GitHub sends CORS headers, but the API
allows 60 requests per hour per IP and some networks block it; the error
message says so and the fallback is to download the ZIP from GitHub and use
Import ZIP. `owner/repo`, full URLs and `/tree/<branch>` are accepted.

### Documents

Every open file is a Yjs `Y.Doc` keyed by project id and path, persisted with
`y-indexeddb` (one database per file, `paperos-v2:doc:<project>:<path>`), so
unsaved edits survive a reload. The editor binds to it through
`y-codemirror.next`; Preview and Markdown windows read the same text. "Dirty"
means the buffer differs from what the backend holds; **Save** (`Ctrl+S`)
writes it back. To make files collaborative later, attach a sync provider in
`attachProvider()` in `src/ide/docs.ts`; nothing else changes.

### Windows

| Kind     | What it shows                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files    | Tree of the active project: folders expand and collapse, a filter box, right-click menu (new file, new folder, rename, delete; open as Markdown), project switcher and Open menu. Clicking a file opens an editor next to Files.        |
| Editor   | CodeMirror 6: language by extension (lazy-loaded), line numbers, bracket matching, search (`Ctrl+F`), light and dark theme following the app. `Ctrl+S` saves, `Shift+Alt+F` or **Format** runs Prettier (JS/TS/CSS/HTML/JSON/Markdown). |
| Preview  | The project's entry (`index.html`, or pick another `.html` in the URL bar) in a sandboxed iframe, rebuilt from the live buffers 300 ms after the last edit. Stylesheets, `@import`, `url()` SVGs and scripts are inlined.               |
| Console  | `console.*` output and errors from the preview, with levels and Clear, plus a one-line input that evaluates JavaScript inside the preview.                                                                                              |
| Markdown | A rendered `.md` file (`README.md` by default), sanitized with DOMPurify. **Edit** opens it in an editor.                                                                                                                               |
| Note     | Plain text, stored in the window.                                                                                                                                                                                                       |

One file per editor window: opening a file focuses its existing window, fills
an empty editor, or creates a new one tiled next to Files (cascading when no
layout is active). The title shows the path and a dot while unsaved.

### Command palette

`Ctrl+K` (or **Commands** in the top bar) opens a fuzzy-searchable list of
everything: layouts and window-manager actions, new windows per kind, files
of the active project (type a name to open it), workspaces, projects, Open
actions and the theme toggle. Commands live in a registry
(`src/ide/commands.ts`) that M3's Canvas API will expose.

### Theme

The desktop follows the system color scheme; the sun/moon button (or the
palette's "Toggle light / dark theme") forces one, stored under
`paperos-v2:theme`. The editor switches between a token-based light theme and
One Dark; the tldraw canvas follows too.

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
    window-kinds.tsx   registry of what a window can show (icon, size, component)
    kinds/             one file per kind: files, editor, preview, console,
                       markdown, note, about (+ file-picker for empty windows)
    create-window.ts   create a window with cascading placement
    cascade.ts         pure placement helper (unit tested)
    project-actions.ts Open folder / sample / ZIP / GitHub / dropped files
    ide-workspace.ts   the "IDE" arrangement, applied on first run
    ide-commands.ts    fills the command registry (WM, windows, files, ...)
    command-palette.tsx Ctrl+K palette over the registry
  ide/            The IDE (plain TypeScript apart from the hooks)
    project/           Project model: paths, tree, KV (IndexedDB) store,
                       memory + File System Access backends, sample, ZIP,
                       GitHub import, ProjectStore (paperos-v2:projects)
    docs.ts            one Y.Doc per file, y-indexeddb, dirty/save,
                       attachProvider() hook for a sync provider (M4)
    preview/bundle.ts  srcdoc bundler: inlines styles/scripts/SVG assets,
                       injects the console bridge (unit tested)
    editor/            CodeMirror factory (lazy) and the Prettier formatter
    commands.ts        command registry + fuzzy search (seed of M3's API)
    theme.ts           system / light / dark, data-theme on <html>
    console-store.ts, file-ref.ts, open-file.ts, signal.ts, palette-state.ts
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
e2e/              Playwright: smoke, window manager and IDE tests
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
  `src/desktop/desktop.tsx`. Files are already Yjs documents: call
  `attachProvider()` in `src/ide/docs.ts` with a function that connects a
  provider to each `Y.Doc`. No other code depends on where the data lives.
- **tldraw version:** one `tldraw` version serves both `/` and `/legacy`;
  bump `tldraw` and `@tldraw/assets` together in `package.json`.
