/**
 * The starter design system: default tokens, a component library and the
 * guidelines document. The sample projects ship these files and the Design
 * window offers to create them in a project that has none.
 *
 * Templates use the small language of `render.ts`; data-bound components
 * use the M4 `data-source` / `data-field` attributes so they render from
 * the project's tables in the preview. `@key` placeholders in filters read
 * the preview context (`paperos.design.setContext({tenant, role})`), which
 * is how one page set serves several tenants.
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
    description: "data-filter text, e.g. active=true or tenant_id=@tenant",
  }),
  prop("order", "string", "", { description: "Sort column, e.g. -created" }),
];

/** Inline SVG icons the runtime ships (`paperos.design.icons`); `icon` props name one of these. */
export const ICON_NAMES = [
  "home",
  "calendar",
  "users",
  "user",
  "box",
  "cog",
  "chart",
  "mail",
  "phone",
  "linkedin",
  "megaphone",
  "image",
  "tag",
  "receipt",
  "star",
  "chat",
  "plus",
  "search",
  "clock",
  "check",
  "bolt",
  "sparkles",
  "book",
  "pen",
  "file",
  "scissors",
  "utensils",
  "hammer",
  "cart",
  "heart",
  "map",
  "bell",
  "grid",
  "list",
  "money",
  "briefcase",
  "target",
  "send",
] as const;

export const STARTER_COMPONENTS: ComponentDef[] = [
  // ----- Actions -----
  {
    name: "Button",
    description:
      "Action trigger. Renders a link when href is set, a button otherwise. Primary is the accent gradient.",
    category: "Actions",
    icon: "▶",
    props: [
      prop("label", "string", "Button"),
      prop("href", "string", ""),
      prop("icon", "icon", "", { description: "Icon name (see guidelines)" }),
      prop("variant", "select", "primary", {
        options: [
          "primary",
          "secondary",
          "accent",
          "danger",
          "outline",
          "ghost",
          "default",
        ],
      }),
      prop("size", "select", "md", { options: ["sm", "md", "lg"] }),
      prop("full", "boolean", false),
    ],
    slots: [],
    template:
      '{#if href}<a class="ds-button ds-button--{variant} ds-button--{size}{#if full} ds-button--full{/if}" href="{href}">{#if icon}<span class="ds-button__icon" data-icon="{icon}"></span>{/if}{label}</a>{:else}<button class="ds-button ds-button--{variant} ds-button--{size}{#if full} ds-button--full{/if}" type="button">{#if icon}<span class="ds-button__icon" data-icon="{icon}"></span>{/if}{label}</button>{/if}',
    variants: [
      { name: "primary", props: { variant: "primary" } },
      { name: "secondary", props: { variant: "secondary" } },
      { name: "outline", props: { variant: "outline" } },
      { name: "ghost", props: { variant: "ghost" } },
      { name: "danger", props: { variant: "danger", label: "Delete" } },
      { name: "with icon", props: { icon: "plus", label: "New booking" } },
    ],
  },

  // ----- Layout -----
  {
    name: "Card",
    description:
      "Surface with an optional image, kicker, title, text and a footer; lifts on hover; other blocks nest inside.",
    category: "Layout",
    icon: "▭",
    props: [
      prop("kicker", "string", ""),
      prop("title", "string", "Card title"),
      prop("text", "string", "Supporting text goes here."),
      prop("image", "string", ""),
      prop("icon", "icon", "", { description: "Icon tile above the title" }),
      prop("href", "string", "", { description: "Makes the card a link" }),
      prop("hover", "boolean", true),
      prop("variant", "select", "default", {
        options: ["default", "elevated", "outlined", "flat", "glass", "accent"],
      }),
    ],
    slots: ["children", "footer"],
    template:
      '<{#if href}a href="{href}"{:else}article{/if} class="ds-card ds-card--{variant}{#if hover} ds-card--hover{/if}">{#if image}<img class="ds-card__image" src="{image}" alt="" />{/if}<div class="ds-card__body">{#if icon}<div class="ds-card__icon" data-icon="{icon}"></div>{/if}{#if kicker}<p class="ds-card__kicker ds-kicker">{kicker}</p>{/if}{#if title}<h3 class="ds-card__title">{title}</h3>{/if}{#if text}<p class="ds-card__text">{text}</p>{/if}{@children}</div>{#if footer}<footer class="ds-card__footer">{@footer}</footer>{/if}</{#if href}a{:else}article{/if}>',
    variants: [
      { name: "elevated", props: { variant: "elevated" } },
      { name: "outlined", props: { variant: "outlined" } },
      {
        name: "feature",
        props: {
          icon: "bolt",
          kicker: "Fast",
          title: "Book in two taps",
          text: "Customers pick a service and a slot; the calendar fills itself.",
        },
      },
      {
        name: "accent",
        props: { variant: "accent", title: "Upgrade to Pro", kicker: "Plan" },
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
    name: "Section",
    description:
      "A marketing section: kicker, title, text and a grid of child blocks (features, cards).",
    category: "Layout",
    icon: "▤",
    props: [
      prop("kicker", "string", "Features"),
      prop("title", "string", "Everything a small business needs"),
      prop(
        "text",
        "string",
        "Bookings, customers, invoices and marketing, in one calm place."
      ),
      prop("columns", "number", 3),
      prop("variant", "select", "default", { options: ["default", "center"] }),
    ],
    slots: ["children"],
    template:
      '<section class="ds-section ds-section--{variant}"><div class="ds-section__head">{#if kicker}<p class="ds-kicker">{kicker}</p>{/if}{#if title}<h2 class="ds-section__title">{title}</h2>{/if}{#if text}<p class="ds-section__text">{text}</p>{/if}</div>{#if children}<div class="ds-section__body" style="--ds-section-columns: {columns}">{@children}</div>{/if}</section>',
    variants: [{ name: "center", props: { variant: "center" } }],
  },
  {
    name: "PageHeader",
    description:
      "Title, subtitle and an actions slot at the top of an app screen.",
    category: "Layout",
    icon: "▬",
    props: [
      prop("title", "string", "Dashboard"),
      prop("subtitle", "string", "Today at a glance"),
      prop("variant", "select", "default", { options: ["default", "plain"] }),
    ],
    slots: ["children"],
    template:
      '<header class="ds-header ds-header--{variant}"><div class="ds-header__text"><h1 class="ds-header__title">{title}</h1>{#if subtitle}<p class="ds-header__subtitle">{subtitle}</p>{/if}</div>{#if children}<div class="ds-header__actions">{@children}</div>{/if}</header>',
    variants: [{ name: "plain", props: { variant: "plain" } }],
  },

  // ----- Data -----
  {
    name: "Table",
    description:
      "Data table bound to a table of the project: sticky header, zebra rows, density; ref columns show display values.",
    category: "Data",
    icon: "▦",
    props: [
      ...TABLE_PROPS,
      prop("fields", "fields", [], {
        description: "Columns to show (all when empty)",
      }),
      prop("caption", "string", ""),
      prop("variant", "select", "default", {
        options: ["default", "striped", "compact", "comfortable"],
      }),
      prop("maxHeight", "string", "", {
        description: "Scroll inside, e.g. 320px (the header sticks)",
      }),
      prop("empty", "string", "No rows"),
    ],
    slots: [],
    template:
      '<div class="ds-table-wrap"{#if maxHeight} style="--ds-table-max-height: {maxHeight}"{/if}><table class="ds-table ds-table--{variant}">{#if caption}<caption class="ds-table__caption">{caption}</caption>{/if}<thead><tr>{#each columns}<th>{label}</th>{/each}</tr></thead><tbody data-source="{table}" data-filter="{filter}" data-order="{order}" data-empty="{empty}"><tr>{#each columns}{#if isImage}<td><img class="ds-table__thumb" data-field="{name}" alt="" /></td>{:else}{#if isRef}<td data-field="{name}" data-display></td>{:else}<td data-field="{name}"></td>{/if}{/if}{/each}</tr></tbody></table></div>',
    variants: [
      { name: "striped", props: { variant: "striped" } },
      { name: "compact", props: { variant: "compact" } },
    ],
  },
  {
    name: "Form",
    description:
      "A form generated from a table's schema: floating labels, typed inputs, required marks and validation states, ref columns as selects.",
    category: "Data",
    icon: "☑",
    props: [
      prop("table", "table", ""),
      prop("fields", "fields", [], {
        description: "Columns to edit (all but the key when empty)",
      }),
      prop("title", "string", "New record"),
      prop("text", "string", ""),
      prop("submitLabel", "string", "Save"),
      prop("floating", "boolean", true),
      prop("variant", "select", "default", {
        options: ["default", "inline", "plain"],
      }),
    ],
    slots: ["children"],
    template:
      '<form class="ds-form ds-form--{variant}" data-table="{table}" novalidate>{#if title}<h3 class="ds-form__title">{title}</h3>{/if}{#if text}<p class="ds-form__text">{text}</p>{/if}{#each columns}{#if !key}{#if isBoolean}<label class="ds-field ds-field--check"><input type="checkbox" name="{name}" /><span>{label}</span></label>{:else}{#if isRef}<label class="ds-field{#if floating} ds-field--float{/if}"><select class="ds-select" name="{name}"{#if required} required{/if} data-source="{ref}"><option data-field="{refDisplay}"></option></select><span class="ds-field__label">{label}{#if required}<span class="ds-field__required"> *</span>{/if}</span></label>{:else}<label class="ds-field{#if floating} ds-field--float{/if}">{#if !floating}<span class="ds-field__label">{label}{#if required}<span class="ds-field__required"> *</span>{/if}</span>{/if}<input class="ds-input" type="{inputType}" name="{name}" placeholder=" "{#if required} required{/if} />{#if floating}<span class="ds-field__label">{label}{#if required}<span class="ds-field__required"> *</span>{/if}</span>{/if}</label>{/if}{/if}{/if}{/each}{@children}<div class="ds-form__actions"><button class="ds-button ds-button--primary" type="submit">{submitLabel}</button></div></form>',
    variants: [
      { name: "inline", props: { variant: "inline", title: "" } },
      { name: "classic labels", props: { floating: false } },
    ],
  },
  {
    name: "Stat",
    description:
      "A key figure with a delta arrow: a static value or the row count of a table.",
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
      prop("variant", "select", "default", {
        options: ["default", "primary", "glass"],
      }),
    ],
    slots: [],
    template:
      '<div class="ds-stat ds-stat--{variant} ds-stat--{trend}"><span class="ds-stat__label">{label}</span>{#if table}<span class="ds-stat__value" data-count="{table}" data-filter="{filter}">0</span>{:else}<span class="ds-stat__value">{value}</span>{/if}{#if delta}<span class="ds-stat__delta">{delta}</span>{/if}</div>',
    variants: [
      { name: "up", props: { trend: "up", delta: "12% this week" } },
      { name: "down", props: { trend: "down", delta: "3% vs last month" } },
      { name: "primary", props: { variant: "primary" } },
    ],
  },
  {
    name: "KpiGrid",
    description:
      "A row of key figures: static items (label, value, delta, trend) or child Stat blocks.",
    category: "Data",
    icon: "▥",
    props: [
      prop("items", "list", [
        { label: "Revenue", value: "$12.4k", delta: "8% MoM", trend: "up" },
        { label: "Bookings", value: "164", delta: "12 today", trend: "up" },
        { label: "New customers", value: "27", delta: "flat", trend: "flat" },
        { label: "No-shows", value: "3", delta: "down from 7", trend: "down" },
      ]),
      prop("columns", "number", 4),
    ],
    slots: ["children"],
    template:
      '<div class="ds-kpi" style="--ds-kpi-columns: {columns}">{#each items}<div class="ds-kpi__item ds-kpi__item--{trend} ds-stat--{trend}"><span class="ds-stat__label">{label}</span><span class="ds-stat__value">{value}</span>{#if delta}<span class="ds-stat__delta">{delta}</span>{/if}</div>{/each}{@children}</div>',
    variants: [{ name: "three", props: { columns: 3 } }],
  },
  {
    name: "List",
    description:
      "Rows with an optional thumbnail, title, subtitle and a right-hand meta value, from a table or a static items list.",
    category: "Data",
    icon: "≡",
    props: [
      ...TABLE_PROPS,
      prop("titleField", "field", ""),
      prop("subtitleField", "string", ""),
      prop("metaField", "string", "", {
        description: "Right-aligned value (a price, a date)",
      }),
      prop("imageField", "string", ""),
      prop("items", "list", [], {
        description: "Static items: [{title, subtitle, meta}] when no table",
      }),
      prop("variant", "select", "default", { options: ["default", "plain"] }),
      prop("empty", "string", "Nothing here yet"),
    ],
    slots: [],
    template:
      '{#if table}<ul class="ds-list ds-list--{variant}" data-source="{table}" data-filter="{filter}" data-order="{order}" data-empty="{empty}"><li class="ds-list__item">{#if imageField}<img class="ds-list__thumb" data-field="{imageField}" alt="" />{/if}<div class="ds-list__body"><strong data-field="{titleField}"></strong>{#if subtitleField}<small data-field="{subtitleField}"></small>{/if}</div>{#if metaField}<span class="ds-list__meta" data-field="{metaField}"></span>{/if}</li></ul>{:else}<ul class="ds-list ds-list--{variant}">{#each items}<li class="ds-list__item"><div class="ds-list__body"><strong>{title}</strong>{#if subtitle}<small>{subtitle}</small>{/if}</div>{#if meta}<span class="ds-list__meta">{meta}</span>{/if}</li>{/each}</ul>{/if}',
    variants: [
      {
        name: "static",
        props: {
          items: [
            { title: "Haircut", subtitle: "45 min", meta: "$42" },
            { title: "Color", subtitle: "90 min", meta: "$120" },
          ],
        },
      },
    ],
  },
  {
    name: "Avatar",
    description:
      "A user picture, or initials when there is none (computed from the name, tinted per person).",
    category: "Data",
    icon: "◯",
    props: [
      prop("src", "string", ""),
      prop("name", "string", "Ada Lovelace"),
      prop("initials", "string", "", {
        description: "Leave empty to derive from the name",
      }),
      prop("size", "select", "md", { options: ["xs", "sm", "md", "lg"] }),
      prop("shape", "select", "round", { options: ["round", "square"] }),
      prop("ring", "boolean", false),
    ],
    slots: [],
    template:
      '<span class="ds-avatar ds-avatar--{size} ds-avatar--{shape}{#if ring} ds-avatar--ring{/if}" title="{name}" data-name="{name}">{#if src}<img src="{src}" alt="{name}" />{:else}<span class="ds-avatar__initials">{initials}</span>{/if}</span>',
    variants: [
      { name: "large", props: { size: "lg" } },
      { name: "square", props: { shape: "square" } },
      { name: "ring", props: { ring: true, name: "Grace Hopper" } },
    ],
  },
  {
    name: "Chart",
    description:
      "Inline SVG bars or line from a table: rows grouped by the x column, summing the y column (or counting rows). Static values work too.",
    category: "Data",
    icon: "▁▃▅",
    props: [
      prop("title", "string", "Bookings per month"),
      prop("type", "select", "bars", { options: ["bars", "line"] }),
      prop("table", "table", ""),
      prop("xField", "field", "", { description: "Group by this column" }),
      prop("yField", "string", "", {
        description: "Sum this column (count rows when empty)",
      }),
      prop("filter", "string", ""),
      prop("values", "list", [
        { label: "Jan", value: 12 },
        { label: "Feb", value: 18 },
        { label: "Mar", value: 15 },
        { label: "Apr", value: 24 },
        { label: "May", value: 30 },
        { label: "Jun", value: 27 },
      ]),
      prop("height", "number", 180),
      prop("showTotal", "boolean", true),
      prop("format", "select", "number", {
        options: ["number", "currency", "compact"],
      }),
    ],
    slots: [],
    template:
      '<div class="ds-chart" data-chart="{type}" data-table="{table}" data-x="{xField}" data-y="{yField}" data-filter="{filter}" data-values="{values|json}" data-height="{height}" data-format="{format}" data-show-total="{showTotal}"><div class="ds-chart__head">{#if title}<span class="ds-chart__title">{title}</span>{/if}<span class="ds-chart__total"></span></div><div class="ds-chart__body"></div></div>',
    variants: [{ name: "line", props: { type: "line" } }],
  },
  {
    name: "Calendar",
    description:
      "A month grid with the rows of a table as events (a date column and a title column); shows the month of the first event unless set.",
    category: "Data",
    icon: "▦",
    props: [
      prop("table", "table", ""),
      prop("dateField", "field", "", { description: "Date column" }),
      prop("titleField", "string", "", { description: "Event label column" }),
      prop("toneField", "string", "", {
        description: "Column whose value picks a color (status, channel)",
      }),
      prop("filter", "string", ""),
      prop("month", "string", "", { description: "YYYY-MM (empty: auto)" }),
      prop("variant", "select", "default", { options: ["default", "compact"] }),
    ],
    slots: [],
    template:
      '<div class="ds-calendar ds-calendar--{variant}" data-calendar data-table="{table}" data-date="{dateField}" data-title="{titleField}" data-tone="{toneField}" data-filter="{filter}" data-month="{month}"><div class="ds-calendar__head"><span class="ds-calendar__month"></span><span class="ds-calendar__count"></span></div><div class="ds-calendar__grid"></div></div>',
    variants: [{ name: "compact", props: { variant: "compact" } }],
  },
  {
    name: "Kanban",
    description:
      "Columns per stage with one card per row of a table (title, subtitle, meta), for pipelines and content plans.",
    category: "Data",
    icon: "⫴",
    props: [
      prop("table", "table", ""),
      prop("stageField", "field", "", {
        description: "Column holding the stage",
      }),
      prop("stages", "list", ["New", "Contacted", "Qualified", "Won"], {
        description: "Column order",
      }),
      prop("titleField", "string", ""),
      prop("subtitleField", "string", ""),
      prop("metaField", "string", ""),
      prop("filter", "string", ""),
      prop("order", "string", ""),
      prop("empty", "string", "Nothing here"),
    ],
    slots: [],
    template:
      '<div class="ds-kanban">{#each stages}<section class="ds-kanban__col"><header class="ds-kanban__head"><span>{.}</span><span class="ds-kanban__count" data-count="{table}" data-filter=\'{filter} {stageField}="{.}"\'>0</span></header><ul class="ds-kanban__list" data-source="{table}" data-filter=\'{filter} {stageField}="{.}"\' data-order="{order}" data-empty="{empty}"><li class="ds-kanban__card"><span class="ds-kanban__title" data-field="{titleField}"></span>{#if subtitleField}<span class="ds-kanban__sub" data-field="{subtitleField}"></span>{/if}{#if metaField}<div class="ds-kanban__meta"><span data-field="{metaField}"></span></div>{/if}</li></ul></section>{/each}</div>',
    variants: [],
  },
  {
    name: "Timeline",
    description:
      "Dated steps down a line: static items (time, title, text, channel, tone) or the rows of a table (touch logs, sequences, activity).",
    category: "Data",
    icon: "⋮",
    props: [
      ...TABLE_PROPS,
      prop("timeField", "string", ""),
      prop("titleField", "string", ""),
      prop("textField", "string", ""),
      prop("channelField", "string", ""),
      prop("toneField", "string", ""),
      prop("items", "list", [
        {
          time: "Day 1",
          channel: "linkedin",
          title: "Connect",
          text: "Short note, no pitch.",
        },
        {
          time: "Day 3",
          channel: "email",
          title: "Intro email",
          text: "One paragraph, one question.",
        },
        {
          time: "Day 7",
          channel: "call",
          title: "Call",
          text: "Ask about the current tool.",
        },
      ]),
      prop("variant", "select", "default", { options: ["default", "compact"] }),
    ],
    slots: [],
    template:
      '{#if table}<ol class="ds-timeline ds-timeline--{variant}" data-source="{table}" data-filter="{filter}" data-order="{order}"><li class="ds-timeline__item"{#if toneField} data-field="{toneField}" data-attr="data-tone"{/if}><span class="ds-timeline__time" data-field="{timeField}"></span><div class="ds-timeline__body">{#if channelField}<span class="ds-timeline__channel" data-field="{channelField}"></span>{/if}<span class="ds-timeline__title" data-field="{titleField}"></span>{#if textField}<span class="ds-timeline__text" data-field="{textField}"></span>{/if}</div></li></ol>{:else}<ol class="ds-timeline ds-timeline--{variant}">{#each items}<li class="ds-timeline__item" data-tone="{tone}"><span class="ds-timeline__time">{time}</span><div class="ds-timeline__body">{#if channel}<span class="ds-timeline__channel">{channel}</span>{/if}<span class="ds-timeline__title">{title}</span>{#if text}<span class="ds-timeline__text">{text}</span>{/if}</div></li>{/each}</ol>{/if}',
    variants: [{ name: "compact", props: { variant: "compact" } }],
  },
  {
    name: "Thread",
    description:
      "A chat-style thread: messages from a table (author, text, time, side in/out) or static items, with a compose row.",
    category: "Data",
    icon: "💬",
    props: [
      ...TABLE_PROPS,
      prop("authorField", "string", ""),
      prop("textField", "string", ""),
      prop("timeField", "string", ""),
      prop("sideField", "string", "", {
        description: "Column with 'in' or 'out'",
      }),
      prop("items", "list", [
        {
          author: "Maya (Bloom Salon)",
          text: "Hi! Do you have a slot Saturday morning?",
          time: "9:12",
          side: "in",
        },
        {
          author: "You",
          text: "Yes, 10:30 with Jordan. Shall I book it?",
          time: "9:14",
          side: "out",
        },
        {
          author: "Maya (Bloom Salon)",
          text: "Perfect, thank you!",
          time: "9:15",
          side: "in",
        },
      ]),
      prop("compose", "boolean", true),
      prop("placeholder", "string", "Write a message…"),
    ],
    slots: [],
    template:
      '<div class="ds-thread">{#if table}<ul class="ds-thread__list" data-source="{table}" data-filter="{filter}" data-order="{order}"><li class="ds-thread__msg" data-field="{sideField}" data-attr="data-side"><div class="ds-thread__bubble"><span class="ds-thread__author" data-field="{authorField}"></span><span class="ds-thread__text" data-field="{textField}"></span><span class="ds-thread__time" data-field="{timeField}"></span></div></li></ul>{:else}<ul class="ds-thread__list">{#each items}<li class="ds-thread__msg" data-side="{side}"><div class="ds-thread__bubble"><span class="ds-thread__author">{author}</span><span class="ds-thread__text">{text}</span><span class="ds-thread__time">{time}</span></div></li>{/each}</ul>{/if}{#if compose}<div class="ds-thread__compose"><input class="ds-input" placeholder="{placeholder}" /><button class="ds-button ds-button--primary" type="button">Send</button></div>{/if}</div>',
    variants: [{ name: "read only", props: { compose: false } }],
  },
  {
    name: "EmptyState",
    description:
      "What a screen shows before there is data: icon, title, text and a call to action.",
    category: "Feedback",
    icon: "◌",
    props: [
      prop("icon", "icon", "sparkles"),
      prop("title", "string", "No bookings yet"),
      prop(
        "text",
        "string",
        "Share your booking link and the calendar fills itself."
      ),
      prop("ctaLabel", "string", "Copy booking link"),
      prop("ctaHref", "string", "#"),
    ],
    slots: [],
    template:
      '<div class="ds-empty">{#if icon}<div class="ds-empty__icon" data-icon="{icon}"></div>{/if}<h3 class="ds-empty__title">{title}</h3>{#if text}<p class="ds-empty__text">{text}</p>{/if}{#if ctaLabel}<a class="ds-button ds-button--primary ds-button--sm" href="{ctaHref}">{ctaLabel}</a>{/if}</div>',
    variants: [],
  },

  // ----- Navigation -----
  {
    name: "Nav",
    description:
      "Navigation from a menu table (nested by parent_id) or a static items list; vertical side menu or a horizontal glass bar.",
    category: "Navigation",
    icon: "☰",
    props: [
      prop("table", "table", "", {
        description: "Menu table (nested by parent_id)",
      }),
      prop("labelField", "field", "", { description: "Column with the label" }),
      prop("hrefField", "string", "href"),
      prop("filter", "string", ""),
      prop("order", "string", "sort"),
      prop("brand", "string", ""),
      prop("items", "list", [], {
        description: "Static items: [{label, href}] when no table",
      }),
      prop("sticky", "boolean", false),
      prop("variant", "select", "vertical", {
        options: ["vertical", "horizontal"],
      }),
    ],
    slots: ["children"],
    template:
      '<nav class="ds-nav ds-nav--{variant}{#if sticky} ds-nav--sticky{/if}" aria-label="Navigation">{#if brand}<div class="ds-nav__brand">{brand}</div>{/if}{#if table}<ul class="ds-nav__list" data-source="{table}" data-filter="{filter} parent_id=null" data-order="{order}"><li class="ds-nav__item"><a class="ds-nav__link" data-field="{hrefField}"><span data-field="{labelField}"></span></a><ul class="ds-nav__children" data-source="{table}" data-filter="parent_id={{id}}" data-order="{order}"><li><a class="ds-nav__link ds-nav__link--child" data-field="{hrefField}"><span data-field="{labelField}"></span></a></li></ul></li></ul>{:else}<ul class="ds-nav__list">{#each items}<li class="ds-nav__item"><a class="ds-nav__link" href="{href}">{label}</a></li>{/each}</ul>{/if}<span class="ds-nav__spacer"></span>{@children}</nav>',
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
    name: "Topbar",
    description:
      "The glass header of a site or app: brand mark, links and an actions slot on the right (switchers, buttons).",
    category: "Navigation",
    icon: "▔",
    props: [
      prop("brand", "string", "Paper"),
      prop("brandHref", "string", "#/"),
      prop("items", "list", [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
      ]),
      prop("sticky", "boolean", true),
      prop("mark", "boolean", true),
    ],
    slots: ["children"],
    template:
      '<header class="ds-topbar{#if sticky} ds-topbar--sticky{/if}"><a class="ds-topbar__brand" href="{brandHref}">{#if mark}<span class="ds-topbar__mark" aria-hidden="true"></span>{/if}<span>{brand}</span></a>{#if items}<ul class="ds-topbar__links">{#each items}<li><a href="{href}">{label}</a></li>{/each}</ul>{/if}<span class="ds-topbar__spacer"></span><div class="ds-topbar__actions">{@children}</div></header>',
    variants: [{ name: "no mark", props: { mark: false } }],
  },
  {
    name: "Sidebar",
    description:
      "An app side menu from a menu table (label, href, icon, nested by parent_id; rows gated by required_role and business_type) with a brand and a footer slot.",
    category: "Navigation",
    icon: "▍",
    props: [
      prop("brand", "string", "Admin"),
      prop("table", "table", ""),
      prop("labelField", "field", ""),
      prop("hrefField", "string", "href"),
      prop("iconField", "string", "icon"),
      prop("groupField", "string", "", {
        description: "Column that groups items under headings",
      }),
      prop("filter", "string", ""),
      prop("order", "string", "sort"),
      prop("variant", "select", "default", { options: ["default", "rail"] }),
    ],
    slots: ["children"],
    template:
      '<aside class="ds-sidebar ds-sidebar--{variant}"><div class="ds-sidebar__brand"><span class="ds-sidebar__mark" aria-hidden="true"></span><span>{brand}</span></div>{#if groupField}<div data-source="{table}" data-group="{groupField}" data-filter="{filter} parent_id=null"><div><div class="ds-sidebar__group" data-field="$group"></div><ul data-source="{table}" data-filter="{filter} {groupField}={{$group}} parent_id=null" data-order="{order}"><li><a class="ds-sidebar__link" data-field="{hrefField}"><span class="ds-sidebar__icon" data-field="{iconField}" data-as="icon"></span><span data-field="{labelField}"></span></a></li></ul></div></div>{:else}<ul data-source="{table}" data-filter="{filter} parent_id=null" data-order="{order}"><li><a class="ds-sidebar__link" data-field="{hrefField}"><span class="ds-sidebar__icon" data-field="{iconField}" data-as="icon"></span><span data-field="{labelField}"></span></a><ul class="ds-sidebar__children" data-source="{table}" data-filter="parent_id={{id}}" data-order="{order}"><li><a class="ds-sidebar__link" data-field="{hrefField}"><span data-field="{labelField}"></span></a></li></ul></li></ul>{/if}<span class="ds-sidebar__spacer"></span>{#if children}<div class="ds-sidebar__footer">{@children}</div>{/if}</aside>',
    variants: [{ name: "rail", props: { variant: "rail" } }],
  },
  {
    name: "TabBar",
    description:
      "Mobile bottom navigation: up to five items with an icon and a label; the active one is highlighted.",
    category: "Navigation",
    icon: "▂",
    props: [
      prop("items", "list", [
        { label: "Home", icon: "home", href: "#/", active: true },
        { label: "Book", icon: "calendar", href: "#/book" },
        { label: "Bookings", icon: "list", href: "#/bookings" },
        { label: "Profile", icon: "user", href: "#/profile" },
      ]),
      prop("fixed", "boolean", true),
    ],
    slots: [],
    template:
      '<nav class="ds-tabbar{#if fixed} ds-tabbar--fixed{/if}" aria-label="Tabs">{#each items}<a class="ds-tabbar__item{#if active} ds-tabbar__item--active{/if}" href="{href}"><span class="ds-tabbar__icon" data-icon="{icon}"></span><span>{label}</span></a>{/each}</nav>',
    variants: [{ name: "inline", props: { fixed: false } }],
  },
  {
    name: "MegaMenu",
    description:
      "Columns per category from a menu table, with thumbnails and descriptions, on a glass panel.",
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
    name: "TenantSwitcher",
    description:
      "A select over the tenants table that sets the preview context (`@tenant` in filters) and applies the tenant's brand colors.",
    category: "Navigation",
    icon: "⇄",
    props: [
      prop("table", "table", "tenants"),
      prop("labelField", "field", ""),
      prop("label", "string", ""),
    ],
    slots: [],
    template:
      '<label class="ds-row ds-switcher">{#if label}<span class="ds-field__label">{label}</span>{/if}<select class="ds-select" data-set-context="tenant" data-source="{table}" data-order="{labelField}" aria-label="Tenant"><option data-field="{labelField}"></option></select></label>',
    variants: [],
  },
  {
    name: "RoleSwitcher",
    description:
      "A select over the roles table that sets the viewer's role (`@role`); menus and gated blocks follow.",
    category: "Navigation",
    icon: "⇅",
    props: [
      prop("table", "table", "roles"),
      prop("labelField", "field", ""),
      prop("order", "string", "-level"),
      prop("label", "string", "Viewing as"),
    ],
    slots: [],
    template:
      '<label class="ds-row ds-switcher">{#if label}<span class="ds-field__label">{label}</span>{/if}<select class="ds-select" data-set-context="role" data-source="{table}" data-order="{order}" aria-label="Role"><option data-field="{labelField}"></option></select></label>',
    variants: [],
  },
  {
    name: "RoleGate",
    description:
      "Shows its children only when the viewer's role (see RoleSwitcher) reaches the named role's level.",
    category: "Navigation",
    icon: "⛨",
    props: [
      prop("role", "string", "manager", { description: "Minimum role name" }),
      prop("table", "table", "roles"),
      prop("message", "string", "", {
        description: "Shown instead when the role is too low",
      }),
    ],
    slots: ["children"],
    template:
      '<div class="ds-gate" data-min-role="{role}" data-gate-table="{table}">{@children}</div>{#if message}<div class="ds-gate__denied ds-empty" data-gate-denied="{role}" hidden><p class="ds-empty__text">{message}</p></div>{/if}',
    variants: [],
  },

  // ----- Marketing -----
  {
    name: "Hero",
    description:
      "Large introduction: eyebrow, gradient headline, subtitle and two calls to action, on a dotted paper surface.",
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
      prop("gradient", "boolean", true),
      prop("ctaLabel", "string", "Get started"),
      prop("ctaHref", "string", "#/products"),
      prop("secondaryLabel", "string", ""),
      prop("secondaryHref", "string", ""),
      prop("note", "string", "", {
        description: "Small print under the buttons",
      }),
      prop("image", "string", ""),
      prop("variant", "select", "default", {
        options: ["default", "center", "split", "dark", "glass", "compact"],
      }),
    ],
    slots: ["children"],
    template:
      '<section class="ds-hero ds-hero--{variant}"><div class="ds-hero__content">{#if eyebrow}<p class="ds-hero__eyebrow ds-kicker">{eyebrow}</p>{/if}<h1 class="ds-hero__title{#if gradient} ds-hero__title--gradient{/if}">{title}</h1>{#if subtitle}<p class="ds-hero__subtitle">{subtitle}</p>{/if}<div class="ds-hero__actions">{#if ctaLabel}<a class="ds-button ds-button--primary ds-button--lg" href="{ctaHref}">{ctaLabel}</a>{/if}{#if secondaryLabel}<a class="ds-button ds-button--secondary ds-button--lg" href="{secondaryHref}">{secondaryLabel}</a>{/if}</div>{#if note}<p class="ds-hero__note">{note}</p>{/if}</div>{#if image}<img class="ds-hero__image" src="{image}" alt="" />{/if}{@children}</section>',
    variants: [
      { name: "center", props: { variant: "center" } },
      { name: "dark", props: { variant: "dark" } },
      { name: "compact", props: { variant: "compact", secondaryLabel: "" } },
    ],
  },
  {
    name: "Pricing",
    description:
      "Plans side by side: name, price, period, description, feature list and a call to action; one can be featured.",
    category: "Marketing",
    icon: "$",
    props: [
      prop("plans", "list", [
        {
          name: "Starter",
          price: "$0",
          period: "/ month",
          description: "One location, one calendar.",
          features: ["Online booking", "50 customers", "Email reminders"],
          cta: "Start free",
          href: "#/signup",
        },
        {
          name: "Pro",
          price: "$29",
          period: "/ month",
          description: "For teams that are always booked.",
          features: [
            "Unlimited customers",
            "Staff schedules",
            "Invoices and payments",
            "Social and ad templates",
          ],
          cta: "Start 14-day trial",
          href: "#/signup",
          featured: true,
          flag: "Most popular",
        },
        {
          name: "Growth",
          price: "$79",
          period: "/ month",
          description: "Outreach CRM and campaigns.",
          features: [
            "Everything in Pro",
            "Cold outreach sequences",
            "Call sheets",
            "Priority support",
          ],
          cta: "Talk to us",
          href: "#/contact",
        },
      ]),
      prop("columns", "number", 3),
    ],
    slots: [],
    template:
      '<div class="ds-pricing" style="--ds-pricing-columns: {columns}">{#each plans}<article class="ds-pricing__plan{#if featured} ds-pricing__plan--featured{/if}">{#if flag}<span class="ds-badge ds-badge--solid ds-pricing__flag">{flag}</span>{/if}<h3 class="ds-pricing__name">{name}</h3><div class="ds-pricing__price"><span class="ds-pricing__amount">{price}</span><span class="ds-pricing__period">{period}</span></div>{#if description}<p class="ds-pricing__desc">{description}</p>{/if}<ul class="ds-pricing__features">{#each features}<li>{.}</li>{/each}</ul>{#if cta}<a class="ds-button {#if featured}ds-button--primary{:else}ds-button--secondary{/if} ds-button--full" href="{href}">{cta}</a>{/if}</article>{/each}</div>',
    variants: [],
  },
  {
    name: "Testimonial",
    description:
      "Quotes with author, role and stars; one large quote or a row of cards.",
    category: "Marketing",
    icon: "❝",
    props: [
      prop("items", "list", [
        {
          quote:
            "We stopped losing bookings to voicemail. The calendar just fills up.",
          name: "Maya Chen",
          role: "Owner, Bloom Salon",
          stars: 5,
        },
        {
          quote:
            "Invoices go out the moment a job closes. I got two evenings back a week.",
          name: "Luis Ortega",
          role: "Ortega Plumbing",
          stars: 5,
        },
        {
          quote:
            "The outreach sequences landed our three biggest catering contracts.",
          name: "Priya Nair",
          role: "Saffron Table",
          stars: 5,
        },
      ]),
      prop("columns", "number", 3),
      prop("variant", "select", "default", { options: ["default", "large"] }),
    ],
    slots: [],
    template:
      '<div class="ds-testimonials" style="--ds-testimonial-columns: {columns}">{#each items}<figure class="ds-testimonial ds-testimonial--{variant}">{#if stars}<div class="ds-testimonial__stars" aria-label="{stars} stars">★★★★★</div>{/if}<blockquote class="ds-testimonial__quote">{quote}</blockquote><figcaption class="ds-testimonial__author"><span class="ds-avatar ds-avatar--sm" data-name="{name}"><span class="ds-avatar__initials"></span></span><span><span class="ds-testimonial__name">{name}</span><br /><span class="ds-testimonial__role">{role}</span></span></figcaption></figure>{/each}</div>',
    variants: [
      {
        name: "large",
        props: {
          variant: "large",
          columns: 1,
          items: [
            {
              quote: "It feels like the calm version of running a shop.",
              name: "Maya Chen",
              role: "Owner, Bloom Salon",
              stars: 5,
            },
          ],
        },
      },
    ],
  },
  {
    name: "FAQ",
    description:
      "Questions and answers as an accordion (native details elements).",
    category: "Marketing",
    icon: "?",
    props: [
      prop("items", "list", [
        {
          q: "Do my customers need an account?",
          a: "No. They book from a link; a profile is created after the first booking.",
        },
        {
          q: "Can I use it for a restaurant and a salon?",
          a: "Yes. Each tenant picks a business type, which sets its menus, services and templates.",
        },
        {
          q: "Is there a free plan?",
          a: "Starter is free for one location and 50 customers.",
        },
      ]),
      prop("openFirst", "boolean", true),
    ],
    slots: [],
    template:
      '<div class="ds-faq">{#each items}<details class="ds-faq__item"{#if @first}{#if openFirst} open{/if}{/if}><summary class="ds-faq__q">{q}</summary><div class="ds-faq__a">{a}</div></details>{/each}</div>',
    variants: [{ name: "all closed", props: { openFirst: false } }],
  },
  {
    name: "Footer",
    description: "Brand, tagline, link columns and the copyright line.",
    category: "Marketing",
    icon: "▁",
    props: [
      prop("brand", "string", "Paper"),
      prop("tagline", "string", "The calm back office for small businesses."),
      prop("columns", "list", [
        {
          title: "Product",
          links: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "Customer app", href: "#/app" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", href: "#about" },
            { label: "Blog", href: "#blog" },
            { label: "Contact", href: "#contact" },
          ],
        },
        {
          title: "Support",
          links: [
            { label: "Help center", href: "#help" },
            { label: "Status", href: "#status" },
          ],
        },
      ]),
      prop("copyright", "string", "© 2026 Paper. All rights reserved."),
    ],
    slots: ["children"],
    template:
      '<footer class="ds-footer" style="--ds-footer-columns: 3"><div class="ds-footer__top"><div class="ds-footer__brand"><span class="ds-footer__name">{brand}</span>{#if tagline}<span>{tagline}</span>{/if}{@children}</div>{#each columns}<div class="ds-footer__col"><h4>{title}</h4><ul>{#each links}<li><a href="{href}">{label}</a></li>{/each}</ul></div>{/each}</div><div class="ds-footer__bottom"><span>{copyright}</span><span>Made with PaperOS</span></div></footer>',
    variants: [],
  },
  {
    name: "PostCard",
    description:
      "A social post template on the brand tokens: square, story or landscape; export it as PNG from the preview.",
    category: "Marketing",
    icon: "▣",
    props: [
      prop("brand", "string", "Bloom Salon"),
      prop("handle", "string", "@bloomsalon"),
      prop("kicker", "string", "This week"),
      prop("title", "string", "20% off color, Tuesday to Thursday"),
      prop("text", "string", "Book online in two taps. Limited slots."),
      prop("tags", "string", "#salon #color #booknow"),
      prop("cta", "string", "Book now"),
      prop("format", "select", "square", {
        options: ["square", "story", "landscape"],
      }),
      prop("variant", "select", "default", {
        options: ["default", "ink", "accent"],
      }),
    ],
    slots: [],
    template:
      '<article class="ds-post ds-post--{format} ds-post--{variant}"><header class="ds-post__head"><span class="ds-avatar ds-avatar--sm" data-name="{brand}"><span class="ds-avatar__initials"></span></span><span><span class="ds-post__brand">{brand}</span><br /><span class="ds-post__handle">{handle}</span></span></header><div class="ds-post__body">{#if kicker}<p class="ds-post__kicker ds-kicker">{kicker}</p>{/if}<h2 class="ds-post__title">{title}</h2>{#if text}<p class="ds-post__text">{text}</p>{/if}</div><footer class="ds-post__foot"><span class="ds-post__tags">{tags}</span>{#if cta}<span class="ds-post__cta">{cta}</span>{/if}</footer></article>',
    variants: [
      { name: "ink", props: { variant: "ink" } },
      { name: "accent", props: { variant: "accent" } },
      { name: "story", props: { format: "story" } },
    ],
  },
  {
    name: "AdCard",
    description:
      "An ad variant for A/B tests: label, image headline, copy, call to action and a metrics line.",
    category: "Marketing",
    icon: "◈",
    props: [
      prop("tag", "string", "A", { description: "A, B, C…" }),
      prop("channel", "string", "Instagram"),
      prop("imageText", "string", "Your Saturday, booked."),
      prop("imageTone", "select", "gradient", {
        options: ["gradient", "muted", "ink"],
      }),
      prop("headline", "string", "Online booking for salons"),
      prop(
        "body",
        "string",
        "Fill quiet hours with a link customers actually use."
      ),
      prop("cta", "string", "Try free"),
      prop("metrics", "string", "CTR 2.4% · CPC $0.62"),
    ],
    slots: [],
    template:
      '<article class="ds-ad"><div class="ds-ad__label"><span>{channel} ad</span><span class="ds-ad__variant">Variant {tag}</span></div><div class="ds-ad__image ds-ad__image--{imageTone}">{imageText}</div><div class="ds-ad__headline">{headline}</div><p class="ds-ad__body">{body}</p><div class="ds-ad__foot"><span class="ds-button ds-button--primary ds-button--sm">{cta}</span><span class="ds-ad__metrics">{metrics}</span></div></article>',
    variants: [
      {
        name: "B",
        props: {
          tag: "B",
          imageTone: "ink",
          imageText: "No more voicemail.",
          headline: "Bookings while you sleep",
        },
      },
    ],
  },

  // ----- Feedback -----
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
      '<div class="ds-modal ds-modal--{variant}" data-open="{open}"><div class="ds-modal__backdrop"></div><div class="ds-modal__dialog" role="dialog" aria-modal="true"><header class="ds-modal__header"><h3>{title}</h3><button class="ds-modal__close" type="button" aria-label="Close" data-close>×</button></header><div class="ds-modal__body">{@body}{@children}</div><footer class="ds-modal__footer"><button class="ds-button ds-button--ghost" type="button" data-close>{cancelLabel}</button><button class="ds-button ds-button--primary" type="button" data-close>{confirmLabel}</button></footer></div></div>',
    variants: [{ name: "overlay", props: { variant: "overlay" } }],
  },
  {
    name: "Badge",
    description: "Small status label, optionally with a status dot.",
    category: "Feedback",
    icon: "◉",
    props: [
      prop("text", "string", "New"),
      prop("tone", "select", "default", {
        options: [
          "default",
          "outline",
          "primary",
          "accent",
          "success",
          "warn",
          "danger",
          "solid",
        ],
      }),
      prop("dot", "boolean", false),
      prop("pulse", "boolean", false),
    ],
    slots: [],
    template:
      '<span class="ds-badge ds-badge--{tone}{#if pulse} ds-badge--pulse{/if}">{#if dot}<span class="ds-badge__dot"></span>{/if}{text}</span>',
    variants: [
      { name: "primary", props: { tone: "primary" } },
      {
        name: "success",
        props: { tone: "success", text: "Active", dot: true },
      },
      { name: "warn", props: { tone: "warn", text: "Pending" } },
      { name: "danger", props: { tone: "danger", text: "Blocked" } },
      {
        name: "live",
        props: { tone: "success", text: "Live", dot: true, pulse: true },
      },
    ],
  },
];

export const STARTER_README = `# Design system

Everything the pages are built from lives in this folder and is editable in
the **Design** window (New window → Design) or in any editor. The visual
language is "paper and ink": a warm sheet with ink on it, one accent
gradient (rose → ember → amber) used sparingly, hairlines and soft layered
shadows instead of heavy fills, quiet motion, and a 24px dot grid where a
background needs texture.

## Tokens (\`design/tokens.json\`)

Semantic colors (\`bg\`, \`bg2\`, \`surface\`, \`surface2\`, \`glass\`, \`ink\`,
\`text\`, \`muted\`, \`border\`, \`borderStrong\`, \`dot\`, \`primary\`, \`accent\`,
\`accent2\`, \`accentInk\`, \`ok\`, \`warn\`, \`danger\`; each a single value or
\`{light, dark}\`), typography (\`sans\`, \`display\`, \`mono\` stacks, a fluid
size scale, weights, line heights, letter spacing), spacing (4px steps),
radius (8 / 12 / 20 / 28 / pill), layered shadows and a glow, breakpoints and
motion (easing, 180ms, 700ms). They become CSS variables in the preview:
\`--ds-color-primary\`, \`--ds-font-display\`, \`--ds-font-size-2xl\`,
\`--ds-space-4\`, \`--ds-radius-lg\`, \`--ds-shadow-md\`, \`--ds-motion-fast\`, and
the derived \`--ds-gradient\`. Use them in \`styles.css\` too, so one token
change recolors the whole site.

**Theme presets** in the Design window swap the whole set: Paper (default),
Ink (dark-first), Studio (neutral) and Bold (saturated). Dark mode follows
the system or \`<html data-theme="dark">\`; \`[data-toggle-theme]\` buttons
flip it.

## Components (\`design/components/*.json\`)

Each file describes one component: \`props\` (typed, with defaults; \`table\`
and \`field\` props offer the data model in dropdowns, \`icon\` props name an
inline icon), \`slots\`, a \`template\` (HTML with \`{prop}\` placeholders,
\`{@slot}\` for raw HTML, \`{#each items}...{/each}\`,
\`{#if prop}...{:else}...{/if}\`, \`{{literal}}\`) and \`variants\`. Data-bound
components use the same \`data-source\` / \`data-field\` attributes as
hand-written HTML, so they render from the project's tables in the preview.

The library: Button, Card, Grid, Section, PageHeader (layout); Table, Form,
Stat, KpiGrid, List, Avatar, Chart, Calendar, Kanban, Timeline, Thread,
EmptyState (data); Nav, Topbar, Sidebar, TabBar, MegaMenu, Tabs,
TenantSwitcher, RoleSwitcher, RoleGate (navigation); Hero, Pricing,
Testimonial, FAQ, Footer, PostCard, AdCard (marketing); Modal, Badge
(feedback). Chart and Calendar draw themselves in the preview from the
bound table; Avatar derives initials from the name.

Icons: ${ICON_NAMES.join(", ")}.

Use a component in any HTML file with
\`<ds-component name="Badge" props='{"text": "New"}'></ds-component>\` or
\`<div data-component="Card" data-prop-title="Hi">...</div>\`.

## Context: tenants and roles

Filters may use \`@key\` placeholders that read the preview context:
\`tenant_id=@tenant\`, \`app=customer\`. \`paperos.design.setContext({tenant, role})\`
sets it (the TenantSwitcher and RoleSwitcher components do), re-renders every
bound list and applies the tenant's brand colors from the \`tenants\` table
(\`brand_primary\`, \`brand_accent\`, \`brand_accent2\`). A Preview entry can carry
it in its URL: \`pages/apps/customer/home.json?tenant=2&role=3\`. Rows with a
\`required_role\` column are hidden from roles below that level; RoleGate hides
whole blocks.

## Pages (\`pages/**/*.json\`)

A page is a 12-column grid of component blocks with props, an optional
table binding and children. \`links\` point at other pages (UX flows on the
project map). Pages can live in folders (\`pages/apps/customer/home.json\`
is the page \`apps/customer/home\`). Open the **Page Builder** to arrange
blocks, edit props, bind tables and preview per device; pick
\`pages/<name>.json\` as the Preview entry to see it full size. Links with
\`href="#/route"\` navigate between pages inside the preview.

## Guidelines

- Prefer semantic tokens over literal colors; add a token before adding a color.
- One accent per surface: the primary action gets the gradient, nothing else does.
- Every component has sensible defaults so it renders in the gallery as is.
- Keep templates small; compose pages from blocks instead of growing one component.
- Respect \`prefers-reduced-motion\`: the base styles already do.
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
