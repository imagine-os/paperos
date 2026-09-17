# PaperOS - notes for Claude Code

## What this is

PaperOS v2: a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive. A tiling engine arranges them (M1), windows hold IDE tools (M2),
a Canvas API makes the desktop programmable (M3), and projects carry a data
model (tables as JSON files) with Data, Schema and Connections windows (M4). The 2025 prototype is
frozen under `src/legacy/` and served at `/legacy`; it must keep working.

Read `docs/PLAN.md` for milestones and the architecture decisions already
made. Do not reopen those decisions without asking.

## Commands

```bash
npm run dev       # start at http://localhost:3000
npm run check     # typecheck + lint + unit tests; run before every push
npm run build     # production build; must pass before pushing
npm run e2e       # Playwright smoke test (needs Chromium available)
```

Constraints from the owner: no paid services, no accounts or API keys needed
to run. The tldraw watermark is fine. Keep upgrades (license key, sync
backend) one-line changes.

## Folder map

- `src/app/` routes. `/` is the v2 desktop, `/legacy` the prototype.
- `src/desktop/` the desktop: canvas, Window shape, window tool, window kinds
  registry, cascading placement.
- `src/wm/` window manager types and the layout engine.
- `src/ide/` the IDE: project model, per-file Yjs documents, preview bundler.
- `src/data/` the data model: schema, DataStore, bindings scanner, preview
  runtime, ERD layout. Pure TypeScript except `project-fs.ts`.
- `src/api/` the Canvas API (schema as data, facade, hosts, bridge client);
  `src/plugins/` the plugin system; `tools/paperos-mcp/` the MCP CLI.
- `src/lib/` shared helpers (env, bundled tldraw assets).
- `src/legacy/` the 2025 prototype, verbatim. Only touch it to keep it
  compiling. Its original working notes are in `src/legacy/README.md`.
- `e2e/` Playwright smoke tests. `docs/` plan. `tasks/todo.md` checklist.

## Conventions

1. Plan first: write the todo list to `tasks/todo.md`, tick items as you go,
   and finish with a Review section there.
2. Small, validated commits. Each commit should build on its own. Run
   `npm run check` and `npm run build` before every push.
3. Keep `/legacy` working. If a dependency bump breaks it, adapt minimally and
   note the change in `tasks/todo.md`.
4. Simplicity over cleverness. Prefer the smallest change that works; avoid
   new dependencies unless a milestone needs them.
5. New window content is a _window kind_ registered in
   `src/desktop/window-kinds.tsx`. Do not add new shape types for content.
6. Design tokens are CSS variables (`--pos-*`) in `src/app/globals.css`, with
   light and dark values. Do not hard-code colors in components.
7. tldraw assets come from `@tldraw/assets` via `src/lib/tldraw-assets.ts`.
   Never reference `cdn.tldraw.com`.
8. One `tldraw` version for the whole app; bump `tldraw` and `@tldraw/assets`
   together.
