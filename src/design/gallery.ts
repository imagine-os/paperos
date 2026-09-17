/**
 * The document the Design window shows in its embedded preview: every
 * component (or one) with its variants, rendered from the current tokens and
 * the project's tables. Pure: returns an HTML string for a sandboxed
 * iframe's `srcdoc`. Clicks post `{source: "paperos-design", type: "select",
 * name, variant}` to the parent so the window can open the inspector.
 */
import { dataRuntimeScript } from "@/data/runtime";
import type { DataSchema } from "@/data/schema";
import { BASE_CSS } from "./base-css";
import { defaultProps, type ComponentDef } from "./components";
import { designCore, type RenderPayload } from "./render";
import { tokensToCss, type DesignTokens } from "./tokens";

export interface GalleryOptions {
  tokens: DesignTokens;
  components: ComponentDef[];
  schema: DataSchema;
  tables: Record<string, Record<string, unknown>[]>;
  theme: "light" | "dark";
  /** Show only this component (with the props given), else the whole library. */
  only?: { name: string; props?: Record<string, unknown>; variant?: string };
  selected?: string;
}

const GALLERY_CSS = `
body { margin: 0; padding: 16px; }
.gallery__item { margin-bottom: 20px; border: 1px solid transparent; border-radius: var(--ds-radius-lg); padding: 8px; cursor: pointer; }
.gallery__item:hover { border-color: var(--ds-color-border); }
.gallery__item--selected { border-color: var(--ds-color-primary); }
.gallery__head { display: flex; align-items: baseline; gap: 10px; margin: 0 0 8px 4px; }
.gallery__head h4 { margin: 0; font-size: var(--ds-font-size-sm); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ds-color-muted); }
.gallery__head small { color: var(--ds-color-muted); font-size: var(--ds-font-size-xs); }
.gallery__variants { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
.gallery__variant { min-width: 160px; flex: 1 1 260px; max-width: 100%; }
.gallery__variant--wide { flex-basis: 100%; }
.gallery__variant > small { display: block; margin: 0 0 4px 2px; font-size: 10px; color: var(--ds-color-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.gallery__single { padding: 8px; }
.gallery__empty { color: var(--ds-color-muted); padding: 24px; text-align: center; }
`;

const WIDE = new Set([
  "Table",
  "Form",
  "Nav",
  "MegaMenu",
  "Hero",
  "Tabs",
  "Modal",
  "List",
  "Grid",
]);

const GALLERY_SCRIPT = `document.addEventListener("click", function (e) {
  var el = e.target;
  while (el && el !== document && !(el.getAttribute && el.getAttribute("data-gallery"))) el = el.parentNode;
  if (!el || el === document) return;
  var v = el.getAttribute("data-gallery-variant");
  parent.postMessage({ source: "paperos-design", type: "select", name: el.getAttribute("data-gallery"), variant: v || undefined }, "*");
  e.preventDefault();
}, true);`;

export function galleryDocument(options: GalleryOptions): string {
  const payload: RenderPayload = {
    components: options.components,
    schema: {
      tables: options.schema.tables.map((t) => ({
        name: t.name,
        primaryKey: t.primaryKey,
        display: t.display,
        columns: t.columns.map((c) => ({
          name: c.name,
          type: c.type,
          ref: c.ref,
        })),
      })),
    },
  };
  const core = designCore(payload);
  const esc = core.escape;
  let body = "";
  if (options.only) {
    const def = options.components.find((c) => c.name === options.only!.name);
    body = def
      ? `<div class="gallery__single">${core.render(def.name, { ...defaultProps(def), ...(options.only.props ?? {}) }, undefined, options.only.variant)}</div>`
      : `<div class="gallery__empty">Unknown component: ${esc(options.only.name)}</div>`;
  } else if (options.components.length === 0) {
    body = `<div class="gallery__empty">No components yet.</div>`;
  } else {
    for (const def of options.components) {
      const props = defaultProps(def);
      const variants: { label: string; variant?: string }[] = [
        { label: "default" },
        ...def.variants.map((v) => ({ label: v.name, variant: v.name })),
      ];
      const wide = WIDE.has(def.name) ? " gallery__variant--wide" : "";
      const selected =
        options.selected === def.name ? " gallery__item--selected" : "";
      body += `<section class="gallery__item${selected}" data-gallery="${esc(def.name)}" data-testid="gallery-${esc(def.name)}">
<div class="gallery__head"><h4>${esc(def.icon ?? "")} ${esc(def.name)}</h4><small>${esc(def.description ?? "")}</small></div>
<div class="gallery__variants">${variants
        .map(
          (v) =>
            `<div class="gallery__variant${wide}" data-gallery="${esc(def.name)}"${v.variant ? ` data-gallery-variant="${esc(v.variant)}"` : ""}><small>${esc(v.label)}</small>${core.render(def.name, props, '<span class="ds-text">Slot content</span>', v.variant)}</div>`
        )
        .join("")}</div>
</section>`;
    }
  }
  const data = dataRuntimeScript({
    schema: payload.schema!,
    tables: options.tables,
  });
  return `<!doctype html>
<html lang="en" data-theme="${options.theme}">
<head>
<meta charset="utf-8" />
<style>${tokensToCss(options.tokens)}${BASE_CSS}${GALLERY_CSS}</style>
<script>${data}</script>
</head>
<body class="ds-page" data-testid="gallery">
${body}
<script>${GALLERY_SCRIPT}</script>
</body>
</html>`;
}
