# tasks/todo.md

## M0 - Clean start

- [x] Preserve the 2025 prototype: branch `legacy` at `aa5f51d` (pushed);
      annotated tag `v0-prototype` created locally (push blocked, see Review)
- [x] Move prototype source verbatim to `src/legacy/`, route `/legacy`, banner
      back to `/`
- [x] Fresh dependency set: Next 15, React 19, tldraw 3.15.6 (+ `@tldraw/assets`),
      TypeScript strict, ESLint 9 flat config, Prettier, Vitest, Playwright
- [x] Bundle tldraw assets from `@tldraw/assets` (no `cdn.tldraw.com`)
- [x] Optional `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`, documented in `.env.example`
- [x] Route `/`: full-viewport canvas with `persistenceKey="paperos-v2"`
- [x] Top bar: PaperOS, "v2 preview" badge, Legacy link, New window, About
- [x] `Window` shape: title bar, close, focus-to-front, resize with min size,
      default size, tokens, light + dark
- [x] Window kinds registry: `note` (editable, persisted) and `about`
- [x] `w` tool creates a window on click; New window creates at viewport
      center; cascading placement
- [x] `src/wm/` types (`LayoutNode`, `Workspace`) and engine placeholder
- [x] Legacy auth route kept, `LIVEBLOCKS_SECRET_KEY` optional (503 without it)
- [x] README, CLAUDE.md, docs/PLAN.md, .env.example
- [x] CI workflow: `npm ci`, `npm run check`, `npm run build`
- [x] Unit tests (cascade, kinds registry) and Playwright smoke test
- [x] Validate: `npm run check`, `npm run build`, screenshots, e2e
- [x] Push to `main`

## M1 - Window manager

- [ ] Plan written, foundation read (`src/desktop/`, `src/wm/`, docs)
- [ ] Layout engine (`src/wm/`): types, `layout()` with gaps/padding/min sizes,
      presets (free, columns, grid, bento x3, split-tree), operations
      (insert/splitLeaf/swap/resizeRatio/remove/prune/tile), geometry helpers
      (drop zones, neighbour search), unit tests incl. rectangle invariants
- [ ] `Window` shape: `tiled` prop + migration, tiled look, focus ring,
      double-click title edit, per-window menu, long-press menu
- [ ] `WindowManager` service: region = viewport bounds, apply layouts via one
      `updateShapes` batch, z-order (tiled below floating), drag-detach,
      drop swap/insert with quadrant hint, gutter resize overlay
- [ ] Workspaces: typed localStorage store (`paperos-v2:workspaces`),
      defaults Desk + Grid, top-bar menu (save/switch/rename/duplicate/delete),
      camera animation on switch
- [ ] Controls: Layout menu, Tile all / Untile all / Focus mode, keyboard via
      `overrides.actions` (Alt+1..5, Alt+Arrows, Alt+Shift+Arrows, Alt+Enter,
      Alt+F, Alt+N), responsive reflow (debounced), narrow columns collapse
- [ ] Docs: PLAN.md (M1 status + decisions), README (shortcuts, workspaces),
      this checklist + Review
- [ ] Tests: unit (engine, stores), e2e `e2e/wm.spec.ts`
- [ ] Validate: `npm run check`, `npm run build`, screenshots, e2e, push

## Review (M0)

### What changed

- The repo is now the PaperOS v2 app. `/` is the desktop, `/legacy` the 2025
  prototype. Old template files (`.eslintrc.json`, `next.config.js`, the
  Liveblocks template README) are replaced.
- `src/desktop/` holds the canvas, the `Window` shape, the `w` tool, the
  window kinds registry and cascading placement. `src/wm/` holds the layout
  types for M1. `src/lib/` holds env and asset helpers.
- Verified in a real browser (1440x900): toolbar icons load from the bundle,
  three windows cascade, text typed in a note is stored in shape props and
  survives a reload, `w` + click creates a window, close removes it, drag
  moves it, dark mode follows the system. No console errors on `/` other
  than Next's CSS preload notices. `/legacy` logs the expected Liveblocks
  auth failure (503, key not configured) and nothing else app-related.

### Legacy adaptations (kept to the minimum)

1. Import paths: `@/components/Loading` -> `@/legacy/Loading`,
   `@/database` -> `@/legacy/database`; `page.tsx` moved to
   `src/app/legacy/page.tsx` with the banner added around the original tree.
2. `src/types/tldraw-extensions.d.ts` deleted (pointed at a path that no
   longer existed and misused tldraw's types).
3. `StorageTldraw.tsx`: root `div` is `100%` instead of `100vh/100vw` so it
   fits under the banner; `assetUrls` now uses the bundled tldraw assets
   (the CDN is unreachable from some networks, and the icons rendered blank).
4. `project-browser.component.tsx:82`: `editor.getShape<IProjectBrowserShape>(...)`
   so `props.w` typechecks under tldraw 3.15 / TS 5.9.
5. `api/liveblocks-auth/route.ts`: Liveblocks client is created inside the
   handler and the route answers 503 when `LIVEBLOCKS_SECRET_KEY` is unset
   (before, the module threw at import time). The unused `request` parameter
   was dropped.
6. `@codemirror/state` added as an explicit dependency (the legacy editor
   imports it directly; it used to arrive transitively).
7. ESLint: the legacy folder keeps the prototype's habits as warnings, not
   errors (`eslint.config.mjs`).

### Decisions and notes

- Next 15 (15.5.x) as decided, even though Next 16 is out. tldraw stays on
  3.x (3.15.6): 4.x and 5.x exist, but one version must serve both apps and
  3.x is what the legacy code was written for.
- Vitest is 3.x: npm 10.9 crashed resolving Vitest 4's optional peers.
- The Playwright smoke test is `npm run e2e`, not part of CI yet: CI would
  need a Chromium download step. Add it when the suite is worth the minute.
- Fonts: system font stack instead of `next/font/google` so builds work
  offline and without third-party requests.
- **Tag `v0-prototype` not pushed:** the automated session's credential only
  permits `refs/heads/*` updates ("push contains a ref outside refs/heads/*")
  and the GitHub API write path is blocked through the proxy. The `legacy`
  branch preserves the same commit. Create the tag from any normal clone:
  `git tag -a v0-prototype aa5f51d -m "2025 prototype before the v2 rebuild" && git push origin v0-prototype`.
