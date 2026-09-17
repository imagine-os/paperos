import { describe, expect, it } from "vitest";
import { layoutBoard, overlaps } from "@/boards/layout";
import { parseBoard, validateBoard } from "@/boards/model";
import { scanBindings } from "@/data/bindings";
import { matchesFilter } from "@/data/query";
import { parseSchema } from "@/data/schema";
import { parseComponents } from "@/design/components";
import { parsePage, type PageBlock } from "@/design/pages";
import { buildLineage } from "@/lineage/model";
import {
  BUSINESS_TYPES,
  TENANTS,
  saasProjectFiles,
  saasSeed,
  showcaseBoard,
} from "./saas";

const files = saasProjectFiles();
const rowsOf = (table: string) =>
  JSON.parse(files[`data/${table}.json`]) as Record<string, unknown>[];

describe("Small Business SaaS template", () => {
  it("has a valid multi-tenant schema seeded for five businesses", () => {
    const { schema, errors } = parseSchema(files["data/schema.json"]);
    expect(errors).toEqual([]);
    const names = schema.tables.map((t) => t.name);
    for (const t of [
      "tenants",
      "users",
      "roles",
      "permissions",
      "menu_items",
      "customers",
      "bookings",
      "services",
      "invoices",
      "leads",
      "sequences",
      "touches",
      "posts",
      "campaigns",
      "assets",
    ])
      expect(names).toContain(t);
    const tenants = rowsOf("tenants");
    expect(tenants).toHaveLength(5);
    for (const t of tenants)
      expect(BUSINESS_TYPES).toContain(t.business_type as never);
    expect(new Set(tenants.map((t) => t.business_type)).size).toBe(5);
    // Every table exists as a file and every tenant-scoped table has rows for every tenant.
    for (const t of schema.tables) {
      expect(files[`data/${t.name}.json`], t.name).toBeDefined();
      const rows = rowsOf(t.name);
      expect(rows.length, t.name).toBeGreaterThan(0);
      const cols = new Set(t.columns.map((c) => c.name));
      for (const row of rows)
        for (const k of Object.keys(row))
          expect(cols.has(k), `${t.name}.${k}`).toBe(true);
      if (cols.has("tenant_id"))
        for (const tenant of TENANTS)
          expect(
            rows.some((r) => r.tenant_id === tenant.id),
            `${t.name} for tenant ${tenant.id}`
          ).toBe(true);
    }
    // References resolve.
    const byTable = new Map(schema.tables.map((t) => [t.name, rowsOf(t.name)]));
    for (const t of schema.tables)
      for (const c of t.columns)
        if (c.type === "ref" && c.ref)
          for (const row of byTable.get(t.name)!) {
            const v = row[c.name];
            if (v === null || v === undefined) continue;
            expect(
              byTable.get(c.ref)!.some((r) => r.id === v),
              `${t.name}.${c.name}=${String(v)} -> ${c.ref}`
            ).toBe(true);
          }
  });

  it("filters rows by tenant with the preview filter syntax", () => {
    const seed = saasSeed();
    const ctx = (tenant: number, filter: string) =>
      filter.replace(/@tenant/g, String(tenant));
    for (const tenant of TENANTS) {
      const mine = seed.bookings.filter((r) =>
        matchesFilter(r, ctx(tenant.id, "tenant_id=@tenant status=booked"))
      );
      expect(mine.length).toBeGreaterThan(0);
      for (const r of mine) expect(r.tenant_id).toBe(tenant.id);
      const others = seed.customers.filter(
        (r) => !matchesFilter(r, ctx(tenant.id, "tenant_id=@tenant"))
      );
      expect(others.length).toBe(seed.customers.length - 6);
    }
    // Menu rows carry the gates the runtime reads.
    for (const m of seed.menu_items) {
      expect("required_role" in m).toBe(true);
      expect("business_type" in m).toBe(true);
    }
    expect(
      seed.menu_items
        .filter((m) => m.business_type !== null)
        .map((m) => m.business_type)
        .sort()
    ).toEqual([...BUSINESS_TYPES].sort());
  });

  it("composes twenty pages in four apps, every one bound to tenant-scoped tables", () => {
    const pagePaths = Object.keys(files).filter((p) =>
      /^pages\/.+\.json$/.test(p)
    );
    expect(pagePaths).toHaveLength(20);
    const apps = {
      "apps/customer": 0,
      "apps/admin": 0,
      site: 0,
      "growth/social": 0,
      "growth/outreach": 0,
    };
    const walk = (blocks: PageBlock[], f: (b: PageBlock) => void) => {
      for (const b of blocks) {
        f(b);
        if (b.children) walk(b.children, f);
      }
    };
    for (const path of pagePaths) {
      const { page, errors } = parsePage(files[path], path);
      expect(errors, path).toEqual([]);
      expect(page).not.toBeNull();
      const app = Object.keys(apps).find((a) =>
        page!.name.startsWith(a)
      ) as keyof typeof apps;
      expect(app, page!.name).toBeDefined();
      apps[app]++;
      let bound = 0;
      walk(page!.components, (b) => {
        for (const binding of b.bindings ?? []) {
          bound++;
          // Tenant-scoped tables read with a tenant filter (writes go to the tenant through the form).
          if (
            binding.mode !== "write" &&
            !page!.name.startsWith("site/") &&
            !["tenants", "roles", "permissions", "menu_items"].includes(
              binding.table
            )
          )
            expect(binding.filter, `${path} ${b.id}`).toContain(
              "tenant_id=@tenant"
            );
        }
      });
      expect(bound, path).toBeGreaterThan(0);
    }
    expect(apps).toEqual({
      "apps/customer": 4,
      "apps/admin": 6,
      site: 2,
      "growth/social": 4,
      "growth/outreach": 4,
    });
    // The customer app is mobile-first with a fixed tab bar; the admin has the gated side menu.
    const home = parsePage(
      files["pages/apps/customer/home.json"],
      "pages/apps/customer/home.json"
    ).page!;
    expect(home.device).toBe("mobile");
    expect(home.padBottom).toBe(true);
    expect(home.components.at(-1)?.name).toBe("TabBar");
    const admin = parsePage(
      files["pages/apps/admin/team.json"],
      "pages/apps/admin/team.json"
    ).page!;
    expect(admin.components[0].name).toBe("Sidebar");
    expect(admin.components[0].children?.map((c) => c.name)).toEqual([
      "TenantSwitcher",
      "RoleSwitcher",
    ]);
    expect(JSON.stringify(admin)).toContain('"RoleGate"');
  });

  it("every page has data lineage: components bound to tables", () => {
    const schema = parseSchema(files["data/schema.json"]).schema;
    const list = Object.entries(files).map(([path, text]) => ({ path, text }));
    const graph = buildLineage({
      schema,
      bindings: scanBindings(list, schema),
      components: parseComponents(
        list.filter((f) => f.path.startsWith("design/components/"))
      ).components,
      pages: list
        .filter((f) => /^pages\/.+\.json$/.test(f.path))
        .map((f) => parsePage(f.text, f.path).page!),
    });
    expect(graph.pages).toHaveLength(20);
    for (const p of graph.pages) {
      expect(p.components.length, p.name).toBeGreaterThan(0);
      expect(p.tables.length, p.name).toBeGreaterThan(0);
    }
    // Every tenant-scoped table feeds at least one page.
    const fed = new Set(graph.edges.map((e) => e.from));
    for (const t of graph.tables) expect(fed.has(t.key), t.name).toBe(true);
  });

  it("ships a valid, overlap-free showcase board with a tour", () => {
    const board = showcaseBoard();
    expect(validateBoard(board)).toEqual([]);
    const reparsed = parseBoard(
      files["boards/showcase.json"],
      "boards/showcase.json"
    );
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.board?.sections.map((s) => s.id)).toEqual([
      "acquisition",
      "product",
      "growth",
      "data",
    ]);
    expect(reparsed.board?.steps).toHaveLength(4);
    const l = layoutBoard(board);
    for (const a of l.windows)
      for (const b of l.windows)
        if (a !== b) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
    // Pipeline arrows: lead -> customer -> booking -> invoice -> repeat / promo.
    const chain = [
      "t-leads",
      "t-customers",
      "t-bookings",
      "t-invoices",
      "t-posts",
    ];
    for (let i = 0; i < chain.length - 1; i++)
      expect(
        board.arrows.some((a) => a.from === chain[i] && a.to === chain[i + 1])
      ).toBe(true);
    // Every preview entry on the board is a page of the project.
    for (const w of board.sections.flatMap((s) => s.windows))
      if (w.kind === "preview")
        expect(
          files[String(w.content).split("?")[0]],
          String(w.content)
        ).toBeDefined();
  });
});
