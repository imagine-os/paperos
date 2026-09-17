/**
 * Base styles for the starter component library, written against the
 * `--ds-*` token variables so a token change restyles every component. The
 * bundler injects this after the token CSS whenever a project has
 * `design/tokens.json`; pages and the component gallery get it too.
 */
export const BASE_CSS = `
.ds-page { margin: 0; min-height: 100vh; background: var(--ds-color-bg); color: var(--ds-color-text); font-family: var(--ds-font-sans); font-size: var(--ds-font-size-md); line-height: var(--ds-line-height-normal); }
.ds-page * { box-sizing: border-box; }
.ds-grid { display: grid; grid-template-columns: repeat(var(--ds-page-columns, 12), minmax(0, 1fr)); gap: var(--ds-page-gap, var(--ds-space-4)); padding: var(--ds-space-4); max-width: var(--ds-page-max-width, 1200px); margin: 0 auto; }
.ds-col { min-width: 0; }
@media (max-width: 700px) { .ds-grid { grid-template-columns: 1fr; } .ds-col { grid-column: span 1 !important; } }
.ds-missing { padding: var(--ds-space-3); border: 1px dashed var(--ds-color-danger); color: var(--ds-color-danger); border-radius: var(--ds-radius-md); font-size: var(--ds-font-size-sm); }

/* Button */
.ds-button { display: inline-flex; align-items: center; justify-content: center; gap: var(--ds-space-2); padding: var(--ds-space-2) var(--ds-space-4); border-radius: var(--ds-radius-md); border: 1px solid var(--ds-color-border); background: var(--ds-color-surface); color: var(--ds-color-text); font: inherit; font-size: var(--ds-font-size-sm); font-weight: var(--ds-font-weight-medium); text-decoration: none; cursor: pointer; line-height: 1.2; }
.ds-button:hover { filter: brightness(0.97); }
.ds-button--primary { background: var(--ds-color-primary); border-color: var(--ds-color-primary); color: #fff; }
.ds-button--accent { background: var(--ds-color-accent); border-color: var(--ds-color-accent); color: #fff; }
.ds-button--danger { background: var(--ds-color-danger); border-color: var(--ds-color-danger); color: #fff; }
.ds-button--ghost { background: transparent; border-color: transparent; color: var(--ds-color-primary); }
.ds-button--outline { background: transparent; border-color: var(--ds-color-primary); color: var(--ds-color-primary); }
.ds-button--sm { padding: var(--ds-space-1) var(--ds-space-3); font-size: var(--ds-font-size-xs); }
.ds-button--lg { padding: var(--ds-space-3) var(--ds-space-5); font-size: var(--ds-font-size-md); }

/* Card */
.ds-card { background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-sm); overflow: hidden; display: flex; flex-direction: column; }
.ds-card--elevated { box-shadow: var(--ds-shadow-md); border-color: transparent; }
.ds-card--outlined { box-shadow: none; }
.ds-card--flat { box-shadow: none; border-color: transparent; background: transparent; }
.ds-card__image { width: 100%; aspect-ratio: 16 / 7; object-fit: cover; display: block; background: var(--ds-color-bg); }
.ds-card__body { padding: var(--ds-space-4); display: flex; flex-direction: column; gap: var(--ds-space-2); flex: 1; }
.ds-card__title { margin: 0; font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); line-height: var(--ds-line-height-tight); }
.ds-card__text { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-card__footer { padding: var(--ds-space-3) var(--ds-space-4); border-top: 1px solid var(--ds-color-border); display: flex; gap: var(--ds-space-2); align-items: center; }

/* Table */
.ds-table-wrap { overflow: auto; border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-md); background: var(--ds-color-surface); }
.ds-table { width: 100%; border-collapse: collapse; font-size: var(--ds-font-size-sm); }
.ds-table th, .ds-table td { padding: var(--ds-space-2) var(--ds-space-3); text-align: left; border-bottom: 1px solid var(--ds-color-border); white-space: nowrap; }
.ds-table th { font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ds-color-muted); font-weight: var(--ds-font-weight-semibold); background: color-mix(in srgb, var(--ds-color-bg) 60%, var(--ds-color-surface)); }
.ds-table tbody tr:last-child td { border-bottom: 0; }
.ds-table--striped tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--ds-color-bg) 50%, transparent); }
.ds-table--compact th, .ds-table--compact td { padding: var(--ds-space-1) var(--ds-space-2); }
.ds-table__thumb { width: 36px; height: 28px; border-radius: var(--ds-radius-sm); object-fit: cover; display: block; }
.ds-table__caption { padding: var(--ds-space-2) var(--ds-space-3); font-weight: var(--ds-font-weight-semibold); text-align: left; caption-side: top; }
.ds-table__empty { padding: var(--ds-space-4); color: var(--ds-color-muted); text-align: center; }

/* Form */
.ds-form { display: flex; flex-direction: column; gap: var(--ds-space-3); padding: var(--ds-space-4); background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); }
.ds-form--inline { flex-direction: row; flex-wrap: wrap; align-items: end; }
.ds-form__title { margin: 0 0 var(--ds-space-1); font-size: var(--ds-font-size-lg); font-weight: var(--ds-font-weight-semibold); }
.ds-field { display: flex; flex-direction: column; gap: var(--ds-space-1); font-size: var(--ds-font-size-sm); }
.ds-field--check { flex-direction: row; align-items: center; gap: var(--ds-space-2); }
.ds-field__label { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); font-weight: var(--ds-font-weight-medium); text-transform: uppercase; letter-spacing: 0.04em; }
.ds-input, .ds-select { font: inherit; font-size: var(--ds-font-size-sm); padding: var(--ds-space-2) var(--ds-space-3); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-md); background: var(--ds-color-bg); color: var(--ds-color-text); }
.ds-input:focus, .ds-select:focus { outline: 2px solid color-mix(in srgb, var(--ds-color-primary) 40%, transparent); border-color: var(--ds-color-primary); }
.ds-form__actions { display: flex; gap: var(--ds-space-2); justify-content: flex-end; }

/* Nav */
.ds-nav { background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); padding: var(--ds-space-2); }
.ds-nav ul { list-style: none; margin: 0; padding: 0; }
.ds-nav__children { margin-left: var(--ds-space-4) !important; border-left: 1px solid var(--ds-color-border); }
.ds-nav__link { display: flex; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-2) var(--ds-space-3); border-radius: var(--ds-radius-md); color: inherit; text-decoration: none; font-size: var(--ds-font-size-sm); }
.ds-nav__link:hover { background: color-mix(in srgb, var(--ds-color-primary) 10%, transparent); color: var(--ds-color-primary); }
.ds-nav__link--child { font-size: var(--ds-font-size-xs); color: var(--ds-color-muted); }
.ds-nav__brand { font-weight: var(--ds-font-weight-bold); padding: var(--ds-space-2) var(--ds-space-3); }
.ds-nav--horizontal { display: flex; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-2) var(--ds-space-3); }
.ds-nav--horizontal .ds-nav__list { display: flex; gap: var(--ds-space-1); flex-wrap: wrap; }
.ds-nav--horizontal .ds-nav__children { display: none; }
.ds-nav--horizontal .ds-nav__spacer { flex: 1; }

/* Mega menu */
.ds-mega { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--ds-space-4); padding: var(--ds-space-4); background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); }
.ds-mega ul { list-style: none; margin: 0; padding: 0; }
.ds-mega__heading { margin: 0 0 var(--ds-space-2); font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ds-color-muted); }
.ds-mega__item { margin-bottom: var(--ds-space-2); }
.ds-mega__link { display: flex; gap: var(--ds-space-2); align-items: center; color: inherit; text-decoration: none; }
.ds-mega__link:hover .ds-mega__label { color: var(--ds-color-primary); }
.ds-mega__thumb { width: 44px; height: 34px; border-radius: var(--ds-radius-sm); object-fit: cover; flex: none; }
.ds-mega__text { display: flex; flex-direction: column; min-width: 0; }
.ds-mega__label { font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); }
.ds-mega__desc { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }

/* Hero */
.ds-hero { padding: var(--ds-space-7) var(--ds-space-5); border-radius: var(--ds-radius-xl); background: linear-gradient(135deg, color-mix(in srgb, var(--ds-color-primary) 18%, var(--ds-color-surface)), color-mix(in srgb, var(--ds-color-accent) 18%, var(--ds-color-surface))); display: grid; gap: var(--ds-space-3); align-content: center; }
.ds-hero--center { text-align: center; justify-items: center; }
.ds-hero--split { grid-template-columns: 1fr 1fr; align-items: center; }
.ds-hero--dark { background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; }
.ds-hero--dark .ds-hero__subtitle { color: rgba(255,255,255,0.75); }
.ds-hero__eyebrow { margin: 0; font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); }
.ds-hero__title { margin: 0; font-size: var(--ds-font-size-3xl); line-height: var(--ds-line-height-tight); font-weight: var(--ds-font-weight-bold); }
.ds-hero__subtitle { margin: 0; color: var(--ds-color-muted); font-size: var(--ds-font-size-lg); max-width: 60ch; }
.ds-hero__actions { display: flex; gap: var(--ds-space-2); flex-wrap: wrap; margin-top: var(--ds-space-2); }
.ds-hero__image { width: 100%; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-lg); }

/* Stat */
.ds-stat { padding: var(--ds-space-4); background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); display: flex; flex-direction: column; gap: var(--ds-space-1); }
.ds-stat__label { font-size: var(--ds-font-size-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ds-color-muted); font-weight: var(--ds-font-weight-medium); }
.ds-stat__value { font-size: var(--ds-font-size-2xl); font-weight: var(--ds-font-weight-bold); line-height: var(--ds-line-height-tight); }
.ds-stat__delta { font-size: var(--ds-font-size-sm); color: var(--ds-color-muted); }
.ds-stat--up .ds-stat__delta { color: #16a34a; }
.ds-stat--down .ds-stat__delta { color: var(--ds-color-danger); }
.ds-stat--primary { background: var(--ds-color-primary); border-color: var(--ds-color-primary); color: #fff; }
.ds-stat--primary .ds-stat__label, .ds-stat--primary .ds-stat__delta { color: rgba(255,255,255,0.8); }

/* List */
.ds-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); overflow: hidden; }
.ds-list__item { display: flex; align-items: center; gap: var(--ds-space-3); padding: var(--ds-space-3) var(--ds-space-4); border-bottom: 1px solid var(--ds-color-border); }
.ds-list__item:last-child { border-bottom: 0; }
.ds-list__thumb { width: 40px; height: 40px; border-radius: var(--ds-radius-md); object-fit: cover; flex: none; background: var(--ds-color-bg); }
.ds-list__body { display: flex; flex-direction: column; min-width: 0; }
.ds-list__body small { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }
.ds-list--plain { border: 0; background: transparent; }
.ds-list--plain .ds-list__item { padding: var(--ds-space-2) 0; }
.ds-list__empty { padding: var(--ds-space-4); color: var(--ds-color-muted); }

/* Grid */
.ds-grid-block { display: grid; grid-template-columns: repeat(var(--ds-block-columns, 3), minmax(0, 1fr)); gap: var(--ds-block-gap, var(--ds-space-4)); }
.ds-grid-block > .ds-col { grid-column: auto !important; }
@media (max-width: 700px) { .ds-grid-block { grid-template-columns: 1fr; } }

/* Tabs */
.ds-tabs { background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); border-radius: var(--ds-radius-lg); overflow: hidden; }
.ds-tabs__bar { display: flex; gap: var(--ds-space-1); padding: var(--ds-space-2) var(--ds-space-2) 0; border-bottom: 1px solid var(--ds-color-border); }
.ds-tabs__tab { font: inherit; font-size: var(--ds-font-size-sm); padding: var(--ds-space-2) var(--ds-space-3); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--ds-color-muted); cursor: pointer; }
.ds-tabs__tab--active { color: var(--ds-color-primary); border-bottom-color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); }
.ds-tabs__panel { display: none; padding: var(--ds-space-4); }
.ds-tabs__panel--active { display: block; }
.ds-tabs--pills .ds-tabs__bar { border-bottom: 0; padding: var(--ds-space-2); }
.ds-tabs--pills .ds-tabs__tab { border-radius: var(--ds-radius-full); border-bottom: 0; }
.ds-tabs--pills .ds-tabs__tab--active { background: color-mix(in srgb, var(--ds-color-primary) 12%, transparent); }

/* Modal */
.ds-modal { position: fixed; inset: 0; display: grid; place-items: center; z-index: 50; }
.ds-modal[data-open="false"] { display: none; }
.ds-modal__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
.ds-modal__dialog { position: relative; width: min(480px, calc(100vw - 32px)); background: var(--ds-color-surface); color: var(--ds-color-text); border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-lg); border: 1px solid var(--ds-color-border); }
.ds-modal--inline { position: static; display: block; }
.ds-modal--inline .ds-modal__backdrop { display: none; }
.ds-modal--inline .ds-modal__dialog { width: 100%; }
.ds-modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--ds-space-3) var(--ds-space-4); border-bottom: 1px solid var(--ds-color-border); }
.ds-modal__header h3 { margin: 0; font-size: var(--ds-font-size-lg); }
.ds-modal__close { font: inherit; font-size: 18px; line-height: 1; border: 0; background: none; color: var(--ds-color-muted); cursor: pointer; }
.ds-modal__body { padding: var(--ds-space-4); color: var(--ds-color-muted); font-size: var(--ds-font-size-sm); }
.ds-modal__footer { display: flex; justify-content: flex-end; gap: var(--ds-space-2); padding: var(--ds-space-3) var(--ds-space-4); border-top: 1px solid var(--ds-color-border); }

/* Badge */
.ds-badge { display: inline-flex; align-items: center; padding: 2px var(--ds-space-2); border-radius: var(--ds-radius-full); font-size: var(--ds-font-size-xs); font-weight: var(--ds-font-weight-semibold); line-height: 1.4; background: color-mix(in srgb, var(--ds-color-muted) 15%, transparent); color: var(--ds-color-text); }
.ds-badge--primary { background: color-mix(in srgb, var(--ds-color-primary) 15%, transparent); color: var(--ds-color-primary); }
.ds-badge--accent { background: color-mix(in srgb, var(--ds-color-accent) 15%, transparent); color: var(--ds-color-accent); }
.ds-badge--success { background: rgba(22, 163, 74, 0.15); color: #15803d; }
.ds-badge--danger { background: color-mix(in srgb, var(--ds-color-danger) 15%, transparent); color: var(--ds-color-danger); }
.ds-badge--solid { background: var(--ds-color-primary); color: #fff; }

/* Avatar */
.ds-avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ds-radius-full); background: color-mix(in srgb, var(--ds-color-primary) 18%, var(--ds-color-surface)); color: var(--ds-color-primary); font-weight: var(--ds-font-weight-semibold); font-size: var(--ds-font-size-sm); overflow: hidden; vertical-align: middle; flex: none; }
.ds-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ds-avatar--sm { width: 28px; height: 28px; font-size: var(--ds-font-size-xs); }
.ds-avatar--lg { width: 64px; height: 64px; font-size: var(--ds-font-size-lg); }
.ds-avatar--square { border-radius: var(--ds-radius-md); }
.ds-avatar-group { display: inline-flex; }
.ds-avatar-group .ds-avatar { margin-left: -8px; border: 2px solid var(--ds-color-surface); }
.ds-avatar-group .ds-avatar:first-child { margin-left: 0; }

/* Section heading / text helpers used by pages */
.ds-heading { margin: 0; font-size: var(--ds-font-size-xl); font-weight: var(--ds-font-weight-semibold); }
.ds-text { margin: 0; color: var(--ds-color-muted); }
`;
