import { describe, expect, it } from "vitest";
import { queryRows } from "./query";
import { dataRuntime, dataRuntimeScript, type RuntimePayload } from "./runtime";

/* A very small DOM: enough for the runtime's hydration (attributes, children, querySelectorAll). */
class El {
  attrs = new Map<string, string>();
  children: El[] = [];
  parentElement: El | null = null;
  text = "";
  html: string | null = null;
  [key: string]: unknown;
  constructor(public tagName: string) {}
  getAttribute(n: string) {
    return this.attrs.has(n) ? this.attrs.get(n)! : null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  get firstElementChild() {
    return this.children[0] ?? null;
  }
  appendChild(c: El) {
    c.parentElement = this;
    this.children.push(c);
    return c;
  }
  set textContent(v: string) {
    this.text = v;
    this.html = null;
    for (const c of this.children) c.parentElement = null;
    this.children = [];
  }
  get textContent(): string {
    return this.children.length
      ? this.children.map((c) => c.textContent).join("")
      : this.text;
  }
  set innerHTML(v: string) {
    this.html = v;
    this.children = [];
  }
  get innerHTML(): string {
    return this.html ?? this.textContent;
  }
  cloneNode(deep: boolean): El {
    const c = new El(this.tagName);
    c.attrs = new Map(this.attrs);
    c.text = this.text;
    c.html = this.html;
    if (deep) for (const ch of this.children) c.appendChild(ch.cloneNode(true));
    return c;
  }
  querySelectorAll(selector: string): El[] {
    const attr = /^\[([a-z-]+)\]$/.exec(selector)![1];
    const out: El[] = [];
    const walk = (e: El) => {
      for (const c of e.children) {
        if (c.attrs.has(attr)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  /** Test helper: a compact rendering. */
  toString(): string {
    const a = [...this.attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
    const inner =
      this.html !== null
        ? this.html
        : this.children.length
          ? this.children.map(String).join("")
          : this.text;
    return `<${this.tagName}${a}>${inner}</${this.tagName}>`;
  }
}

function el(
  tag: string,
  attrs: Record<string, string> = {},
  children: El[] = [],
  text = ""
): El {
  const e = new El(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.appendChild(c);
  e.text = text;
  return e;
}

const payload: RuntimePayload = {
  schema: {
    tables: [
      {
        name: "roles",
        primaryKey: "id",
        columns: [
          { name: "id", type: "number" },
          { name: "name", type: "string" },
          { name: "level", type: "number" },
        ],
      },
      {
        name: "menu_items",
        primaryKey: "id",
        display: "label",
        columns: [
          { name: "id", type: "number" },
          { name: "label", type: "string" },
          { name: "parent_id", type: "ref", ref: "menu_items" },
          { name: "category", type: "string" },
          { name: "icon", type: "string" },
          { name: "thumb", type: "image" },
          { name: "href", type: "string" },
          { name: "required_role", type: "ref", ref: "roles" },
          { name: "sort", type: "number" },
        ],
      },
    ],
  },
  tables: {
    roles: [
      { id: 1, name: "Admin", level: 3 },
      { id: 2, name: "Viewer", level: 1 },
    ],
    menu_items: [
      {
        id: 1,
        label: "Home",
        parent_id: null,
        category: "Main",
        icon: "home",
        thumb: "a.svg",
        href: "/",
        required_role: 2,
        sort: 1,
      },
      {
        id: 2,
        label: "Admin",
        parent_id: null,
        category: "Tools",
        icon: "cog",
        thumb: "b.svg",
        href: "/admin",
        required_role: 1,
        sort: 3,
      },
      {
        id: 3,
        label: "Users",
        parent_id: 2,
        category: "Tools",
        icon: "users",
        thumb: "c.svg",
        href: "/admin/users",
        required_role: 1,
        sort: 1,
      },
      {
        id: 4,
        label: "Docs",
        parent_id: null,
        category: "Main",
        icon: "book",
        thumb: "d.svg",
        href: "/docs",
        required_role: 2,
        sort: 2,
      },
    ],
  },
};

function makeWindow(body: El) {
  const listeners: Record<string, (() => void)[]> = {};
  const document = {
    readyState: "complete",
    querySelectorAll: (s: string) => body.querySelectorAll(s),
    addEventListener: (n: string, f: () => void) =>
      (listeners[n] ??= []).push(f),
  };
  return { win: { document } as unknown as Record<string, unknown>, listeners };
}

describe("paperos.data runtime API", () => {
  it("exposes tables with list/get/find/count/display", () => {
    const { win } = makeWindow(el("body"));
    const api = dataRuntime(win, payload);
    expect((win.paperos as { data: unknown }).data).toBe(api);
    expect(api.tables()).toEqual(["roles", "menu_items"]);
    expect(
      api.menu_items
        .list({ where: { parent_id: null }, orderBy: "sort" })
        .map((r: { label: string }) => r.label)
    ).toEqual(["Home", "Docs", "Admin"]);
    expect(
      api.menu_items.list({
        filter: "category=Tools",
        orderBy: "-sort",
        limit: 1,
      })[0].label
    ).toBe("Admin");
    expect(api.roles.get("2").name).toBe("Viewer");
    expect(api.roles.get(9)).toBeNull();
    expect(api.menu_items.find({ label: "Docs" }).id).toBe(4);
    expect(api.menu_items.count({ filter: "required_role=1" })).toBe(2);
    expect(api.roles.display(1)).toBe("Admin");
    expect(api.menu_items.display(api.menu_items.get(3))).toBe("Users");
    expect(api.table("roles").all()).toHaveLength(2);
    // Copies, not the embedded rows.
    api.roles.all()[0].name = "changed";
    expect(api.roles.get(1).name).toBe("Admin");
  });

  it("agrees with query.ts on the filter grammar", () => {
    const { win } = makeWindow(el("body"));
    const api = dataRuntime(win, payload);
    const rows = payload.tables.menu_items;
    for (const filter of [
      "home",
      "parent_id=null",
      "sort>1 category=Main",
      "label:s",
      "required_role!=1",
      'label="Admin"',
    ]) {
      expect(
        api.menu_items.list({ filter }).map((r: { id: number }) => r.id),
        filter
      ).toEqual(queryRows(rows, { filter }).rows.map((r) => r.id));
    }
    for (const sort of ["sort", "-label", "category desc"]) {
      expect(
        api.menu_items.list({ orderBy: sort }).map((r: { id: number }) => r.id),
        sort
      ).toEqual(queryRows(rows, { sort }).rows.map((r) => r.id));
    }
  });
});

describe("data-source hydration", () => {
  const menu = () =>
    el(
      "ul",
      {
        "data-source": "menu_items",
        "data-filter": "parent_id=null",
        "data-order": "sort",
      },
      [
        el("li", {}, [
          el("a", { "data-field": "href" }, [], ""),
          el("span", { "data-field": "label" }),
          el("img", { "data-field": "thumb" }),
          el("i", { "data-field": "icon", "data-as": "icon" }),
          el("em", { "data-field": "required_role", "data-display": "" }),
          el(
            "ul",
            { "data-source": "menu_items", "data-filter": "parent_id={id}" },
            [el("li", { "data-field": "label" })]
          ),
        ]),
      ]
    );

  it("repeats the template per row, fills fields by tag and nests lists", () => {
    const list = menu();
    const body = el("body", {}, [list]);
    const { win } = makeWindow(body);
    const api = dataRuntime(win, payload);
    api.icons = {
      home: "<svg id=home/>",
      cog: "<svg id=cog/>",
      book: "<svg id=book/>",
    };
    expect(api.hydrate()).toBe(1);
    expect(list.children.map((c) => c.getAttribute("data-id"))).toEqual([
      "1",
      "4",
      "2",
    ]);
    const first = list.children[0];
    expect(first.children[0].getAttribute("href")).toBe("/");
    expect(first.children[1].textContent).toBe("Home");
    expect(first.children[2].getAttribute("src")).toBe("a.svg");
    expect(first.children[3].innerHTML).toBe("<svg id=home/>");
    expect(first.children[4].textContent).toBe("Viewer");
    // Nested list under Admin holds Users.
    const admin = list.children[2];
    expect(admin.children[5].children.map((c) => c.textContent)).toEqual([
      "Users",
    ]);
    expect(admin.children[5].children[0].getAttribute("data-id")).toBe("3");
    expect(first.children[5].children).toEqual([]);
  });

  it("re-hydrates from the stored template with a visibility filter and context", () => {
    const list = menu();
    const body = el("body", {}, [list]);
    const { win } = makeWindow(body);
    const api = dataRuntime(win, payload);
    api.hydrate();
    expect(list.children).toHaveLength(3);
    api.hydrate(undefined, {
      visible: (table: string, row: { required_role: number }) =>
        table !== "menu_items" || row.required_role !== 1,
    });
    expect(list.children.map((c) => c.children[1].textContent)).toEqual([
      "Home",
      "Docs",
    ]);
    // Nested children are filtered too (Users needs role 1).
    api.hydrate(undefined, { visible: () => true });
    expect(list.children).toHaveLength(3);

    const ctxList = el(
      "ul",
      {
        "data-source": "menu_items",
        "data-filter": "category=@cat",
        "data-empty": "Nothing here",
      },
      [el("li", { "data-field": "label" })]
    );
    body.appendChild(ctxList);
    api.setContext({ cat: "Tools" });
    expect(ctxList.children.map((c) => c.textContent)).toEqual([
      "Admin",
      "Users",
    ]);
    api.setContext({ cat: "Nope" });
    expect(ctxList.textContent).toBe("Nothing here");
  });

  it("groups rows with data-group and fills $group", () => {
    const mega = el(
      "div",
      {
        "data-source": "menu_items",
        "data-group": "category",
        "data-order": "sort",
      },
      [
        el("section", {}, [
          el("h3", { "data-field": "$group" }),
          el(
            "ul",
            {
              "data-source": "menu_items",
              "data-filter": "category={$group}",
              "data-order": "label",
            },
            [el("li", { "data-field": "label" })]
          ),
        ]),
      ]
    );
    const body = el("body", {}, [mega]);
    const { win } = makeWindow(body);
    dataRuntime(win, payload).hydrate();
    expect(mega.children.map((s) => s.children[0].textContent)).toEqual([
      "Main",
      "Tools",
    ]);
    expect(
      mega.children[1].children[1].children.map((c) => c.textContent)
    ).toEqual(["Admin", "Users"]);
  });

  it("hydrates automatically at load unless disabled, and uses data-attr", () => {
    const list = el("ul", { "data-source": "roles" }, [
      el("li", { "data-field": "name", "data-attr": "title" }),
    ]);
    const body = el("body", {}, [list]);
    const { win, listeners } = makeWindow(body);
    (win.document as { readyState: string }).readyState = "loading";
    const api = dataRuntime(win, payload);
    expect(list.children).toHaveLength(1);
    api.autoHydrate = false;
    listeners.DOMContentLoaded[0]();
    expect(list.children).toHaveLength(1);
    api.autoHydrate = true;
    listeners.DOMContentLoaded[0]();
    expect(list.children.map((c) => c.getAttribute("title"))).toEqual([
      "Admin",
      "Viewer",
    ]);
  });
});

describe("dataRuntimeScript", () => {
  it("embeds the runtime and the payload safely", () => {
    const script = dataRuntimeScript({
      schema: { tables: [] },
      tables: { t: [{ html: "</script><b>" }] },
    });
    expect(script.startsWith("(function dataRuntime(")).toBe(true);
    expect(script).not.toContain("</script>");
    expect(script).toContain("<\\/script>");
    expect(script.endsWith(");")).toBe(true);
  });
});
