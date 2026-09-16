# PaperOS

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive: everything you open lives in a window you can move, resize and
arrange. A tiling engine arranges windows into layouts, the windows hold IDE
tools (file tree, editors, previews, consoles), and a Canvas API later makes
the whole desktop programmable.

**Status:** v2 preview, milestone M0 (clean start). The desktop renders, you
can open, move, resize, edit and close windows, and the canvas survives a
refresh. Everything else is on the roadmap in [`docs/PLAN.md`](docs/PLAN.md).

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
    window-shape.tsx   the Window shape (title bar, close, content, min size)
    window-tool.ts     toolbar tool: press "w", click to open a window
    window-kinds.tsx   registry of what a window can show (note, about, ...)
    kinds/             one file per kind
    create-window.ts   create a window with cascading placement
    cascade.ts         pure placement helper (unit tested)
  wm/             Window manager: layout types and the engine placeholder (M1)
  lib/            Shared helpers: env, bundled tldraw assets
  legacy/         The 2025 prototype, moved verbatim (see src/legacy/README.md)
e2e/              Playwright smoke test
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
