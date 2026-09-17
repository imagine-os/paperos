import { starterDesignFiles } from "@/design/starter";
import type { FileMap } from "./types";

export const SAMPLE_NAME = "Sample site";

/** A tiny SVG placeholder thumbnail as a data URI (no network needed). */
function thumb(bg: string, letter: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='48' viewBox='0 0 64 48'><rect width='64' height='48' rx='8' fill='${bg}'/><text x='32' y='31' font-family='sans-serif' font-size='20' font-weight='700' text-anchor='middle' fill='white'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** The tiny site every fresh install starts with: HTML/CSS/JS plus a small data model. */
export function sampleProjectFiles(): FileMap {
  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Hello, PaperOS</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="top">
      <strong>Sample site</strong>
      <label class="role">
        Viewing as
        <!-- Options come from the roles table; app.js reads the picked row id. -->
        <select id="role" data-source="roles" data-order="-level">
          <option data-field="name"></option>
        </select>
      </label>
    </header>
    <div class="layout">
      <!-- Built by app.js from menu_items (nested by parent_id, filtered by role). -->
      <nav id="side-menu" class="side" aria-label="Side menu"></nav>
      <main>
        <h1>Hello, PaperOS</h1>
        <p>Edit <code>index.html</code>, <code>styles.css</code> or <code>app.js</code>
        and watch the preview update. The menus come from <code>data/menu_items.json</code>;
        open the <strong>Data</strong> window to change them.</p>
        <button id="count">Clicked 0 times</button>

        <h2>Mega menu</h2>
        <!-- Declarative: one column per category, items with thumbnails, children nested. -->
        <div id="mega-menu" class="mega" data-source="menu_items" data-group="category" data-order="sort">
          <section class="mega__col">
            <h3 data-field="$group"></h3>
            <ul data-source="menu_items" data-filter="category={$group} parent_id=null" data-order="sort">
              <li class="mega__item">
                <a data-field="href" class="mega__link">
                  <img data-field="thumbnail_url" alt="" class="mega__thumb" />
                  <span class="mega__text">
                    <span data-field="label" class="mega__label"></span>
                    <small data-field="description"></small>
                  </span>
                </a>
                <ul class="mega__children" data-source="menu_items" data-filter="parent_id={id}" data-order="sort">
                  <li><a data-field="href"><i data-field="icon" data-as="icon"></i><span data-field="label"></span></a></li>
                </ul>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`,
    "styles.css": `:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #f4f4f8;
  color: #18181b;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: white;
  border-bottom: 1px solid #e4e4ea;
}

.role select {
  font: inherit;
  margin-left: 6px;
}

.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  padding: 16px;
}

main {
  padding: 24px;
  border-radius: 16px;
  background: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

/* Design tokens from design/tokens.json arrive as --ds-* variables in the preview. */
h1 {
  margin-top: 0;
  color: var(--ds-color-primary, #2563eb);
}

button {
  font: inherit;
  padding: 8px 14px;
  border-radius: var(--ds-radius-md, 8px);
  border: 1px solid #c9c9d1;
  background: var(--ds-color-primary, #2563eb);
  color: white;
  cursor: pointer;
}

/* Side menu (built by app.js) */
.side {
  background: white;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  align-self: start;
}

.side ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.side ul ul {
  margin-left: 22px;
  border-left: 1px solid #e4e4ea;
}

.side a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.side a:hover {
  background: #eef2ff;
}

.side svg,
.mega svg {
  width: 16px;
  height: 16px;
  flex: none;
}

.side .badge {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
}

/* Mega menu (declarative data-source) */
.mega {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.mega__col h3 {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
}

.mega ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mega__item {
  margin-bottom: 10px;
}

.mega__link {
  display: flex;
  gap: 10px;
  align-items: center;
  color: inherit;
  text-decoration: none;
}

.mega__thumb {
  width: 48px;
  height: 36px;
  border-radius: 6px;
}

.mega__text {
  display: flex;
  flex-direction: column;
}

.mega__label {
  font-weight: 600;
}

.mega small {
  color: #6b7280;
}

.mega__children {
  margin: 6px 0 0 58px !important;
}

.mega__children a {
  display: flex;
  gap: 6px;
  align-items: center;
  color: #2563eb;
  text-decoration: none;
  font-size: 13px;
  padding: 2px 0;
}
`,
    "app.js": `// Counter button (unchanged from the first sample).
const button = document.querySelector("#count");
let clicks = 0;
button.addEventListener("click", () => {
  clicks += 1;
  button.textContent = \`Clicked \${clicks} time\${clicks === 1 ? "" : "s"}\`;
  console.log("clicked", clicks);
});

// Inline SVG icons; menu_items.icon holds one of these names.
const ICONS = {
  home: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8 8 2l6 6M4 7v7h8V7"/></svg>',
  box: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5l6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6"/></svg>',
  laptop: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="10" height="7" rx="1"/><path d="M1 13h14"/></svg>',
  phone: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><path d="M7 12.5h2"/></svg>',
  plug: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 2v4M11 2v4M3 6h10l-1 4a4 4 0 0 1-8 0zM8 12v3"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 13 1-4 7-7 3 3-7 7zM10 3l3 3"/></svg>',
  book: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2h9a1 1 0 0 1 1 1v11H4a1 1 0 0 1-1-1zM3 11h10"/></svg>',
  users: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1.5 14a4.5 4.5 0 0 1 9 0M10 3a2.5 2.5 0 0 1 0 5M12 10a4 4 0 0 1 2.5 4"/></svg>',
  cog: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3"/></svg>',
  file: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1.5h5l3 3v10H4zM9 1.5v3h3"/></svg>',
};
paperos.data.icons = ICONS;
paperos.data.autoHydrate = false; // we hydrate below, with the role filter

const roleSelect = document.querySelector("#role");
const sideMenu = document.querySelector("#side-menu");
let selectedRoleId = null;

function currentRole() {
  return selectedRoleId === null ? null : paperos.data.roles.get(selectedRoleId);
}

// A menu item is visible when the viewer's role level reaches the item's required role.
function allowed(item) {
  if (item.required_role === null || item.required_role === undefined) return true;
  const role = currentRole();
  const needed = paperos.data.roles.get(item.required_role);
  return !!role && (!needed || role.level >= needed.level);
}

// Side menu: nested lists from menu_items, rows filtered by the current role.
function renderSideMenu(parentId) {
  const items = paperos.data.menu_items
    .list({ where: { parent_id: parentId }, orderBy: "sort" })
    .filter(allowed);
  if (!items.length) return null;
  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.dataset.id = item.id;
    const a = document.createElement("a");
    a.href = item.href || "#";
    a.innerHTML = (ICONS[item.icon] || "") + "<span></span>";
    a.querySelector("span").textContent = item.label;
    const needed = item.required_role && paperos.data.roles.get(item.required_role);
    if (needed && needed.level > 1) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = needed.name;
      a.appendChild(badge);
    }
    li.appendChild(a);
    const children = renderSideMenu(item.id);
    if (children) li.appendChild(children);
    ul.appendChild(li);
  }
  return ul;
}

function render() {
  sideMenu.textContent = "";
  const tree = renderSideMenu(null);
  if (tree) sideMenu.appendChild(tree);
  // Mega menu and any other data-source element: the declarative renderer, with our role filter.
  paperos.data.hydrate(document, {
    visible: (table, row) => table !== "menu_items" || allowed(row),
  });
  // hydrate() rebuilt the role <select> too; keep the chosen role selected.
  for (const option of roleSelect.options) option.selected = option.dataset.id === String(selectedRoleId);
}

paperos.data.hydrate(roleSelect.parentElement); // fill the role options first
selectedRoleId = roleSelect.options[0] ? roleSelect.options[0].dataset.id : null;
roleSelect.addEventListener("change", () => {
  selectedRoleId = roleSelect.selectedOptions[0].dataset.id;
  render();
});
render();

console.log("Hello from app.js");
`,
    "README.md": `# Sample site

A tiny HTML/CSS/JS site that ships with PaperOS so the IDE is never empty.

- **Files** shows the project tree. Click a file to open it in an editor.
- **Editor** is CodeMirror 6; press \`Ctrl+S\` to save.
- **Preview** renders \`index.html\` with the styles and scripts inlined and
  refreshes as you type.
- **Console** shows what the preview logs, and runs snippets in it.

## Data

\`data/schema.json\` declares four tables (\`roles\`, \`users\`, \`menu_items\`,
\`pages\`) and \`data/<table>.json\` holds their rows. Open the **Data** window
to browse and edit them, **Schema** for the entity-relationship view and
**Connections** to see which components, pages and files use each table.

- The **side menu** is built in \`app.js\` with \`paperos.data.menu_items.list()\`,
  nested by \`parent_id\` and filtered by the viewer's role
  (\`required_role\` points at the \`roles\` table; a role sees items whose
  required level it reaches).
- The **mega menu** is declarative: \`data-source="menu_items"\` with
  \`data-group="category"\`, nested \`data-source\` lists for children,
  \`data-field\` for labels, thumbnails (\`thumbnail_url\`) and icons.
- \`components/*.json\` and \`pages/*.json\` declare what each component and
  page binds to; the Connections window reads them.

Change a label or a role in the Data window and the preview updates.

## Design system and pages

\`design/tokens.json\` holds the colors, type scale, spacing, radius and
shadows (the **Design** window edits them; they become \`--ds-*\` variables
in the preview, and \`styles.css\` uses \`--ds-color-primary\`).
\`design/components/*.json\` is a starter component library and
\`pages/home.json\`, \`pages/products.json\` and \`pages/admin.json\` compose
those components on a 12-column grid, bound to the tables above. Open the
**Page Builder** to edit them, or pick \`pages/home.json\` as the Preview
entry. See \`design/README.md\`.

Open your own code with **Open** in the top bar: a folder (Chromium), a ZIP,
or a public GitHub repository URL.
`,
    "data/schema.json": json({
      tables: [
        {
          name: "roles",
          description:
            "Access levels. A viewer sees menu items whose required role has a lower or equal level.",
          columns: [
            { name: "id", type: "number", required: true, unique: true },
            { name: "name", type: "string", required: true, unique: true },
            { name: "level", type: "number", required: true, default: 1 },
            { name: "description", type: "string" },
          ],
        },
        {
          name: "users",
          display: "name",
          columns: [
            { name: "id", type: "number", required: true, unique: true },
            { name: "name", type: "string", required: true },
            { name: "email", type: "string", required: true, unique: true },
            { name: "role_id", type: "ref", ref: "roles", required: true },
            { name: "avatar", type: "image" },
            { name: "active", type: "boolean", default: true },
            { name: "joined", type: "date" },
            { name: "prefs", type: "json" },
          ],
        },
        {
          name: "menu_items",
          display: "label",
          description:
            "Navigation. parent_id nests items; category groups the mega menu; required_role restricts access.",
          columns: [
            { name: "id", type: "number", required: true, unique: true },
            { name: "label", type: "string", required: true },
            { name: "parent_id", type: "ref", ref: "menu_items" },
            { name: "category", type: "string" },
            {
              name: "icon",
              type: "string",
              description: "Name of an inline SVG icon in app.js",
            },
            { name: "thumbnail_url", type: "image" },
            { name: "href", type: "string" },
            { name: "description", type: "string" },
            { name: "required_role", type: "ref", ref: "roles" },
            { name: "sort", type: "number", default: 0 },
          ],
        },
        {
          name: "pages",
          display: "title",
          columns: [
            { name: "id", type: "number", required: true, unique: true },
            { name: "title", type: "string", required: true },
            { name: "path", type: "string", required: true, unique: true },
            {
              name: "file",
              type: "string",
              description: "HTML file rendering the page",
            },
            { name: "required_role", type: "ref", ref: "roles" },
            { name: "published", type: "boolean", default: true },
          ],
        },
      ],
    }),
    "data/roles.json": json([
      {
        id: 1,
        name: "Admin",
        level: 3,
        description: "Everything, including the admin tools",
      },
      { id: 2, name: "Editor", level: 2, description: "Content and catalog" },
      { id: 3, name: "Viewer", level: 1, description: "Public pages only" },
    ]),
    "data/users.json": json([
      {
        id: 1,
        name: "Ada",
        email: "ada@example.com",
        role_id: 1,
        avatar: thumb("#7c3aed", "A"),
        active: true,
        joined: "2026-01-12",
        prefs: { theme: "dark" },
      },
      {
        id: 2,
        name: "Grace",
        email: "grace@example.com",
        role_id: 2,
        avatar: thumb("#0891b2", "G"),
        active: true,
        joined: "2026-03-02",
        prefs: { theme: "light", digest: "weekly" },
      },
      {
        id: 3,
        name: "Linus",
        email: "linus@example.com",
        role_id: 3,
        avatar: thumb("#059669", "L"),
        active: false,
        joined: "2026-05-20",
        prefs: null,
      },
    ]),
    "data/menu_items.json": json([
      {
        id: 1,
        label: "Home",
        parent_id: null,
        category: "Main",
        icon: "home",
        thumbnail_url: thumb("#2563eb", "H"),
        href: "#home",
        description: "Start page",
        required_role: 3,
        sort: 1,
      },
      {
        id: 2,
        label: "Docs",
        parent_id: null,
        category: "Main",
        icon: "book",
        thumbnail_url: thumb("#0891b2", "D"),
        href: "#docs",
        description: "Guides and reference",
        required_role: 3,
        sort: 2,
      },
      {
        id: 3,
        label: "Products",
        parent_id: null,
        category: "Catalog",
        icon: "box",
        thumbnail_url: thumb("#d97706", "P"),
        href: "#products",
        description: "Everything we sell",
        required_role: 3,
        sort: 1,
      },
      {
        id: 4,
        label: "Laptops",
        parent_id: 3,
        category: "Catalog",
        icon: "laptop",
        thumbnail_url: thumb("#d97706", "L"),
        href: "#products/laptops",
        description: "",
        required_role: 3,
        sort: 1,
      },
      {
        id: 5,
        label: "Phones",
        parent_id: 3,
        category: "Catalog",
        icon: "phone",
        thumbnail_url: thumb("#d97706", "P"),
        href: "#products/phones",
        description: "",
        required_role: 3,
        sort: 2,
      },
      {
        id: 6,
        label: "Accessories",
        parent_id: 3,
        category: "Catalog",
        icon: "plug",
        thumbnail_url: thumb("#d97706", "A"),
        href: "#products/accessories",
        description: "",
        required_role: 3,
        sort: 3,
      },
      {
        id: 7,
        label: "Blog",
        parent_id: null,
        category: "Content",
        icon: "pen",
        thumbnail_url: thumb("#059669", "B"),
        href: "#blog",
        description: "News and articles",
        required_role: 3,
        sort: 1,
      },
      {
        id: 8,
        label: "Drafts",
        parent_id: 7,
        category: "Content",
        icon: "file",
        thumbnail_url: thumb("#059669", "D"),
        href: "#blog/drafts",
        description: "",
        required_role: 2,
        sort: 1,
      },
      {
        id: 9,
        label: "Admin",
        parent_id: null,
        category: "Tools",
        icon: "cog",
        thumbnail_url: thumb("#dc2626", "A"),
        href: "#admin",
        description: "Site administration",
        required_role: 1,
        sort: 1,
      },
      {
        id: 10,
        label: "Users",
        parent_id: 9,
        category: "Tools",
        icon: "users",
        thumbnail_url: thumb("#dc2626", "U"),
        href: "#admin/users",
        description: "",
        required_role: 1,
        sort: 1,
      },
      {
        id: 11,
        label: "Settings",
        parent_id: 9,
        category: "Tools",
        icon: "cog",
        thumbnail_url: thumb("#dc2626", "S"),
        href: "#admin/settings",
        description: "",
        required_role: 1,
        sort: 2,
      },
    ]),
    "data/pages.json": json([
      {
        id: 1,
        title: "Home",
        path: "/",
        file: "index.html",
        required_role: 3,
        published: true,
      },
      {
        id: 2,
        title: "Products",
        path: "/products",
        file: "index.html",
        required_role: 3,
        published: true,
      },
      {
        id: 3,
        title: "Blog",
        path: "/blog",
        file: "index.html",
        required_role: 3,
        published: true,
      },
      {
        id: 4,
        title: "Admin",
        path: "/admin",
        file: "index.html",
        required_role: 1,
        published: false,
      },
    ]),
    "components/side-menu.json": json({
      name: "side-menu",
      description:
        "Nested navigation built by app.js from menu_items, filtered by the viewer's role.",
      element: "#side-menu",
      bindings: [
        {
          table: "menu_items",
          fields: [
            "label",
            "icon",
            "href",
            "parent_id",
            "required_role",
            "sort",
          ],
          mode: "read",
        },
        { table: "roles", fields: ["name", "level"], mode: "read" },
      ],
    }),
    "components/mega-menu.json": json({
      name: "mega-menu",
      description:
        "Columns per category with thumbnails and nested children (declarative data-source in index.html).",
      element: "#mega-menu",
      bindings: [
        {
          table: "menu_items",
          fields: [
            "label",
            "category",
            "thumbnail_url",
            "description",
            "href",
            "icon",
            "parent_id",
            "sort",
          ],
          mode: "read",
        },
      ],
    }),
    ...samplePages(),
    ...starterDesignFiles(),
    "plugins/hello.js": `// A PaperOS plugin: an ES module exporting activate(api).
// Enable it in New window -> Plugins. It runs in this page, like the devtools.
export const name = "Hello plugin";
export const description = "Adds a command and a window kind from the sample project.";

export function activate(api) {
  api.registerCommand({
    id: "hello.greet",
    title: "Hello plugin: greet",
    group: "Plugin",
    run: () => api.console.log("Hello from plugins/hello.js"),
  });
  api.registerWindowKind({
    id: "hello",
    label: "Hello",
    icon: "\\u{1F44B}",
    html: (ctx) =>
      "<div style='padding:16px;font:14px system-ui'>Hello, <b>" +
      ctx.window.title +
      "</b>. Windows: " +
      api.windows.list().length +
      "</div>",
  });
}
`,
  };
}

const NAV_ITEMS = [
  { label: "Home", href: "#/" },
  { label: "Products", href: "#/products" },
  { label: "Admin", href: "#/admin" },
];

const nav = (id: string) => ({
  id,
  name: "Nav",
  span: 12,
  variant: "horizontal",
  props: { brand: "Sample site", items: NAV_ITEMS },
});

/** Three pages composed from the starter components and bound to the tables. */
function samplePages(): FileMap {
  return {
    "pages/home.json": json({
      name: "home",
      title: "Home",
      route: "/",
      description: "Landing page: hero, key figures and the mega menu.",
      layout: { columns: 12, gap: "4", maxWidth: "1200px" },
      components: [
        nav("nav"),
        {
          id: "hero",
          name: "Hero",
          span: 12,
          props: {
            eyebrow: "Sample site",
            title: "Hello, PaperOS",
            subtitle:
              "This page is composed from design components bound to the project's tables. Edit it in the Page Builder.",
            ctaLabel: "Browse products",
            ctaHref: "#/products",
            secondaryLabel: "Admin",
            secondaryHref: "#/admin",
          },
        },
        {
          id: "stats",
          name: "Grid",
          span: 12,
          props: { columns: 3 },
          children: [
            {
              id: "stat-users",
              name: "Stat",
              span: 4,
              props: { label: "Users", delta: "in data/users.json" },
              bindings: [{ table: "users" }],
            },
            {
              id: "stat-items",
              name: "Stat",
              span: 4,
              props: {
                label: "Menu items",
                trend: "up",
                delta: "nested by parent_id",
              },
              bindings: [{ table: "menu_items" }],
            },
            {
              id: "stat-roles",
              name: "Stat",
              span: 4,
              variant: "primary",
              props: { label: "Roles" },
              bindings: [{ table: "roles" }],
            },
          ],
        },
        {
          id: "mega",
          name: "MegaMenu",
          span: 12,
          props: { groupBy: "category", labelField: "label" },
          bindings: [
            {
              table: "menu_items",
              fields: [
                "label",
                "category",
                "thumbnail_url",
                "description",
                "href",
              ],
            },
          ],
        },
      ],
      links: [
        { to: "products", label: "Browse products", from: "hero" },
        { to: "admin", label: "Admin", from: "hero" },
      ],
      bindings: [{ table: "roles", fields: ["name", "level"], mode: "read" }],
    }),
    "pages/products.json": json({
      name: "products",
      title: "Products",
      route: "/products",
      description: "The catalog: a table and a list of the product menu items.",
      layout: { columns: 12, gap: "4", maxWidth: "1200px" },
      components: [
        nav("nav"),
        {
          id: "hero",
          name: "Hero",
          span: 12,
          variant: "center",
          props: {
            eyebrow: "Catalog",
            title: "Products",
            subtitle: "Everything we sell, straight from the menu_items table.",
            ctaLabel: "Back home",
            ctaHref: "#/",
            secondaryLabel: "",
          },
        },
        {
          id: "catalog",
          name: "Table",
          span: 8,
          variant: "striped",
          props: { caption: "Catalog items" },
          bindings: [
            {
              table: "menu_items",
              fields: [
                "thumbnail_url",
                "label",
                "description",
                "href",
                "required_role",
              ],
              filter: "category=Catalog",
              order: "sort",
            },
          ],
        },
        {
          id: "featured",
          name: "Card",
          span: 4,
          variant: "elevated",
          props: {
            title: "Featured",
            text: "Sub-items of Products, with thumbnails.",
          },
          children: [
            {
              id: "featured-list",
              name: "List",
              span: 12,
              variant: "plain",
              props: {
                titleField: "label",
                subtitleField: "href",
                imageField: "thumbnail_url",
              },
              bindings: [
                {
                  table: "menu_items",
                  fields: ["label", "href", "thumbnail_url"],
                  filter: "parent_id=3",
                  order: "sort",
                },
              ],
            },
          ],
        },
      ],
      links: [
        { to: "home", label: "Back home", from: "hero" },
        { to: "admin", label: "Admin", from: "nav" },
      ],
    }),
    "pages/admin.json": json({
      name: "admin",
      title: "Admin",
      route: "/admin",
      description:
        "Administration: users table, a form from the users schema, role stats.",
      device: "desktop",
      layout: { columns: 12, gap: "4", maxWidth: "1200px" },
      components: [
        nav("nav"),
        {
          id: "stats",
          name: "Grid",
          span: 12,
          props: { columns: 3 },
          children: [
            {
              id: "active-users",
              name: "Stat",
              span: 4,
              props: {
                label: "Active users",
                filter: "active=true",
                trend: "up",
                delta: "of all users",
              },
              bindings: [{ table: "users", fields: ["active"] }],
            },
            {
              id: "roles-count",
              name: "Stat",
              span: 4,
              props: { label: "Roles" },
              bindings: [{ table: "roles" }],
            },
            {
              id: "pages-count",
              name: "Stat",
              span: 4,
              variant: "primary",
              props: { label: "Published pages", filter: "published=true" },
              bindings: [{ table: "pages", fields: ["published"] }],
            },
          ],
        },
        {
          id: "users",
          name: "Table",
          span: 8,
          props: { caption: "Users" },
          bindings: [
            {
              table: "users",
              fields: [
                "avatar",
                "name",
                "email",
                "role_id",
                "active",
                "joined",
              ],
            },
          ],
        },
        {
          id: "new-user",
          name: "Form",
          span: 4,
          props: { title: "New user", submitLabel: "Add user" },
          bindings: [
            {
              table: "users",
              fields: ["name", "email", "role_id", "active"],
              mode: "write",
            },
          ],
        },
        {
          id: "tabs",
          name: "Tabs",
          span: 12,
          props: {
            items: [
              {
                label: "Roles",
                content:
                  '<ul class="ds-list ds-list--plain" data-source="roles" data-order="-level"><li class="ds-list__item"><div class="ds-list__body"><strong data-field="name"></strong><small data-field="description"></small></div></li></ul>',
              },
              {
                label: "Pages",
                content:
                  '<ul class="ds-list ds-list--plain" data-source="pages"><li class="ds-list__item"><div class="ds-list__body"><strong data-field="title"></strong><small data-field="path"></small></div></li></ul>',
              },
            ],
          },
          bindings: [
            { table: "roles", fields: ["name", "description", "level"] },
            { table: "pages", fields: ["title", "path"] },
          ],
        },
      ],
      links: [{ to: "home", label: "Home", from: "nav" }],
      bindings: [{ table: "roles", fields: ["name", "level"], mode: "read" }],
    }),
  };
}
