import { describe, expect, it } from "vitest";
import { parseComponent, parseComponents, defaultProps } from "./components";
import { designCore, designRuntimeScript, type RenderPayload } from "./render";
import { STARTER_COMPONENTS, starterDesignFiles } from "./starter";

const schema: RenderPayload["schema"] = {
  tables: [
    {
      name: "users",
      primaryKey: "id",
      display: "name",
      columns: [
        { name: "id", type: "number" },
        { name: "name", type: "string" },
        { name: "email", type: "string" },
        { name: "avatar", type: "image" },
        { name: "role_id", type: "ref", ref: "roles" },
        { name: "active", type: "boolean" },
      ],
    },
    {
      name: "roles",
      primaryKey: "id",
      columns: [
        { name: "id", type: "number" },
        { name: "name", type: "string" },
      ],
    },
  ],
};

const core = () =>
  designCore({
    components: STARTER_COMPONENTS,
    schema,
    routes: { "/": "home" },
  });

describe("template language", () => {
  const t = (src: string, scope: Record<string, unknown>) =>
    core().template(src, scope);

  it("substitutes, escapes and leaves raw HTML alone", () => {
    expect(t("<b>{title}</b>", { title: "<i>x</i> & y" })).toBe(
      "<b>&lt;i&gt;x&lt;/i&gt; &amp; y</b>"
    );
    expect(t("{@body}", { body: "<i>x</i>" })).toBe("<i>x</i>");
    expect(t("{missing}|{nested.a}", { nested: { a: 1 } })).toBe("|1");
    expect(t("{n|json}", { n: { a: 1 } })).toBe("{&quot;a&quot;:1}");
  });

  it("keeps CSS braces, JSON and {{literals}}", () => {
    expect(t("a { color: red } b", {})).toBe("a { color: red } b");
    expect(t('data-filter="parent_id={{id}}"', { id: 9 })).toBe(
      'data-filter="parent_id={id}"'
    );
    expect(t("{{$group}}", {})).toBe("{$group}");
  });

  it("repeats with each (items, index, first/last, scalars)", () => {
    expect(
      t(
        "{#each items}<li{#if @first} class=a{/if}>{@index}:{label}</li>{/each}",
        {
          items: [{ label: "x" }, { label: "y" }],
        }
      )
    ).toBe("<li class=a>0:x</li><li>1:y</li>");
    expect(t("{#each list}[{.}]{/each}", { list: ["a", "b"] })).toBe("[a][b]");
    expect(t("{#each none}x{/each}", {})).toBe("");
    // Outer scope stays visible inside.
    expect(t("{#each items}{.}{sep}{/each}", { items: [1, 2], sep: "," })).toBe(
      "1,2,"
    );
  });

  it("branches with if / else, negation and nesting", () => {
    expect(t("{#if a}yes{:else}no{/if}", { a: true })).toBe("yes");
    expect(t("{#if a}yes{:else}no{/if}", { a: "" })).toBe("no");
    expect(t("{#if !a}not{/if}", { a: 0 })).toBe("not");
    expect(
      t("{#if a}[{#if b}both{:else}a{/if}]{:else}none{/if}", { a: 1, b: 0 })
    ).toBe("[a]");
    expect(t("{#if list}has{/if}", { list: [] })).toBe("");
  });
});

describe("component rendering", () => {
  it("merges defaults, variants and instance props", () => {
    const c = core();
    expect(c.render("Badge")).toBe(
      '<span class="ds-badge ds-badge--default">New</span>'
    );
    expect(c.render("Badge", { text: "Hi" }, undefined, "danger")).toBe(
      '<span class="ds-badge ds-badge--danger">Hi</span>'
    );
    expect(c.render("Button", { href: "#/x", variant: "outline" })).toContain(
      '<a class="ds-button ds-button--outline ds-button--md" href="#/x">Button</a>'
    );
    // A prop left at its default (the gallery passes every default) does not undo the variant.
    const badge = STARTER_COMPONENTS.find((d) => d.name === "Badge")!;
    expect(
      c.render("Badge", defaultProps(badge), undefined, "danger")
    ).toContain("ds-badge--danger");
    expect(
      c.render("Badge", defaultProps(badge), undefined, "danger")
    ).toContain("Blocked");
    // An explicit non-default value still wins over the variant.
    expect(
      c.render(
        "Badge",
        { ...defaultProps(badge), text: "Mine" },
        undefined,
        "danger"
      )
    ).toContain(">Mine<");
    expect(c.render("Nope")).toContain("Unknown component: Nope");
    expect(c.has("Card")).toBe(true);
  });

  it("puts children and slots into the template", () => {
    const html = core().render(
      "Card",
      { title: "T", footer: "<b>f</b>" },
      "<p>child</p>"
    );
    expect(html).toContain("<p>child</p>");
    expect(html).toContain('<footer class="ds-card__footer"><b>f</b></footer>');
    expect(html).not.toContain("ds-card__image");
  });

  it("derives table columns from the schema for data-bound components", () => {
    const c = core();
    const props = c.resolveProps("Table", { table: "users" });
    expect(props.fields).toEqual([
      "id",
      "name",
      "email",
      "avatar",
      "role_id",
      "active",
    ]);
    const columns = props.columns as {
      name: string;
      isRef: boolean;
      refDisplay?: string;
    }[];
    expect(columns.find((x) => x.name === "role_id")).toMatchObject({
      isRef: true,
      refDisplay: "name",
    });
    const html = c.render("Table", {
      table: "users",
      fields: ["name", "role_id", "avatar"],
    });
    expect(html).toContain('<tbody data-source="users"');
    expect(html).toContain("<th>Name</th><th>Role id</th><th>Avatar</th>");
    expect(html).toContain('<td data-field="role_id" data-display></td>');
    expect(html).toContain('<img class="ds-table__thumb" data-field="avatar"');
    // The form skips the key and makes typed inputs and ref selects.
    const form = c.render("Form", { table: "users" });
    expect(form).not.toContain('name="id"');
    expect(form).toContain(
      '<select class="ds-select" name="role_id" data-source="roles"'
    );
    expect(form).toContain('<input type="checkbox" name="active"');
    expect(form).toContain('type="url" name="avatar"');
  });

  it("fills field props with the display column and keeps literal braces for the runtime", () => {
    const nav = core().render("Nav", { table: "users" });
    expect(nav).toContain('data-field="name"');
    expect(nav).toContain('data-filter="parent_id={id}"');
    const mega = core().render("MegaMenu", {
      table: "users",
      groupBy: "role_id",
    });
    expect(mega).toContain('data-filter="role_id={$group} parent_id=null"');
  });

  it("every starter component renders with its defaults and variants without leftovers", () => {
    const c = core();
    for (const def of STARTER_COMPONENTS) {
      const variants = [undefined, ...def.variants.map((v) => v.name)];
      for (const v of variants) {
        const html = c.render(
          def.name,
          defaultProps(def),
          "<span>child</span>",
          v
        );
        // `{id}` and `{$group}` are the data runtime's own placeholders.
        const leftovers = html.replace(/\{(id|\$group)\}/g, "");
        expect(leftovers, `${def.name}/${v}`).not.toMatch(/\{[#/:@]?[a-zA-Z]/);
        expect(html, `${def.name}/${v}`).not.toContain("Unknown component");
      }
    }
  });
});

describe("component files", () => {
  it("parses the starter files back into the same definitions", () => {
    const files = Object.entries(starterDesignFiles())
      .filter(([p]) => p.startsWith("design/components/"))
      .map(([path, text]) => ({ path, text }));
    const { components, errors } = parseComponents(files);
    expect(errors).toEqual([]);
    expect(components.map((c) => c.name).sort()).toEqual(
      STARTER_COMPONENTS.map((c) => c.name).sort()
    );
    expect(components.find((c) => c.name === "Table")).toEqual(
      STARTER_COMPONENTS.find((c) => c.name === "Table")
    );
  });

  it("repairs what it can and reports the rest", () => {
    const r = parseComponent(
      JSON.stringify({
        props: [{ name: "x", type: "weird" }, { name: "1bad" }],
        template: "<i>{x}</i>",
        variants: [{ name: "v", props: { x: 1 } }, "junk"],
      }),
      "design/components/Thing.json"
    );
    expect(r.component?.name).toBe("Thing");
    expect(r.component?.props).toEqual([{ name: "x", type: "string" }]);
    expect(r.component?.variants).toEqual([{ name: "v", props: { x: 1 } }]);
    expect(r.errors).toEqual([
      'design/components/Thing.json.x: unknown prop type "weird"',
      'design/components/Thing.json: invalid prop name "1bad"',
    ]);
    expect(parseComponent("{", "a.json").component).toBeNull();
    expect(parseComponent(JSON.stringify({ template: "" })).errors[0]).toMatch(
      /name/
    );
    // Shorthand props.
    expect(
      parseComponent(
        JSON.stringify({ name: "S", template: "", props: { n: 1, on: true } })
      ).component?.props
    ).toEqual([
      { name: "n", type: "number", default: 1 },
      { name: "on", type: "boolean", default: true },
    ]);
  });
});

describe("runtime script", () => {
  it("is self-contained: evaluates in a bare window and exposes paperos.design", () => {
    const script = designRuntimeScript({
      components: STARTER_COMPONENTS,
      schema,
    });
    const win: Record<string, unknown> = {};
    new Function("window", script)(win);
    const design = (
      win.paperos as {
        design: { render(n: string): string; components(): string[] };
      }
    ).design;
    expect(design.components()).toContain("Card");
    expect(design.render("Badge")).toContain("ds-badge");
  });
});
