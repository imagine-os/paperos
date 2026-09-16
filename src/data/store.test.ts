import { describe, expect, it } from "vitest";
import { DataError, DataStore, memoryDataFs } from "./store";
import { SCHEMA_PATH } from "./schema";

const files = () => ({
  [SCHEMA_PATH]: JSON.stringify({
    tables: [
      {
        name: "roles",
        columns: [
          { name: "id", type: "number" },
          { name: "name", type: "string", required: true, unique: true },
        ],
      },
      {
        name: "menu_items",
        display: "label",
        columns: [
          { name: "id", type: "number" },
          { name: "label", type: "string", required: true },
          { name: "parent_id", type: "ref", ref: "menu_items" },
          { name: "required_role", type: "ref", ref: "roles" },
          { name: "sort", type: "number", default: 0 },
          { name: "meta", type: "json" },
        ],
      },
    ],
  }),
  "data/roles.json": JSON.stringify([
    { id: 1, name: "Admin" },
    { id: 2, name: "Viewer" },
  ]),
  "data/menu_items.json": JSON.stringify([
    { id: 1, label: "Home", parent_id: null, required_role: 2, sort: 1 },
    { id: 2, label: "Admin", parent_id: null, required_role: 1, sort: 2 },
    { id: 3, label: "Users", parent_id: 2, required_role: 1, sort: 1 },
  ]),
});

function setup(extra: Record<string, string> = {}) {
  const fs = memoryDataFs({ ...files(), ...extra });
  const store = new DataStore(fs);
  return { fs, store };
}

const wait = () => new Promise((r) => setTimeout(r, 80));

describe("DataStore", () => {
  it("lists tables with counts and queries rows", async () => {
    const { store } = setup();
    const tables = await store.tables();
    expect(tables.map((t) => [t.name, t.rowCount])).toEqual([
      ["roles", 2],
      ["menu_items", 3],
    ]);
    expect(tables[1].path).toBe("data/menu_items.json");
    const q = await store.query("menu_items", {
      filter: "parent_id=null",
      sort: "-sort",
    });
    expect(q.rows.map((r) => r.label)).toEqual(["Admin", "Home"]);
    expect((await store.get("roles", "2"))?.name).toBe("Viewer");
    await expect(store.query("nope")).rejects.toThrow(/No table "nope"/);
  });

  it("inserts with defaults and generated ids, validating refs", async () => {
    const { store, fs } = setup();
    const row = await store.insert("menu_items", {
      label: "Blog",
      parent_id: "1",
      required_role: 2,
    });
    expect(row).toEqual({
      id: 4,
      label: "Blog",
      parent_id: 1,
      required_role: 2,
      sort: 0,
    });
    expect(JSON.parse(fs.files.get("data/menu_items.json")!)).toHaveLength(4);
    await expect(
      store.insert("menu_items", { label: "X", required_role: 9 })
    ).rejects.toThrow(/no roles row with id "9"/);
    await expect(store.insert("menu_items", { sort: 1 })).rejects.toThrow(
      /label is required/
    );
    await expect(store.insert("roles", { id: 1, name: "Dup" })).rejects.toThrow(
      /id must be unique/
    );
    try {
      await store.insert("roles", { name: "Admin" });
    } catch (e) {
      expect(e).toBeInstanceOf(DataError);
      expect((e as DataError).errors[0]).toMatchObject({ column: "name" });
    }
  });

  it("updates with coercion and partial validation", async () => {
    const { store } = setup();
    const row = await store.update("menu_items", 3, {
      label: "People",
      sort: "5",
      meta: '{"icon":"users"}',
    });
    expect(row).toEqual({
      id: 3,
      label: "People",
      parent_id: 2,
      required_role: 1,
      sort: 5,
      meta: { icon: "users" },
    });
    await expect(
      store.update("menu_items", 99, { label: "x" })
    ).rejects.toThrow(/No menu_items row/);
    await expect(
      store.update("menu_items", 3, { sort: "abc" })
    ).rejects.toThrow(/sort must be a number/);
    await expect(store.update("roles", 2, { name: "Admin" })).rejects.toThrow(
      /unique/
    );
    expect((await store.update("roles", 2, { name: "Viewer" })).name).toBe(
      "Viewer"
    );
  });

  it("blocks, nullifies or cascades deletes of referenced rows", async () => {
    const { store } = setup();
    await expect(store.remove("roles", 1)).rejects.toThrow(
      /referenced by 2 menu_items.required_role/
    );
    const r = await store.remove("roles", 1, { onReferences: "nullify" });
    expect(r.deleted).toBe(true);
    expect(
      (await store.rows("menu_items")).map((m) => m.required_role)
    ).toEqual([2, null, null]);
    expect(await store.remove("roles", 1)).toEqual({
      deleted: false,
      affected: [],
    });

    const c = await store.remove("menu_items", 2, { onReferences: "cascade" });
    expect(c.affected).toEqual([
      { table: "menu_items", column: "parent_id", count: 1 },
    ]);
    expect((await store.rows("menu_items")).map((m) => m.id)).toEqual([1]);
  });

  it("imports and exports CSV and JSON", async () => {
    const { store } = setup();
    const csv = await store.exportRows("roles", "csv");
    expect(csv).toBe("id,name\n1,Admin\n2,Viewer\n");
    expect(await store.importRows("roles", "name\nEditor\n", "csv")).toEqual({
      count: 1,
    });
    expect((await store.rows("roles")).at(-1)).toEqual({
      id: 3,
      name: "Editor",
    });
    await expect(store.importRows("roles", "nope\n1\n", "csv")).rejects.toThrow(
      /Unknown column in CSV: nope/
    );
    await store.importRows(
      "roles",
      JSON.stringify([{ id: 7, name: "Owner" }]),
      "json",
      "replace"
    );
    expect(await store.rows("roles")).toEqual([{ id: 7, name: "Owner" }]);
    await expect(store.importRows("roles", "[1", "json")).rejects.toThrow(
      /Cannot import/
    );
    await expect(
      store.replaceRows("roles", [
        { id: 1, name: "A" },
        { id: 1, name: "B" },
      ])
    ).rejects.toThrow(/Duplicate id/);
    expect(JSON.parse(await store.exportRows("roles", "json"))).toEqual([
      { id: 7, name: "Owner" },
    ]);
  });

  it("plans and applies schema changes with row migration", async () => {
    const { store, fs } = setup();
    const schema = await store.schema();
    const next = JSON.parse(JSON.stringify(schema)) as typeof schema;
    const menu = next.tables[1];
    menu.columns.push({ name: "icon", type: "string", default: "dot" });
    menu.columns = menu.columns.filter((c) => c.name !== "meta");
    menu.columns.find((c) => c.name === "label")!.name = "title";
    next.tables.push({
      name: "pages",
      primaryKey: "id",
      columns: [{ name: "id", type: "number" }],
    });
    const renames = { columns: { menu_items: { label: "title" } } };
    const plan = await store.planSchema(next, renames);
    expect(plan.map((s) => s.kind)).toEqual([
      "renameColumn",
      "dropColumn",
      "addColumn",
      "addTable",
    ]);
    expect(fs.files.has("data/pages.json")).toBe(false);

    const changes = store.changed.get();
    await store.setSchema(next, renames);
    expect(store.changed.get()).toBeGreaterThan(changes);
    expect(fs.files.get("data/pages.json")).toBe("[]\n");
    const rows = await store.rows("menu_items");
    expect(rows[0]).toEqual({
      id: 1,
      title: "Home",
      parent_id: null,
      required_role: 2,
      sort: 1,
      icon: "dot",
    });
    expect(
      (await store.table("menu_items")).columns.map((c) => c.name)
    ).toContain("title");

    // Rename + drop tables.
    const again = JSON.parse(
      JSON.stringify(await store.schema())
    ) as typeof schema;
    again.tables = again.tables.filter((t) => t.name !== "pages");
    again.tables[0].name = "groups";
    again.tables[1].columns.find((c) => c.name === "required_role")!.ref =
      "groups";
    await store.setSchema(again, { tables: { roles: "groups" } });
    expect(fs.files.has("data/roles.json")).toBe(false);
    expect(fs.files.has("data/pages.json")).toBe(false);
    expect(JSON.parse(fs.files.get("data/groups.json")!)).toHaveLength(2);
    expect((await store.tables()).map((t) => t.name)).toEqual([
      "groups",
      "menu_items",
    ]);
  });

  it("creates a schema on demand and works with no data folder", async () => {
    const fs = memoryDataFs({ "index.html": "<p>hi</p>" });
    const store = new DataStore(fs);
    expect(await store.hasSchema()).toBe(false);
    expect(await store.tables()).toEqual([]);
    await store.ensureSchema();
    expect(fs.files.get(SCHEMA_PATH)).toBe('{\n  "tables": []\n}\n');
    expect(await store.schemaErrors()).toEqual([]);
  });

  it("notices external edits to the files and reports parse errors", async () => {
    const { store, fs } = setup();
    await store.tables();
    const before = store.changed.get();
    fs.files.set("data/roles.json", JSON.stringify([{ id: 1, name: "Root" }]));
    fs.emit();
    await wait();
    expect(store.changed.get()).toBe(before + 1);
    expect((await store.rows("roles"))[0].name).toBe("Root");
    // Unchanged content does not bump.
    fs.emit();
    await wait();
    expect(store.changed.get()).toBe(before + 1);

    fs.files.set("data/roles.json", "[{");
    fs.emit();
    await wait();
    expect(await store.rows("roles")).toEqual([]);
    expect(await store.rowsError("roles")).toBeTruthy();
    fs.files.set(SCHEMA_PATH, "{bad");
    fs.emit();
    await wait();
    expect((await store.schemaErrors())[0]).toMatch(/not valid JSON/);
    store.dispose();
  });
});
