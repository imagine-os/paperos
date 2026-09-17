/**
 * The starter design system: default tokens, a component library and the
 * guidelines document. The sample project ships these files and the Design
 * window offers to create them in a project that has none.
 */
import { componentPath, type ComponentDef } from "./components";
import { defaultTokens, serializeTokens, TOKENS_PATH } from "./tokens";
import { DESIGN_README_PATH } from "./components";

const prop = (
  name: string,
  type: ComponentDef["props"][number]["type"],
  def?: unknown,
  extra: Partial<ComponentDef["props"][number]> = {}
) => ({ name, type, ...(def !== undefined ? { default: def } : {}), ...extra });

const TABLE_PROPS = [
  prop("table", "table", "", { description: "Table the rows come from" }),
  prop("filter", "string", "", {
    description: "data-filter text, e.g. active=true",
  }),
  prop("order", "string", "", { description: "Sort column, e.g. -created" }),
];

export const STARTER_COMPONENTS: ComponentDef[] = [
  {
    name: "Button",
    description:
      "Action trigger. Renders a link when href is set, a button otherwise.",
    category: "Actions",
    icon: "▶",
    props: [
      prop("label", "string", "Button"),
      prop("href", "string", ""),
      prop("variant", "select", "primary", {
        options: ["primary", "accent", "danger", "outline", "ghost", "default"],
      }),
      prop("size", "select", "md", { options: ["sm", "md", "lg"] }),
    ],
    slots: [],
    template:
      '{#if href}<a class="ds-button ds-button--{variant} ds-button--{size}" href="{href}">{label}</a>{:else}<button class="ds-button ds-button--{variant} ds-button--{size}" type="button">{label}</button>{/if}',
    variants: [
      { name: "primary", props: { variant: "primary" } },
      { name: "outline", props: { variant: "outline" } },
      { name: "ghost", props: { variant: "ghost" } },
      { name: "danger", props: { variant: "danger", label: "Delete" } },
    ],
  },
  {
    name: "Card",
    description:
      "Surface with an optional image, title, text and a footer; other blocks nest inside.",
    category: "Layout",
    icon: "▭",
    props: [
      prop("title", "string", "Card title"),
      prop("text", "string", "Supporting text goes here."),
      prop("image", "string", ""),
      prop("variant", "select", "default", {
        options: ["default", "elevated", "outlined", "flat"],
      }),
    ],
    slots: ["children", "footer"],
    template:
      '<article class="ds-card ds-card--{variant}">{#if image}<img class="ds-card__image" src="{image}" alt="" />{/if}<div class="ds-card__body">{#if title}<h3 class="ds-card__title">{title}</h3>{/if}{#if text}<p class="ds-card__text">{text}</p>{/if}{@children}</div>{#if footer}<footer class="ds-card__footer">{@footer}</footer>{/if}</article>',
    variants: [
      { name: "elevated", props: { variant: "elevated" } },
      { name: "outlined", props: { variant: "outlined" } },
    ],
  },
  {
    name: "Table",
    description:
      "Data table bound to a table of the project: one row per record, ref columns show display values.",
    category: "Data",
    icon: "▦",
    props: [
      ...TABLE_PROPS,
      prop("fields", "fields", [], {
        description: "Columns to show (all when empty)",
      }),
      prop("caption", "string", ""),
      prop("variant", "select", "default", {
        options: ["default", "striped", "compact"],
      }),
      prop("empty", "string", "No rows"),
    ],
    slots: [],
    template:
      '<div class="ds-table-wrap"><table class="ds-table ds-table--{variant}">{#if caption}<caption class="ds-table__caption">{caption}</caption>{/if}<thead><tr>{#each columns}<th>{label}</th>{/each}</tr></thead><tbody data-source="{table}" data-filter="{filter}" data-order="{order}" data-empty="{empty}"><tr>{#each columns}{#if isImage}<td><img class="ds-table__thumb" data-field="{name}" alt="" /></td>{:else}{#if isRef}<td data-field="{name}" data-display></td>{:else}<td data-field="{name}"></td>{/if}{/if}{/each}</tr></tbody></table></div>',
    variants: [
      { name: "striped", props: { variant: "striped" } },
      { name: "compact", props: { variant: "compact" } },
    ],
  },
  {
    name: "Form",
    description:
      "A form generated from a table's schema: one field per column, typed inputs, ref columns as selects.",
    category: "Data",
    icon: "☑",
    props: [
      prop("table", "table", ""),
      prop("fields", "fields", [], {
        description: "Columns to edit (all but the key when empty)",
      }),
      prop("title", "string", "New record"),
      prop("submitLabel", "string", "Save"),
      prop("variant", "select", "default", { options: ["default", "inline"] }),
    ],
    slots: [],
    template:
      '<form class="ds-form ds-form--{variant}" data-table="{table}">{#if title}<h3 class="ds-form__title">{title}</h3>{/if}{#each columns}{#if !key}{#if isBoolean}<label class="ds-field ds-field--check"><input type="checkbox" name="{name}" /><span>{label}</span></label>{:else}{#if isRef}<label class="ds-field"><span class="ds-field__label">{label}</span><select class="ds-select" name="{name}" data-source="{ref}"><option data-field="{refDisplay}" data-attr="label"></option></select></label>{:else}<label class="ds-field"><span class="ds-field__label">{label}</span><input class="ds-input" type="{inputType}" name="{name}" placeholder="{label}" /></label>{/if}{/if}{/if}{/each}<div class="ds-form__actions"><button class="ds-button ds-button--primary" type="submit">{submitLabel}</button></div></form>',
    variants: [{ name: "inline", props: { variant: "inline", title: "" } }],
  },
  {
    name: "Nav",
    description:
      "Navigation from a menu table (nested by parent_id) or a static items list; vertical side menu or horizontal bar.",
    category: "Navigation",
    icon: "☰",
    props: [
      prop("table", "table", "", {
        description: "Menu table (nested by parent_id)",
      }),
      prop("labelField", "field", "", { description: "Column with the label" }),
      prop("hrefField", "string", "href"),
      prop("order", "string", "sort"),
      prop("brand", "string", ""),
      prop("items", "list", [], {
        description: "Static items: [{label, href}] when no table",
      }),
      prop("variant", "select", "vertical", {
        options: ["vertical", "horizontal"],
      }),
    ],
    slots: ["children"],
    template:
      '<nav class="ds-nav ds-nav--{variant}" aria-label="Navigation">{#if brand}<div class="ds-nav__brand">{brand}</div>{/if}{#if table}<ul class="ds-nav__list" data-source="{table}" data-filter="parent_id=null" data-order="{order}"><li class="ds-nav__item"><a class="ds-nav__link" data-field="{hrefField}"><span data-field="{labelField}"></span></a><ul class="ds-nav__children" data-source="{table}" data-filter="parent_id={{id}}" data-order="{order}"><li><a class="ds-nav__link ds-nav__link--child" data-field="{hrefField}"><span data-field="{labelField}"></span></a></li></ul></li></ul>{:else}<ul class="ds-nav__list">{#each items}<li class="ds-nav__item"><a class="ds-nav__link" href="{href}">{label}</a></li>{/each}</ul>{/if}<span class="ds-nav__spacer"></span>{@children}</nav>',
    variants: [
      { name: "horizontal", props: { variant: "horizontal" } },
      {
        name: "static",
        props: {
          table: "",
          items: [
            { label: "Home", href: "#/" },
            { label: "Products", href: "#/products" },
            { label: "Admin", href: "#/admin" },
          ],
        },
      },
    ],
  },
  {
    name: "MegaMenu",
    description:
      "Columns per category from a menu table, with thumbnails and descriptions.",
    category: "Navigation",
    icon: "⊞",
    props: [
      prop("table", "table", ""),
      prop("groupBy", "field", "category", {
        description: "Column that names the column",
      }),
      prop("labelField", "field", "", {}),
      prop("hrefField", "string", "href"),
      prop("imageField", "string", "thumbnail_url"),
      prop("descriptionField", "string", "description"),
      prop("order", "string", "sort"),
      prop("showThumbs", "boolean", true),
    ],
    slots: [],
    template:
      '<div class="ds-mega" data-source="{table}" data-group="{groupBy}" data-order="{order}"><section class="ds-mega__col"><h3 class="ds-mega__heading" data-field="$group"></h3><ul class="ds-mega__list" data-source="{table}" data-filter="{groupBy}={{$group}} parent_id=null" data-order="{order}"><li class="ds-mega__item"><a class="ds-mega__link" data-field="{hrefField}">{#if showThumbs}<img class="ds-mega__thumb" data-field="{imageField}" alt="" />{/if}<span class="ds-mega__text"><span class="ds-mega__label" data-field="{labelField}"></span><small class="ds-mega__desc" data-field="{descriptionField}"></small></span></a></li></ul></section></div>',
    variants: [{ name: "text only", props: { showThumbs: false } }],
  },
  {
    name: "Hero",
    description:
      "Large introduction with an eyebrow, title, subtitle and calls to action.",
    category: "Marketing",
    icon: "★",
    props: [
      prop("eyebrow", "string", "Welcome"),
      prop("title", "string", "Build pages from components"),
      prop(
        "subtitle",
        "string",
        "Tokens, components and data, all on one canvas."
      ),
      prop("ctaLabel", "string", "Get started"),
      prop("ctaHref", "string", "#/products"),
      prop("secondaryLabel", "string", ""),
      prop("secondaryHref", "string", ""),
      prop("image", "string", ""),
      prop("variant", "select", "default", {
        options: ["default", "center", "split", "dark"],
      }),
    ],
    slots: [],
    template:
      '<section class="ds-hero ds-hero--{variant}"><div class="ds-hero__content">{#if eyebrow}<p class="ds-hero__eyebrow">{eyebrow}</p>{/if}<h1 class="ds-hero__title">{title}</h1>{#if subtitle}<p class="ds-hero__subtitle">{subtitle}</p>{/if}<div class="ds-hero__actions">{#if ctaLabel}<a class="ds-button ds-button--primary ds-button--lg" href="{ctaHref}">{ctaLabel}</a>{/if}{#if secondaryLabel}<a class="ds-button ds-button--outline ds-button--lg" href="{secondaryHref}">{secondaryLabel}</a>{/if}</div></div>{#if image}<img class="ds-hero__image" src="{image}" alt="" />{/if}</section>',
    variants: [
      { name: "center", props: { variant: "center" } },
      { name: "dark", props: { variant: "dark" } },
    ],
  },
  {
    name: "Stat",
    description: "A key figure: a static value or the row count of a table.",
    category: "Data",
    icon: "#",
    props: [
      prop("label", "string", "Total"),
      prop("value", "string", "42"),
      prop("table", "table", "", {
        description: "Count the rows of this table instead",
      }),
      prop("filter", "string", "", {
        description: "Only count rows matching this filter",
      }),
      prop("delta", "string", ""),
      prop("trend", "select", "flat", { options: ["flat", "up", "down"] }),
      prop("variant", "select", "default", { options: ["default", "primary"] }),
    ],
    slots: [],
    template:
      '<div class="ds-stat ds-stat--{variant} ds-stat--{trend}"><span class="ds-stat__label">{label}</span>{#if table}<span class="ds-stat__value" data-count="{table}" data-filter="{filter}">0</span>{:else}<span class="ds-stat__value">{value}</span>{/if}{#if delta}<span class="ds-stat__delta">{delta}</span>{/if}</div>',
    variants: [
      { name: "up", props: { trend: "up", delta: "+12% this week" } },
      { name: "primary", props: { variant: "primary" } },
    ],
  },
  {
    name: "List",
    description:
      "Rows with an optional thumbnail, title and subtitle, from a table or a static items list.",
    category: "Data",
    icon: "≡",
    props: [
      ...TABLE_PROPS,
      prop("titleField", "field", ""),
      prop("subtitleField", "string", ""),
      prop("imageField", "string", ""),
      prop("items", "list", [], {
        description: "Static items: [{title, subtitle}] when no table",
      }),
      prop("variant", "select", "default", { options: ["default", "plain"] }),
      prop("empty", "string", "Nothing here yet"),
    ],
    slots: [],
    template:
      '{#if table}<ul class="ds-list ds-list--{variant}" data-source="{table}" data-filter="{filter}" data-order="{order}" data-empty="{empty}"><li class="ds-list__item">{#if imageField}<img class="ds-list__thumb" data-field="{imageField}" alt="" />{/if}<div class="ds-list__body"><strong data-field="{titleField}"></strong>{#if subtitleField}<small data-field="{subtitleField}"></small>{/if}</div></li></ul>{:else}<ul class="ds-list ds-list--{variant}">{#each items}<li class="ds-list__item"><div class="ds-list__body"><strong>{title}</strong>{#if subtitle}<small>{subtitle}</small>{/if}</div></li>{/each}</ul>{/if}',
    variants: [
      {
        name: "static",
        props: {
          items: [
            { title: "First", subtitle: "A static item" },
            { title: "Second", subtitle: "Another one" },
          ],
        },
      },
    ],
  },
  {
    name: "Grid",
    description: "Lays its child blocks out in N equal columns.",
    category: "Layout",
    icon: "⊟",
    props: [
      prop("columns", "number", 3),
      prop("gap", "select", "4", { options: ["1", "2", "3", "4", "5", "6"] }),
    ],
    slots: ["children"],
    template:
      '<div class="ds-grid-block" style="--ds-block-columns: {columns}; --ds-block-gap: var(--ds-space-{gap})">{@children}</div>',
    variants: [{ name: "two columns", props: { columns: 2 } }],
  },
  {
    name: "Tabs",
    description: "Tab bar with one panel per item; the first is active.",
    category: "Navigation",
    icon: "⧉",
    props: [
      prop("items", "list", [
        { label: "Overview", content: '<p class="ds-text">First panel.</p>' },
        { label: "Details", content: '<p class="ds-text">Second panel.</p>' },
      ]),
      prop("variant", "select", "default", { options: ["default", "pills"] }),
    ],
    slots: [],
    template:
      '<div class="ds-tabs ds-tabs--{variant}"><div class="ds-tabs__bar" role="tablist">{#each items}<button class="ds-tabs__tab{#if @first} ds-tabs__tab--active{/if}" type="button" role="tab">{label}</button>{/each}</div>{#each items}<div class="ds-tabs__panel{#if @first} ds-tabs__panel--active{/if}" role="tabpanel">{@content}</div>{/each}</div>',
    variants: [{ name: "pills", props: { variant: "pills" } }],
  },
  {
    name: "Modal",
    description:
      "Dialog with a header, body and confirm / cancel actions. Inline in the gallery, fixed on a page.",
    category: "Feedback",
    icon: "▣",
    props: [
      prop("title", "string", "Confirm"),
      prop("body", "html", "Are you sure? This cannot be undone."),
      prop("confirmLabel", "string", "Confirm"),
      prop("cancelLabel", "string", "Cancel"),
      prop("open", "boolean", true),
      prop("variant", "select", "inline", { options: ["inline", "overlay"] }),
    ],
    slots: ["children"],
    template:
      '<div class="ds-modal ds-modal--{variant}" data-open="{open}"><div class="ds-modal__backdrop"></div><div class="ds-modal__dialog" role="dialog" aria-modal="true"><header class="ds-modal__header"><h3>{title}</h3><button class="ds-modal__close" type="button" aria-label="Close" data-close>×</button></header><div class="ds-modal__body">{@body}{@children}</div><footer class="ds-modal__footer"><button class="ds-button" type="button" data-close>{cancelLabel}</button><button class="ds-button ds-button--primary" type="button" data-close>{confirmLabel}</button></footer></div></div>',
    variants: [{ name: "overlay", props: { variant: "overlay" } }],
  },
  {
    name: "Badge",
    description: "Small status label.",
    category: "Feedback",
    icon: "◉",
    props: [
      prop("text", "string", "New"),
      prop("tone", "select", "default", {
        options: ["default", "primary", "accent", "success", "danger", "solid"],
      }),
    ],
    slots: [],
    template: '<span class="ds-badge ds-badge--{tone}">{text}</span>',
    variants: [
      { name: "primary", props: { tone: "primary" } },
      { name: "success", props: { tone: "success", text: "Active" } },
      { name: "danger", props: { tone: "danger", text: "Blocked" } },
    ],
  },
  {
    name: "Avatar",
    description: "A user picture, or initials when there is none.",
    category: "Data",
    icon: "◯",
    props: [
      prop("src", "string", ""),
      prop("name", "string", "Ada Lovelace"),
      prop("initials", "string", "AL"),
      prop("size", "select", "md", { options: ["sm", "md", "lg"] }),
      prop("shape", "select", "round", { options: ["round", "square"] }),
    ],
    slots: [],
    template:
      '<span class="ds-avatar ds-avatar--{size} ds-avatar--{shape}" title="{name}">{#if src}<img src="{src}" alt="{name}" />{:else}<span class="ds-avatar__initials">{initials}</span>{/if}</span>',
    variants: [
      { name: "large", props: { size: "lg" } },
      { name: "square", props: { shape: "square" } },
    ],
  },
];

export const STARTER_README = `# Design system

Everything the pages are built from lives in this folder and is editable in
the **Design** window (New window → Design) or in any editor.

## Tokens (\`design/tokens.json\`)

Semantic colors (\`bg\`, \`surface\`, \`text\`, \`muted\`, \`primary\`,
\`accent\`, \`danger\`, \`border\`; each a single value or \`{light, dark}\`),
typography (font families, a size scale, weights, line heights), spacing,
radius and shadow scales, and breakpoints. They become CSS variables in the
preview: \`--ds-color-primary\`, \`--ds-font-size-md\`, \`--ds-space-4\`,
\`--ds-radius-lg\`, \`--ds-shadow-md\`. Use them in \`styles.css\` too, so one
token change recolors the whole site.

## Components (\`design/components/*.json\`)

Each file describes one component: \`props\` (typed, with defaults; \`table\`
and \`field\` props offer the data model in dropdowns), \`slots\`, a
\`template\` (HTML with \`{prop}\` placeholders, \`{@slot}\` for raw HTML,
\`{#each items}...{/each}\`, \`{#if prop}...{:else}...{/if}\`) and
\`variants\`. Data-bound components use the same \`data-source\` /
\`data-field\` attributes as hand-written HTML, so they render from the
project's tables in the preview.

Use a component in any HTML file with
\`<ds-component name="Badge" props='{"text": "New"}'></ds-component>\` or
\`<div data-component="Card" data-prop-title="Hi">...</div>\`.

## Pages (\`pages/*.json\`)

A page is a 12-column grid of component blocks with props, an optional
table binding and children. \`links\` point at other pages (UX flows on the
project map). Open the **Page Builder** to arrange blocks, edit props, bind
tables and preview per device; pick \`pages/<name>.json\` as the Preview
entry to see it full size. Links with \`href="#/route"\` navigate between
pages inside the preview.

## Guidelines

- Prefer semantic tokens over literal colors; add a token before adding a color.
- Every component has sensible defaults so it renders in the gallery as is.
- Keep templates small; compose pages from blocks instead of growing one component.
`;

/** The design-system files for a fresh project (or the sample). */
export function starterDesignFiles(): Record<string, string> {
  const files: Record<string, string> = {
    [TOKENS_PATH]: serializeTokens(defaultTokens()),
    [DESIGN_README_PATH]: STARTER_README,
  };
  for (const c of STARTER_COMPONENTS)
    files[componentPath(c.name)] = JSON.stringify(c, null, 2) + "\n";
  return files;
}
