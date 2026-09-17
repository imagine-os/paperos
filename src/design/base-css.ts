/**
 * Base styles for the starter component library, written against the
 * `--ds-*` token variables so a token change (or a theme preset) restyles
 * every component. The bundler injects this after the token CSS whenever a
 * project has `design/tokens.json`; pages and the component gallery get it
 * too. The language is docs/BRAND.md: paper and ink, one accent gradient,
 * hairlines and layered shadows, quiet motion, the dot grid as texture.
 */
export const BASE_CSS = `
/* ----- page ----- */
.ds-page { margin: 0; min-height: 100vh; background: var(--ds-color-bg); color: var(--ds-color-text); font-family: var(--ds-font-sans); font-size: var(--ds-font-size-md); line-height: var(--ds-line-height-normal); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.ds-page--dots, .ds-page[data-texture="dots"] { background-image: radial-gradient(var(--ds-color-dot) 1px, transparent 1px); background-size: 24px 24px; }
.ds-page * { box-sizing: border-box; }
.ds-page :focus-visible { outline: 2px solid var(--ds-color-primary); outline-offset: 3px; border-radius: var(--ds-radius-sm); }
.ds-page h1, .ds-page h2, .ds-page h3, .ds-page h4 { font-family: var(--ds-font-display); color: var(--ds-color-ink); letter-spacing: var(--ds-tracking-display); text-wrap: balance; margin: 0; }
.ds-page a:not([class]) { color: var(--ds-color-primary); }
.ds-grid { display: grid; grid-template-columns: repeat(var(--ds-page-columns, 12), minmax(0, 1fr)); gap: var(--ds-page-gap, var(--ds-space-4)); padding: var(--ds-space-4); max-width: var(--ds-page-max-width, 1200px); margin: 0 auto; }
.ds-col { min-width: 0; }
@media (max-width: 700px) { .ds-grid { grid-template-columns: 1fr; padding: var(--ds-space-3); } .ds-col { grid-column: span 1 !important; } }
.ds-missing { padding: var(--ds-space-3); border: 1px dashed var(--ds-color-danger); color: var(--ds-color-danger); border-radius: var(--ds-radius-md); font-size: var(--ds-font-size-sm); }
@media (prefers-reduced-motion: reduce) { .ds-page *, .ds-page *::before, .ds-page *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

/* Surfaces: a hairline gradient border (padding-box / border-box trick), soft depth. */
.ds-surface, .ds-card, .ds-table-wrap, .ds-form, .ds-nav--vertical, .ds-mega, .ds-stat, .ds-list, .ds-tabs, .ds-modal__dialog, .ds-pricing__plan, .ds-testimonial, .ds-faq, .ds-sidebar, .ds-kpi__item, .ds-timeline, .ds-calendar, .ds-kanban__col, .ds-thread, .ds-chart, .ds-empty, .ds-post, .ds-ad, .ds-tabbar, .ds-header { background: linear-gradient(var(--ds-color-surface), var(--ds-color-surface)) padding-box, linear-gradient(180deg, var(--ds-color-borderStrong), var(--ds-color-border)) border-box; border: 1px solid transparent; border-radius: var(--ds-radius-md); color: var(--ds-color-text); }
.ds-glass { background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); border: 1px solid var(--ds-color-border); }
.ds-kicker, .ds-eyebrow { font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-semibold); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-primary); }
.ds-gradient-text { background: var(--ds-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }

/* ----- Button ----- */
.ds-button { display: inline-flex; align-items: center; justify-content: center; gap: var(--ds-space-2); min-height: 44px; padding: 0 var(--ds-space-5); border-radius: var(--ds-radius-full); border: 1px solid var(--ds-color-borderStrong); background: var(--ds-color-surface); color: var(--ds-color-ink); font: inherit; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-semibold); text-decoration: none; cursor: pointer; line-height: 1.2; white-space: nowrap; transition: transform var(--ds-motion-fast) var(--ds-motion-ease), box-shadow var(--ds-motion-fast) var(--ds-motion-ease), background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-button:hover { transform: translateY(-1px); background: var(--ds-color-surface2); }
.ds-button:active { transform: translateY(0); }
.ds-button--primary { background: var(--ds-gradient); border-color: transparent; color: var(--ds-color-accentInk); box-shadow: var(--ds-shadow-sm); }
.ds-button--primary:hover { background: var(--ds-gradient); box-shadow: var(--ds-shadow-glow); }
.ds-button--accent { background: var(--ds-color-accent); border-color: transparent; color: var(--ds-color-accentInk); }
.ds-button--accent:hover { background: var(--ds-color-accent); filter: brightness(1.05); }
.ds-button--danger { background: var(--ds-color-danger); border-color: transparent; color: #fff; }
.ds-button--danger:hover { background: var(--ds-color-danger); filter: brightness(1.05); }
.ds-button--ghost { background: transparent; border-color: transparent; color: var(--ds-color-text); }
.ds-button--outline { background: transparent; border-color: var(--ds-color-primary); color: var(--ds-color-primary); }
.ds-button--secondary { background: var(--ds-color-surface); }
.ds-button--sm { min-height: 32px; padding: 0 var(--ds-space-3); font-size: var(--ds-font-size-xs); }
.ds-button--lg { min-height: 48px; padding: 0 var(--ds-space-6); font-size: var(--ds-font-size-md); }
.ds-button--full { width: 100%; }
.ds-button__icon { display: inline-flex; width: 1.1em; height: 1.1em; }
.ds-button__icon svg { width: 100%; height: 100%; }

/* ----- Card ----- */
.ds-card { overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--ds-shadow-sm); transition: transform var(--ds-motion-fast) var(--ds-motion-ease), box-shadow var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-card--hover:hover, a.ds-card:hover { transform: translateY(-3px); box-shadow: var(--ds-shadow-md); }
.ds-card--elevated { box-shadow: var(--ds-shadow-md); }
.ds-card--outlined { box-shadow: none; }
.ds-card--flat { box-shadow: none; background: transparent; border-color: transparent; }
.ds-card--glass { background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); }
.ds-card--accent { background: var(--ds-gradient); border-color: transparent; color: var(--ds-color-accentInk); }
.ds-card--accent .ds-card__title, .ds-card--accent .ds-card__text, .ds-card--accent .ds-card__kicker { color: inherit; }
.ds-card__image { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: var(--ds-color-bg2); }
.ds-card__body { padding: var(--ds-space-5); display: flex; flex-direction: column; gap: var(--ds-space-2); flex: 1; }
.ds-card__kicker { margin: 0; }
.ds-card__title { font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); line-height: var(--ds-line-height-snug); }
.ds-card__text { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-card__icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--ds-radius-sm); background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); border: 1px solid color-mix(in srgb, var(--ds-color-primary) 25%, transparent); color: var(--ds-color-primary); font-size: 20px; margin-bottom: var(--ds-space-2); transition: transform var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-card:hover .ds-card__icon { transform: rotate(-4deg) scale(1.05); }
.ds-card__footer { padding: var(--ds-space-3) var(--ds-space-5); border-top: 1px solid var(--ds-color-border); display: flex; gap: var(--ds-space-2); align-items: center; }

/* ----- Table ----- */
.ds-table-wrap { overflow: auto; max-height: var(--ds-table-max-height, none); box-shadow: var(--ds-shadow-sm); }
.ds-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--ds-font-size-sm); }
.ds-table th, .ds-table td { padding: var(--ds-space-3) var(--ds-space-4); text-align: left; border-bottom: 1px solid var(--ds-color-border); white-space: nowrap; vertical-align: middle; }
.ds-table th { position: sticky; top: 0; z-index: 1; font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); font-weight: var(--ds-font-weight-semibold); background: var(--ds-color-surface2); }
.ds-table tbody tr { transition: background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-table tbody tr:hover td { background: color-mix(in srgb, var(--ds-color-primary) 6%, transparent); }
.ds-table tbody tr:last-child td { border-bottom: 0; }
.ds-table--striped tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--ds-color-surface2) 70%, transparent); }
.ds-table--compact th, .ds-table--compact td { padding: var(--ds-space-1) var(--ds-space-3); }
.ds-table--comfortable th, .ds-table--comfortable td { padding: var(--ds-space-4) var(--ds-space-5); }
.ds-table__thumb { width: 36px; height: 28px; border-radius: var(--ds-radius-sm); object-fit: cover; display: block; }
.ds-table__caption { padding: var(--ds-space-3) var(--ds-space-4); font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-semibold); color: var(--ds-color-ink); text-align: left; caption-side: top; }
.ds-table__empty { padding: var(--ds-space-5); color: var(--ds-color-muted); text-align: center; }
.ds-table td[data-tone="ok"], .ds-tone-ok { color: var(--ds-color-ok); }
.ds-table td[data-tone="warn"], .ds-tone-warn { color: var(--ds-color-warn); }
.ds-table td[data-tone="danger"], .ds-tone-danger { color: var(--ds-color-danger); }

/* ----- Form ----- */
.ds-form { display: flex; flex-direction: column; gap: var(--ds-space-4); padding: var(--ds-space-5); box-shadow: var(--ds-shadow-sm); }
.ds-form--inline { flex-direction: row; flex-wrap: wrap; align-items: end; }
.ds-form--plain { background: transparent; border-color: transparent; box-shadow: none; padding: 0; }
.ds-form__title { font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); }
.ds-form__text { margin: calc(-1 * var(--ds-space-2)) 0 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-field { display: flex; flex-direction: column; gap: var(--ds-space-1); font-size: var(--ds-font-size-sm); position: relative; }
.ds-field--check { flex-direction: row; align-items: center; gap: var(--ds-space-2); min-height: 44px; }
.ds-field--check input { width: 18px; height: 18px; accent-color: var(--ds-color-primary); }
.ds-field__label { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); font-weight: var(--ds-font-weight-medium); text-transform: uppercase; letter-spacing: 0.04em; }
.ds-field__hint { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }
.ds-input, .ds-select, .ds-textarea { font: inherit; font-size: var(--ds-font-size-sm); min-height: 44px; padding: var(--ds-space-2) var(--ds-space-3); border: 1px solid var(--ds-color-borderStrong); border-radius: var(--ds-radius-sm); background: var(--ds-color-surface); color: var(--ds-color-text); width: 100%; transition: border-color var(--ds-motion-fast) var(--ds-motion-ease), box-shadow var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-textarea { min-height: 96px; resize: vertical; }
.ds-input:focus, .ds-select:focus, .ds-textarea:focus { outline: none; border-color: var(--ds-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-color-primary) 22%, transparent); }
.ds-input:user-invalid, .ds-select:user-invalid, .ds-field--invalid .ds-input { border-color: var(--ds-color-danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-color-danger) 18%, transparent); }
.ds-field--valid .ds-input, .ds-input:user-valid:not(:placeholder-shown) { border-color: var(--ds-color-ok); }
.ds-field__error { color: var(--ds-color-danger); font-size: var(--ds-font-size-xs); }
/* Floating labels: the label sits inside the field and lifts on focus or when filled. */
.ds-field--float { gap: 0; }
.ds-field--float .ds-input, .ds-field--float .ds-select { padding-top: 18px; padding-bottom: 6px; min-height: 52px; }
.ds-field--float .ds-field__label { position: absolute; left: var(--ds-space-3); top: 16px; text-transform: none; letter-spacing: 0; font-size: var(--ds-font-size-sm); color: var(--ds-color-muted); pointer-events: none; transition: all var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-field--float .ds-input:focus ~ .ds-field__label, .ds-field--float .ds-input:not(:placeholder-shown) ~ .ds-field__label, .ds-field--float .ds-select ~ .ds-field__label { top: 6px; font-size: var(--ds-font-size-xs); color: var(--ds-color-primary); text-transform: uppercase; letter-spacing: 0.04em; }
.ds-field__required { color: var(--ds-color-primary); }
.ds-form__actions { display: flex; gap: var(--ds-space-2); justify-content: flex-end; flex-wrap: wrap; }
.ds-form--inline .ds-field { flex: 1 1 160px; }

/* ----- Nav ----- */
.ds-nav { padding: var(--ds-space-2); }
.ds-nav ul { list-style: none; margin: 0; padding: 0; }
.ds-nav__children { margin-left: var(--ds-space-4) !important; border-left: 1px solid var(--ds-color-border); }
.ds-nav__link { display: flex; align-items: center; gap: var(--ds-space-2); min-height: 40px; padding: var(--ds-space-2) var(--ds-space-3); border-radius: var(--ds-radius-sm); color: inherit; text-decoration: none; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-medium); transition: background var(--ds-motion-fast) var(--ds-motion-ease), color var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-nav__link:hover { background: var(--ds-color-surface2); color: var(--ds-color-ink); }
.ds-nav__link--active, .ds-nav__link[aria-current="page"] { background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); color: var(--ds-color-primary); }
.ds-nav__link--child { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); min-height: 32px; }
.ds-nav__brand { font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-display); padding: var(--ds-space-2) var(--ds-space-3); color: var(--ds-color-ink); }
.ds-nav--horizontal { display: flex; align-items: center; gap: var(--ds-space-3); padding: var(--ds-space-2) var(--ds-space-4); border-radius: var(--ds-radius-full); background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); border: 1px solid var(--ds-color-border); }
.ds-nav--horizontal .ds-nav__list { display: flex; gap: var(--ds-space-1); flex-wrap: wrap; }
.ds-nav--horizontal .ds-nav__children { display: none; }
.ds-nav--horizontal .ds-nav__spacer { flex: 1; }
.ds-nav--sticky { position: sticky; top: var(--ds-space-3); z-index: 20; }

/* ----- Topbar ----- */
.ds-topbar { display: flex; align-items: center; gap: var(--ds-space-4); min-height: 60px; padding: var(--ds-space-2) var(--ds-space-5); background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); border-bottom: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-md); }
.ds-topbar--sticky { position: sticky; top: 0; z-index: 30; border-radius: 0; }
.ds-topbar__brand { display: flex; align-items: center; gap: var(--ds-space-2); font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-display); color: var(--ds-color-ink); text-decoration: none; font-size: var(--ds-font-size-lg); }
.ds-topbar__mark { width: 28px; height: 28px; border-radius: 8px; background: var(--ds-gradient); box-shadow: var(--ds-shadow-sm); flex: none; }
.ds-topbar__links { display: flex; gap: var(--ds-space-1); list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
.ds-topbar__links a { display: inline-flex; align-items: center; min-height: 36px; padding: 0 var(--ds-space-3); border-radius: var(--ds-radius-full); color: var(--ds-color-text); text-decoration: none; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-medium); transition: background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-topbar__links a:hover { background: var(--ds-color-surface2); color: var(--ds-color-ink); }
.ds-topbar__spacer { flex: 1; }
.ds-topbar__actions { display: flex; align-items: center; gap: var(--ds-space-2); flex-wrap: wrap; }
.ds-topbar .ds-select, .ds-topbar .ds-input { min-height: 36px; width: auto; padding: 0 var(--ds-space-3); border-radius: var(--ds-radius-full); font-size: var(--ds-font-size-xs); }
@media (max-width: 700px) { .ds-topbar { flex-wrap: wrap; min-height: 52px; padding: var(--ds-space-2) var(--ds-space-3); } .ds-topbar__links { display: none; } }

/* ----- Mega menu ----- */
.ds-mega { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--ds-space-5); padding: var(--ds-space-5); box-shadow: var(--ds-shadow-md); }
.ds-mega ul { list-style: none; margin: 0; padding: 0; }
.ds-mega__heading { font-family: var(--ds-font-sans); font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); margin: 0 0 var(--ds-space-3); padding-bottom: var(--ds-space-2); border-bottom: 1px solid var(--ds-color-border); }
.ds-mega__item { margin-bottom: var(--ds-space-1); }
.ds-mega__link { display: flex; gap: var(--ds-space-3); align-items: center; color: inherit; text-decoration: none; padding: var(--ds-space-2); margin: 0 calc(-1 * var(--ds-space-2)); border-radius: var(--ds-radius-sm); transition: background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-mega__link:hover { background: var(--ds-color-surface2); }
.ds-mega__link:hover .ds-mega__label { color: var(--ds-color-primary); }
.ds-mega__thumb { width: 48px; height: 36px; border-radius: var(--ds-radius-sm); object-fit: cover; flex: none; box-shadow: var(--ds-shadow-sm); }
.ds-mega__text { display: flex; flex-direction: column; min-width: 0; }
.ds-mega__label { font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); color: var(--ds-color-ink); }
.ds-mega__desc { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }

/* ----- Hero ----- */
.ds-hero { position: relative; padding: clamp(40px, 7vw, 96px) clamp(20px, 5vw, 64px); border-radius: var(--ds-radius-lg); background: var(--ds-color-surface); background-image: radial-gradient(var(--ds-color-dot) 1px, transparent 1px), radial-gradient(60% 80% at 100% 0%, color-mix(in srgb, var(--ds-color-accent2) 22%, transparent), transparent 60%), radial-gradient(50% 70% at 0% 100%, color-mix(in srgb, var(--ds-color-accent) 16%, transparent), transparent 60%); background-size: 24px 24px, 100% 100%, 100% 100%; border: 1px solid var(--ds-color-border); display: grid; gap: var(--ds-space-4); align-content: center; overflow: hidden; box-shadow: var(--ds-shadow-sm); }
.ds-hero--center { text-align: center; justify-items: center; }
.ds-hero--split { grid-template-columns: 1.1fr 0.9fr; align-items: center; gap: var(--ds-space-7); }
.ds-hero--dark { background: #0d0c11; background-image: radial-gradient(rgba(242, 234, 217, 0.14) 1px, transparent 1px), radial-gradient(60% 80% at 100% 0%, rgba(255, 194, 107, 0.22), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(255, 92, 138, 0.18), transparent 60%); color: #d8d2c6; border-color: rgba(242, 234, 217, 0.12); }
.ds-hero--dark .ds-hero__title { color: #f2ead9; }
.ds-hero--dark .ds-hero__subtitle { color: rgba(216, 210, 198, 0.8); }
.ds-hero--glass { background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); }
.ds-hero--compact { padding: clamp(24px, 4vw, 48px) clamp(20px, 4vw, 40px); }
.ds-hero__content { display: grid; gap: var(--ds-space-4); max-width: 60ch; }
.ds-hero--center .ds-hero__content { justify-items: center; }
.ds-hero__eyebrow { margin: 0; }
.ds-hero__title { font-size: var(--ds-font-size-3xl); line-height: var(--ds-line-height-tight); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-hero); }
.ds-hero__title--gradient { background: var(--ds-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: 0.08em; }
.ds-hero__subtitle { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-lg); max-width: 56ch; }
.ds-hero__actions { display: flex; gap: var(--ds-space-3); flex-wrap: wrap; margin-top: var(--ds-space-2); }
.ds-hero__image { width: 100%; border-radius: var(--ds-radius-md); box-shadow: var(--ds-shadow-lg); border: 1px solid var(--ds-color-border); }
.ds-hero__note { margin: 0; font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
@media (max-width: 700px) { .ds-hero--split { grid-template-columns: 1fr; } }

/* ----- Stat / KPI ----- */
.ds-stat { padding: var(--ds-space-4) var(--ds-space-5); display: flex; flex-direction: column; gap: var(--ds-space-1); box-shadow: var(--ds-shadow-sm); min-width: 0; }
.ds-stat__label { font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); font-weight: var(--ds-font-weight-medium); }
.ds-stat__value { font-family: var(--ds-font-display); font-size: var(--ds-font-size-2xl); font-weight: var(--ds-font-weight-bold); line-height: var(--ds-line-height-tight); letter-spacing: var(--ds-tracking-display); color: var(--ds-color-ink); font-variant-numeric: tabular-nums; }
.ds-stat__delta { display: inline-flex; align-items: center; gap: 4px; font-size: var(--ds-font-size-sm); color: var(--ds-color-muted); }
.ds-stat--up .ds-stat__delta { color: var(--ds-color-ok); }
.ds-stat--down .ds-stat__delta { color: var(--ds-color-danger); }
.ds-stat--up .ds-stat__delta::before { content: "\\2191"; font-weight: 700; }
.ds-stat--down .ds-stat__delta::before { content: "\\2193"; font-weight: 700; }
.ds-stat--flat .ds-stat__delta::before { content: "\\2192"; opacity: 0.6; }
.ds-stat--primary { background: var(--ds-gradient); border-color: transparent; color: var(--ds-color-accentInk); }
.ds-stat--primary .ds-stat__label, .ds-stat--primary .ds-stat__delta, .ds-stat--primary .ds-stat__value { color: inherit; }
.ds-stat--glass { background: var(--ds-color-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.ds-kpi { display: grid; grid-template-columns: repeat(var(--ds-kpi-columns, 4), minmax(0, 1fr)); gap: var(--ds-space-4); }
.ds-kpi__item { padding: var(--ds-space-4) var(--ds-space-5); display: flex; flex-direction: column; gap: var(--ds-space-1); box-shadow: var(--ds-shadow-sm); position: relative; overflow: hidden; }
.ds-kpi__item::after { content: ""; position: absolute; inset: auto 0 0 0; height: 3px; background: var(--ds-gradient); opacity: 0.9; }
.ds-kpi__item--up::after { background: var(--ds-color-ok); }
.ds-kpi__item--down::after { background: var(--ds-color-danger); }
@media (max-width: 900px) { .ds-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .ds-kpi { grid-template-columns: 1fr; } }

/* ----- List ----- */
.ds-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--ds-shadow-sm); }
.ds-list__item { display: flex; align-items: center; gap: var(--ds-space-3); padding: var(--ds-space-3) var(--ds-space-4); border-bottom: 1px solid var(--ds-color-border); min-height: 56px; transition: background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-list__item:hover { background: var(--ds-color-surface2); }
.ds-list__item:last-child { border-bottom: 0; }
.ds-list__thumb { width: 44px; height: 44px; border-radius: var(--ds-radius-sm); object-fit: cover; flex: none; background: var(--ds-color-bg2); }
.ds-list__body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ds-list__body strong { color: var(--ds-color-ink); font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); }
.ds-list__body small { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }
.ds-list__meta { margin-left: auto; font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ds-list--plain { border: 0; background: transparent; box-shadow: none; }
.ds-list--plain .ds-list__item { padding: var(--ds-space-2) 0; }
.ds-list__empty { padding: var(--ds-space-5); color: var(--ds-color-muted); text-align: center; }

/* ----- Grid block ----- */
.ds-grid-block { display: grid; grid-template-columns: repeat(var(--ds-block-columns, 3), minmax(0, 1fr)); gap: var(--ds-block-gap, var(--ds-space-4)); }
.ds-grid-block > .ds-col { grid-column: auto !important; }
@media (max-width: 700px) { .ds-grid-block { grid-template-columns: 1fr; } }

/* ----- Section ----- */
.ds-section { display: grid; gap: var(--ds-space-5); padding: clamp(24px, 4vw, 48px) 0; }
.ds-section__head { display: grid; gap: var(--ds-space-2); max-width: 60ch; }
.ds-section--center .ds-section__head { text-align: center; margin: 0 auto; }
.ds-section__title { font-size: var(--ds-font-size-2xl); line-height: var(--ds-line-height-snug); font-weight: var(--ds-font-weight-bold); }
.ds-section__text { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-lg); }
.ds-section__body { display: grid; grid-template-columns: repeat(var(--ds-section-columns, 3), minmax(0, 1fr)); gap: var(--ds-space-4); }
.ds-section__body > .ds-col { grid-column: auto !important; }
@media (max-width: 700px) { .ds-section__body { grid-template-columns: 1fr; } }

/* ----- Page header ----- */
.ds-header { display: flex; align-items: center; gap: var(--ds-space-4); padding: var(--ds-space-4) var(--ds-space-5); flex-wrap: wrap; }
.ds-header__text { display: grid; gap: 2px; flex: 1; min-width: 200px; }
.ds-header__title { font-size: var(--ds-font-size-xl); font-weight: var(--ds-font-weight-bold); }
.ds-header__subtitle { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-header__actions { display: flex; gap: var(--ds-space-2); flex-wrap: wrap; align-items: center; }
.ds-header--plain { background: transparent; border-color: transparent; padding-left: 0; padding-right: 0; }

/* ----- Tabs ----- */
.ds-tabs { overflow: hidden; box-shadow: var(--ds-shadow-sm); }
.ds-tabs__bar { display: flex; gap: var(--ds-space-1); padding: var(--ds-space-2) var(--ds-space-3) 0; border-bottom: 1px solid var(--ds-color-border); overflow-x: auto; }
.ds-tabs__tab { font: inherit; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-medium); min-height: 40px; padding: var(--ds-space-2) var(--ds-space-3); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--ds-color-muted); cursor: pointer; white-space: nowrap; transition: color var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-tabs__tab:hover { color: var(--ds-color-ink); }
.ds-tabs__tab--active { color: var(--ds-color-primary); border-bottom-color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); }
.ds-tabs__panel { display: none; padding: var(--ds-space-5); }
.ds-tabs__panel--active { display: block; }
.ds-tabs--pills .ds-tabs__bar { border-bottom: 0; padding: var(--ds-space-2); gap: var(--ds-space-2); }
.ds-tabs--pills .ds-tabs__tab { border-radius: var(--ds-radius-full); border-bottom: 0; }
.ds-tabs--pills .ds-tabs__tab--active { background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); }

/* ----- Tab bar (mobile bottom navigation) ----- */
.ds-tabbar { display: flex; justify-content: space-around; align-items: stretch; padding: var(--ds-space-1) var(--ds-space-2); background: var(--ds-color-glass); -webkit-backdrop-filter: saturate(140%) blur(14px); backdrop-filter: saturate(140%) blur(14px); border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); }
.ds-tabbar--fixed { position: fixed; left: var(--ds-space-3); right: var(--ds-space-3); bottom: var(--ds-space-3); z-index: 40; }
.ds-tabbar__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--ds-space-2) var(--ds-space-1); border-radius: var(--ds-radius-sm); color: var(--ds-color-muted); text-decoration: none; font-size: 11px; font-weight: var(--ds-font-weight-medium); min-height: 52px; justify-content: center; transition: color var(--ds-motion-fast) var(--ds-motion-ease), background var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-tabbar__item:hover { color: var(--ds-color-ink); }
.ds-tabbar__item--active, .ds-tabbar__item[aria-current="page"] { color: var(--ds-color-primary); }
.ds-tabbar__icon { width: 22px; height: 22px; display: grid; place-items: center; font-size: 18px; }
.ds-tabbar__icon svg { width: 22px; height: 22px; }
.ds-tabbar__item--active .ds-tabbar__icon { transform: translateY(-1px); }
.ds-page--tabbar { padding-bottom: 88px; }

/* ----- Modal ----- */
.ds-modal { position: fixed; inset: 0; display: grid; place-items: center; z-index: 50; }
.ds-modal[data-open="false"] { display: none; }
.ds-modal__backdrop { position: absolute; inset: 0; background: rgba(13, 12, 17, 0.5); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.ds-modal__dialog { position: relative; width: min(480px, calc(100vw - 32px)); border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-lg); animation: ds-rise var(--ds-motion-slow) var(--ds-motion-ease) both; }
.ds-modal--inline { position: static; display: block; }
.ds-modal--inline .ds-modal__backdrop { display: none; }
.ds-modal--inline .ds-modal__dialog { width: 100%; box-shadow: var(--ds-shadow-sm); animation: none; }
.ds-modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--ds-space-4) var(--ds-space-5); border-bottom: 1px solid var(--ds-color-border); }
.ds-modal__header h3 { font-size: var(--ds-font-size-lg); }
.ds-modal__close { font: inherit; font-size: 20px; line-height: 1; width: 32px; height: 32px; border-radius: var(--ds-radius-full); border: 0; background: none; color: var(--ds-color-muted); cursor: pointer; }
.ds-modal__close:hover { background: var(--ds-color-surface2); color: var(--ds-color-ink); }
.ds-modal__body { padding: var(--ds-space-5); color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-modal__footer { display: flex; justify-content: flex-end; gap: var(--ds-space-2); padding: var(--ds-space-3) var(--ds-space-5); border-top: 1px solid var(--ds-color-border); }
@keyframes ds-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* ----- Badge ----- */
.ds-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px var(--ds-space-2); border-radius: var(--ds-radius-full); font-size: var(--ds-font-size-xs); font-weight: var(--ds-font-weight-semibold); line-height: 1.6; background: var(--ds-color-surface2); color: var(--ds-color-text); border: 1px solid var(--ds-color-border); white-space: nowrap; }
.ds-badge--outline { background: transparent; border-color: var(--ds-color-borderStrong); text-transform: uppercase; letter-spacing: 0.04em; }
.ds-badge--primary { background: color-mix(in srgb, var(--ds-color-primary) 14%, transparent); color: var(--ds-color-primary); border-color: color-mix(in srgb, var(--ds-color-primary) 25%, transparent); }
.ds-badge--accent { background: color-mix(in srgb, var(--ds-color-accent) 14%, transparent); color: var(--ds-color-accent); border-color: color-mix(in srgb, var(--ds-color-accent) 25%, transparent); }
.ds-badge--success, .ds-badge--ok { background: color-mix(in srgb, var(--ds-color-ok) 14%, transparent); color: var(--ds-color-ok); border-color: color-mix(in srgb, var(--ds-color-ok) 25%, transparent); }
.ds-badge--warn { background: color-mix(in srgb, var(--ds-color-warn) 16%, transparent); color: var(--ds-color-warn); border-color: color-mix(in srgb, var(--ds-color-warn) 25%, transparent); }
.ds-badge--danger { background: color-mix(in srgb, var(--ds-color-danger) 14%, transparent); color: var(--ds-color-danger); border-color: color-mix(in srgb, var(--ds-color-danger) 25%, transparent); }
.ds-badge--solid { background: var(--ds-gradient); color: var(--ds-color-accentInk); border-color: transparent; }
.ds-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.ds-badge--pulse .ds-badge__dot { animation: ds-pulse 1.6s var(--ds-motion-ease) infinite; }
@keyframes ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ----- Avatar ----- */
.ds-avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ds-radius-full); background: color-mix(in srgb, var(--ds-color-primary) 16%, var(--ds-color-surface)); color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); overflow: hidden; vertical-align: middle; flex: none; border: 1px solid color-mix(in srgb, var(--ds-color-primary) 25%, transparent); }
.ds-avatar[data-hue] { background: color-mix(in srgb, hsl(var(--ds-avatar-hue) 70% 50%) 20%, var(--ds-color-surface)); color: hsl(var(--ds-avatar-hue) 55% 38%); border-color: color-mix(in srgb, hsl(var(--ds-avatar-hue) 70% 50%) 30%, transparent); }
.ds-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ds-avatar--xs { width: 24px; height: 24px; font-size: 10px; }
.ds-avatar--sm { width: 28px; height: 28px; font-size: var(--ds-font-size-xs); }
.ds-avatar--lg { width: 64px; height: 64px; font-size: var(--ds-font-size-lg); }
.ds-avatar--square { border-radius: var(--ds-radius-sm); }
.ds-avatar--ring { box-shadow: 0 0 0 2px var(--ds-color-surface), 0 0 0 4px var(--ds-color-primary); }
.ds-avatar-group { display: inline-flex; }
.ds-avatar-group .ds-avatar { margin-left: -8px; border: 2px solid var(--ds-color-surface); }
.ds-avatar-group .ds-avatar:first-child { margin-left: 0; }

/* ----- Pricing ----- */
.ds-pricing { display: grid; grid-template-columns: repeat(var(--ds-pricing-columns, 3), minmax(0, 1fr)); gap: var(--ds-space-4); align-items: stretch; }
.ds-pricing__plan { display: flex; flex-direction: column; gap: var(--ds-space-3); padding: var(--ds-space-5); box-shadow: var(--ds-shadow-sm); position: relative; transition: transform var(--ds-motion-fast) var(--ds-motion-ease), box-shadow var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-pricing__plan:hover { transform: translateY(-3px); box-shadow: var(--ds-shadow-md); }
.ds-pricing__plan--featured { box-shadow: var(--ds-shadow-md), 0 0 0 2px var(--ds-color-primary); }
.ds-pricing__flag { position: absolute; top: -12px; left: var(--ds-space-5); }
.ds-pricing__name { font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); }
.ds-pricing__price { display: flex; align-items: baseline; gap: 4px; font-family: var(--ds-font-display); }
.ds-pricing__amount { font-size: var(--ds-font-size-2xl); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-display); color: var(--ds-color-ink); }
.ds-pricing__period { color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-pricing__desc { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-pricing__features { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ds-space-2); font-size: var(--ds-font-size-sm); flex: 1; }
.ds-pricing__features li { display: flex; gap: var(--ds-space-2); align-items: flex-start; }
.ds-pricing__features li::before { content: "\\2713"; color: var(--ds-color-ok); font-weight: 700; flex: none; }
@media (max-width: 900px) { .ds-pricing { grid-template-columns: 1fr; } }

/* ----- Testimonial ----- */
.ds-testimonials { display: grid; grid-template-columns: repeat(var(--ds-testimonial-columns, 3), minmax(0, 1fr)); gap: var(--ds-space-4); }
.ds-testimonial { display: flex; flex-direction: column; gap: var(--ds-space-4); padding: var(--ds-space-5); box-shadow: var(--ds-shadow-sm); }
.ds-testimonial__quote { margin: 0; font-family: var(--ds-font-display); font-size: var(--ds-font-size-lg); line-height: var(--ds-line-height-snug); color: var(--ds-color-ink); letter-spacing: var(--ds-tracking-display); text-wrap: pretty; }
.ds-testimonial__quote::before { content: "\\201C"; color: var(--ds-color-primary); margin-right: 2px; }
.ds-testimonial__author { display: flex; align-items: center; gap: var(--ds-space-3); margin-top: auto; }
.ds-testimonial__name { font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); color: var(--ds-color-ink); }
.ds-testimonial__role { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }
.ds-testimonial__stars { color: var(--ds-color-accent2); letter-spacing: 2px; font-size: var(--ds-font-size-sm); }
.ds-testimonial--large { padding: var(--ds-space-7); text-align: center; align-items: center; }
.ds-testimonial--large .ds-testimonial__quote { font-size: var(--ds-font-size-xl); }
@media (max-width: 900px) { .ds-testimonials { grid-template-columns: 1fr; } }

/* ----- FAQ (accordion) ----- */
.ds-faq { display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--ds-shadow-sm); }
.ds-faq__item { border-bottom: 1px solid var(--ds-color-border); }
.ds-faq__item:last-child { border-bottom: 0; }
.ds-faq__q { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-3); padding: var(--ds-space-4) var(--ds-space-5); font-weight: var(--ds-font-weight-semibold); color: var(--ds-color-ink); min-height: 56px; }
.ds-faq__q::-webkit-details-marker { display: none; }
.ds-faq__q::after { content: "+"; font-size: 20px; color: var(--ds-color-primary); transition: transform var(--ds-motion-fast) var(--ds-motion-ease); flex: none; }
.ds-faq__item[open] .ds-faq__q::after { transform: rotate(45deg); }
.ds-faq__a { padding: 0 var(--ds-space-5) var(--ds-space-4); color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); max-width: 70ch; }

/* ----- Footer ----- */
.ds-footer { display: grid; gap: var(--ds-space-6); padding: var(--ds-space-7) var(--ds-space-5) var(--ds-space-5); border-top: 1px solid var(--ds-color-border); color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-footer__top { display: grid; grid-template-columns: 1.4fr repeat(var(--ds-footer-columns, 3), 1fr); gap: var(--ds-space-6); }
.ds-footer__brand { display: grid; gap: var(--ds-space-2); align-content: start; }
.ds-footer__name { font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); font-size: var(--ds-font-size-lg); color: var(--ds-color-ink); letter-spacing: var(--ds-tracking-display); }
.ds-footer__col h4 { font-family: var(--ds-font-sans); font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-ink); margin-bottom: var(--ds-space-3); }
.ds-footer__col ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ds-space-2); }
.ds-footer__col a { color: var(--ds-color-muted); text-decoration: none; }
.ds-footer__col a:hover { color: var(--ds-color-primary); }
.ds-footer__bottom { display: flex; justify-content: space-between; gap: var(--ds-space-3); flex-wrap: wrap; padding-top: var(--ds-space-4); border-top: 1px solid var(--ds-color-border); font-size: var(--ds-font-size-xs); }
@media (max-width: 700px) { .ds-footer__top { grid-template-columns: 1fr 1fr; } }

/* ----- Sidebar ----- */
.ds-sidebar { display: flex; flex-direction: column; gap: var(--ds-space-3); padding: var(--ds-space-3); min-height: 100%; box-shadow: var(--ds-shadow-sm); }
.ds-sidebar__brand { display: flex; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-2) var(--ds-space-3); font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-display); color: var(--ds-color-ink); }
.ds-sidebar__mark { width: 26px; height: 26px; border-radius: 7px; background: var(--ds-gradient); flex: none; }
.ds-sidebar ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.ds-sidebar__group { font-size: 10px; text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); padding: var(--ds-space-3) var(--ds-space-3) var(--ds-space-1); font-weight: var(--ds-font-weight-semibold); }
.ds-sidebar__link { display: flex; align-items: center; gap: var(--ds-space-2); min-height: 40px; padding: var(--ds-space-2) var(--ds-space-3); border-radius: var(--ds-radius-sm); color: var(--ds-color-text); text-decoration: none; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-medium); transition: background var(--ds-motion-fast) var(--ds-motion-ease), color var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-sidebar__link:hover { background: var(--ds-color-surface2); color: var(--ds-color-ink); }
.ds-sidebar__link--active, .ds-sidebar__link[aria-current="page"] { background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); color: var(--ds-color-primary); }
.ds-sidebar__icon { width: 18px; height: 18px; display: inline-grid; place-items: center; flex: none; color: var(--ds-color-muted); }
.ds-sidebar__icon svg { width: 16px; height: 16px; }
.ds-sidebar__link:hover .ds-sidebar__icon, .ds-sidebar__link--active .ds-sidebar__icon { color: inherit; }
.ds-sidebar__badge { margin-left: auto; }
.ds-sidebar__children { margin-left: var(--ds-space-5) !important; border-left: 1px solid var(--ds-color-border); padding-left: var(--ds-space-2) !important; }
.ds-sidebar__children .ds-sidebar__link { min-height: 32px; font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-sidebar__spacer { flex: 1; }
.ds-sidebar__footer { display: flex; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-3); border-top: 1px solid var(--ds-color-border); font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-sidebar--rail .ds-sidebar__link span:not(.ds-sidebar__icon), .ds-sidebar--rail .ds-sidebar__group, .ds-sidebar--rail .ds-sidebar__brand span { display: none; }
.ds-sidebar--rail { width: 64px; }

/* ----- Timeline ----- */
.ds-timeline { list-style: none; margin: 0; padding: var(--ds-space-4) var(--ds-space-5); display: grid; gap: 0; box-shadow: var(--ds-shadow-sm); }
.ds-timeline__item { position: relative; display: grid; grid-template-columns: 96px 1fr; gap: var(--ds-space-4); padding: var(--ds-space-3) 0 var(--ds-space-3) var(--ds-space-5); }
.ds-timeline__item::before { content: ""; position: absolute; left: 6px; top: 0; bottom: 0; width: 1px; background: var(--ds-color-borderStrong); }
.ds-timeline__item:first-child::before { top: 50%; }
.ds-timeline__item:last-child::before { bottom: 50%; }
.ds-timeline__item::after { content: ""; position: absolute; left: 2px; top: calc(50% - 4px); width: 9px; height: 9px; border-radius: 50%; background: var(--ds-gradient); box-shadow: 0 0 0 3px var(--ds-color-surface); }
.ds-timeline__item[data-tone="ok"]::after { background: var(--ds-color-ok); }
.ds-timeline__item[data-tone="warn"]::after { background: var(--ds-color-warn); }
.ds-timeline__item[data-tone="muted"]::after { background: var(--ds-color-borderStrong); }
.ds-timeline__time { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); font-variant-numeric: tabular-nums; padding-top: 2px; }
.ds-timeline__body { display: grid; gap: 2px; min-width: 0; }
.ds-timeline__title { font-weight: var(--ds-font-weight-semibold); color: var(--ds-color-ink); font-size: var(--ds-font-size-sm); }
.ds-timeline__text { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); white-space: pre-line; }
.ds-timeline__channel { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); }
.ds-timeline--compact .ds-timeline__item { grid-template-columns: 64px 1fr; padding-top: var(--ds-space-2); padding-bottom: var(--ds-space-2); }
@media (max-width: 480px) { .ds-timeline__item { grid-template-columns: 1fr; gap: 2px; } }

/* ----- Calendar ----- */
.ds-calendar { padding: var(--ds-space-4); box-shadow: var(--ds-shadow-sm); display: grid; gap: var(--ds-space-3); }
.ds-calendar__head { display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-3); }
.ds-calendar__month { font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); font-size: var(--ds-font-size-lg); color: var(--ds-color-ink); letter-spacing: var(--ds-tracking-display); }
.ds-calendar__count { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-calendar__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.ds-calendar__dow { font-size: 10px; text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); text-align: center; padding: 4px 0; font-weight: var(--ds-font-weight-semibold); }
.ds-calendar__day { min-height: 72px; border-radius: var(--ds-radius-sm); background: var(--ds-color-surface2); padding: 4px; display: grid; align-content: start; gap: 3px; font-size: var(--ds-font-size-xs); border: 1px solid transparent; transition: border-color var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-calendar__day:hover { border-color: var(--ds-color-borderStrong); }
.ds-calendar__day--pad { background: transparent; }
.ds-calendar__day--today { border-color: var(--ds-color-primary); }
.ds-calendar__num { color: var(--ds-color-muted); font-variant-numeric: tabular-nums; }
.ds-calendar__day--today .ds-calendar__num { color: var(--ds-color-primary); font-weight: var(--ds-font-weight-bold); }
.ds-calendar__event { display: block; padding: 2px 6px; border-radius: 6px; background: color-mix(in srgb, var(--ds-color-primary) 14%, transparent); color: var(--ds-color-ink); font-size: 11px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 2px solid var(--ds-color-primary); }
.ds-calendar__event[data-tone="accent"] { background: color-mix(in srgb, var(--ds-color-accent) 14%, transparent); border-left-color: var(--ds-color-accent); }
.ds-calendar__event[data-tone="accent2"] { background: color-mix(in srgb, var(--ds-color-accent2) 20%, transparent); border-left-color: var(--ds-color-accent2); }
.ds-calendar__event[data-tone="ok"] { background: color-mix(in srgb, var(--ds-color-ok) 14%, transparent); border-left-color: var(--ds-color-ok); }
.ds-calendar__event[data-tone="muted"] { background: var(--ds-color-bg2); border-left-color: var(--ds-color-borderStrong); color: var(--ds-color-muted); }
.ds-calendar__more { font-size: 10px; color: var(--ds-color-muted); padding-left: 6px; }
.ds-calendar--compact .ds-calendar__day { min-height: 44px; }
@media (max-width: 480px) { .ds-calendar__day { min-height: 44px; } .ds-calendar__event { font-size: 0; height: 6px; padding: 0; border-left: 0; } }

/* ----- Kanban ----- */
.ds-kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); gap: var(--ds-space-3); overflow-x: auto; padding-bottom: var(--ds-space-2); align-items: start; }
.ds-kanban__col { display: flex; flex-direction: column; gap: var(--ds-space-2); padding: var(--ds-space-3); background: var(--ds-color-bg2); border-color: var(--ds-color-border); min-height: 160px; }
.ds-kanban__head { display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-1) var(--ds-space-1) var(--ds-space-2); font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); font-weight: var(--ds-font-weight-semibold); }
.ds-kanban__count { font-variant-numeric: tabular-nums; background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-full); padding: 0 8px; }
.ds-kanban__list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ds-space-2); }
.ds-kanban__card { background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-sm); padding: var(--ds-space-3); display: grid; gap: 4px; box-shadow: var(--ds-shadow-sm); cursor: grab; transition: transform var(--ds-motion-fast) var(--ds-motion-ease), box-shadow var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-kanban__card:hover { transform: translateY(-2px); box-shadow: var(--ds-shadow-md); }
.ds-kanban__title { font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); color: var(--ds-color-ink); }
.ds-kanban__sub { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-kanban__meta { display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-2); font-size: 11px; color: var(--ds-color-muted); margin-top: 2px; }
.ds-kanban__empty { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); padding: var(--ds-space-3); text-align: center; border: 1px dashed var(--ds-color-borderStrong); border-radius: var(--ds-radius-sm); }

/* ----- Thread (chat) ----- */
.ds-thread { display: flex; flex-direction: column; gap: var(--ds-space-3); padding: var(--ds-space-4); box-shadow: var(--ds-shadow-sm); }
.ds-thread__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ds-space-3); }
.ds-thread__msg { display: flex; gap: var(--ds-space-2); align-items: flex-end; max-width: 85%; }
.ds-thread__msg[data-side="out"], .ds-thread__msg--out { align-self: flex-end; flex-direction: row-reverse; }
.ds-thread__bubble { display: grid; gap: 2px; padding: var(--ds-space-2) var(--ds-space-3); border-radius: var(--ds-radius-md); background: var(--ds-color-surface2); border: 1px solid var(--ds-color-border); font-size: var(--ds-font-size-sm); border-bottom-left-radius: 4px; }
.ds-thread__msg[data-side="out"] .ds-thread__bubble, .ds-thread__msg--out .ds-thread__bubble { background: var(--ds-gradient); color: var(--ds-color-accentInk); border-color: transparent; border-bottom-left-radius: var(--ds-radius-md); border-bottom-right-radius: 4px; }
.ds-thread__author { font-size: 11px; font-weight: var(--ds-font-weight-semibold); opacity: 0.85; }
.ds-thread__text { white-space: pre-line; }
.ds-thread__time { font-size: 10px; opacity: 0.7; justify-self: end; }
.ds-thread__compose { display: flex; gap: var(--ds-space-2); padding-top: var(--ds-space-2); border-top: 1px solid var(--ds-color-border); }
.ds-thread__compose .ds-input { min-height: 40px; }
.ds-thread__compose .ds-button { min-height: 40px; }

/* ----- Chart ----- */
.ds-chart { padding: var(--ds-space-4) var(--ds-space-5); display: grid; gap: var(--ds-space-3); box-shadow: var(--ds-shadow-sm); }
.ds-chart__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--ds-space-3); }
.ds-chart__title { font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-semibold); color: var(--ds-color-ink); }
.ds-chart__total { font-family: var(--ds-font-display); font-size: var(--ds-font-size-xl); font-weight: var(--ds-font-weight-bold); color: var(--ds-color-ink); font-variant-numeric: tabular-nums; }
.ds-chart__svg { width: 100%; height: auto; display: block; overflow: visible; }
.ds-chart__bar { transition: opacity var(--ds-motion-fast) var(--ds-motion-ease); }
.ds-chart__bar:hover { opacity: 0.8; }
.ds-chart__line { fill: none; stroke: var(--ds-color-primary); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.ds-chart__dot { fill: var(--ds-color-surface); stroke: var(--ds-color-primary); stroke-width: 2; }
.ds-chart__grid { stroke: var(--ds-color-border); stroke-width: 1; }
.ds-chart__label { font-size: 11px; fill: var(--ds-color-muted); font-family: var(--ds-font-sans); }
.ds-chart__value { font-size: 11px; fill: var(--ds-color-ink); font-family: var(--ds-font-sans); font-weight: 600; }
.ds-chart__empty { color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); text-align: center; padding: var(--ds-space-5); }
.ds-chart__legend { display: flex; gap: var(--ds-space-3); flex-wrap: wrap; font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }

/* ----- Empty state ----- */
.ds-empty { display: grid; justify-items: center; text-align: center; gap: var(--ds-space-3); padding: var(--ds-space-7) var(--ds-space-5); border-style: dashed; background: transparent; box-shadow: none; }
.ds-empty__icon { width: 56px; height: 56px; display: grid; place-items: center; border-radius: var(--ds-radius-md); background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); color: var(--ds-color-primary); font-size: 26px; border: 1px solid color-mix(in srgb, var(--ds-color-primary) 25%, transparent); }
.ds-empty__title { font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); }
.ds-empty__text { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); max-width: 40ch; }

/* ----- Social post and ad templates ----- */
.ds-post { display: grid; grid-template-rows: auto 1fr auto; aspect-ratio: var(--ds-post-ratio, 1 / 1); overflow: hidden; padding: var(--ds-space-5); gap: var(--ds-space-3); background: var(--ds-color-surface); background-image: radial-gradient(var(--ds-color-dot) 1px, transparent 1px), radial-gradient(70% 60% at 100% 100%, color-mix(in srgb, var(--ds-color-accent2) 26%, transparent), transparent 65%); background-size: 24px 24px, 100% 100%; box-shadow: var(--ds-shadow-md); }
.ds-post--story { --ds-post-ratio: 9 / 16; }
.ds-post--landscape { --ds-post-ratio: 1.91 / 1; }
.ds-post--ink { background: #0d0c11; background-image: radial-gradient(rgba(242, 234, 217, 0.14) 1px, transparent 1px), radial-gradient(70% 60% at 100% 100%, rgba(255, 122, 69, 0.3), transparent 65%); color: #d8d2c6; border-color: rgba(242, 234, 217, 0.12); }
.ds-post--ink .ds-post__title, .ds-post--ink .ds-post__brand { color: #f2ead9; }
.ds-post--accent { background: var(--ds-gradient); color: var(--ds-color-accentInk); border-color: transparent; }
.ds-post--accent .ds-post__title, .ds-post--accent .ds-post__brand, .ds-post--accent .ds-post__kicker, .ds-post--accent .ds-post__text, .ds-post--accent .ds-post__tags { color: inherit; }
.ds-post__head { display: flex; align-items: center; gap: var(--ds-space-2); }
.ds-post__brand { font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); color: var(--ds-color-ink); letter-spacing: var(--ds-tracking-display); }
.ds-post__handle { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-post__body { display: grid; gap: var(--ds-space-2); align-content: center; }
.ds-post__kicker { margin: 0; }
.ds-post__title { font-size: var(--ds-font-size-2xl); line-height: var(--ds-line-height-tight); font-weight: var(--ds-font-weight-bold); letter-spacing: var(--ds-tracking-hero); }
.ds-post__text { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-post__foot { display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-2); flex-wrap: wrap; }
.ds-post__tags { font-size: var(--ds-font-size-xs); color: var(--ds-color-primary); font-weight: var(--ds-font-weight-medium); }
.ds-post__cta { font-size: var(--ds-font-size-xs); font-weight: var(--ds-font-weight-semibold); padding: 6px 12px; border-radius: var(--ds-radius-full); background: var(--ds-color-ink); color: var(--ds-color-bg); }
.ds-post--accent .ds-post__cta, .ds-post--ink .ds-post__cta { background: #fffdf8; color: #15141a; }
.ds-ad { display: grid; gap: var(--ds-space-3); padding: var(--ds-space-4); box-shadow: var(--ds-shadow-sm); }
.ds-ad__label { display: flex; justify-content: space-between; align-items: center; font-size: 10px; text-transform: uppercase; letter-spacing: var(--ds-tracking-kicker); color: var(--ds-color-muted); font-weight: var(--ds-font-weight-semibold); }
.ds-ad__variant { color: var(--ds-color-primary); background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); border-radius: var(--ds-radius-full); padding: 1px 8px; }
.ds-ad__image { aspect-ratio: 1.91 / 1; border-radius: var(--ds-radius-sm); background: var(--ds-gradient); display: grid; place-items: center; color: var(--ds-color-accentInk); font-family: var(--ds-font-display); font-weight: var(--ds-font-weight-bold); font-size: var(--ds-font-size-xl); letter-spacing: var(--ds-tracking-display); text-align: center; padding: var(--ds-space-4); }
.ds-ad__image--muted { background: var(--ds-color-bg2); color: var(--ds-color-ink); }
.ds-ad__image--ink { background: #0d0c11; color: #f2ead9; }
.ds-ad__headline { font-weight: var(--ds-font-weight-semibold); color: var(--ds-color-ink); font-size: var(--ds-font-size-md); }
.ds-ad__body { margin: 0; font-size: var(--ds-font-size-sm); color: var(--ds-color-muted); }
.ds-ad__foot { display: flex; justify-content: space-between; align-items: center; gap: var(--ds-space-2); }
.ds-ad__metrics { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); font-variant-numeric: tabular-nums; }

/* ----- Section heading / text helpers used by pages ----- */
.ds-heading { font-size: var(--ds-font-size-xl); font-weight: var(--ds-font-weight-semibold); }
.ds-text { margin: 0; color: var(--ds-color-muted); }
.ds-muted { color: var(--ds-color-muted); }
.ds-row { display: flex; gap: var(--ds-space-2); align-items: center; flex-wrap: wrap; }
[data-min-role][hidden] { display: none !important; }
`;
