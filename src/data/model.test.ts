import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import {
  describeStep,
  diffSchema,
  isDestructive,
  migrateRows,
} from "./migrate";
import {
  compareValues,
  matchesFilter,
  parseFilter,
  parseSort,
  queryRows,
} from "./query";
import {
  displayValue,
  isImageValue,
  parseRows,
  parseSchema,
  referencesTo,
  serializeSchema,
  tableFromPath,
  type DataSchema,
} from "./schema";
import {
  applyDefaults,
  coerceValue,
  findReferrers,
  nextId,
  validateRow,
} from "./validate";

const schema: DataSchema = parseSchema(
  JSON.stringify({
    tables: [
      {
        name: "roles",
        columns: [
          { name: "id", type: "number", required: true, unique: true },
          { name: "name", type: "string", required: true, unique: true },
          { name: "level", type: "number", default: 1 },
        ],
      },
      {
        name: "users",
        display: "email",
        columns: [
          { name: "id", type: "number" },
          { name: "email", type: "string", required: true, unique: true },
          { name: "role_id", type: "ref", ref: "roles", required: true },
          { name: "active", type: "boolean", default: true },
          { name: "joined", type: "date" },
          { name: "prefs", type: "json" },
          { name: "avatar", type: "image" },
        ],
      },
    ],
  })
).schema;

const roles = [
  { id: 1, name: "Admin", level: 3 },
  { id: 2, name: "Editor", level: 2 },
];
const users = [
  { id: 1, email: "a@x.io", role_id: 1, active: true },
  { id: 2, email: "b@x.io", role_id: 2, active: false, joined: "2026-01-02" },
];
const lookup = (t: string) =>
  t === "roles" ? roles : t === "users" ? users : undefined;
const T = (name: string) => schema.tables.find((t) => t.name === name)!;

describe("schema", () => {
  it("parses, repairs and reports", () => {
    const { schema: s, errors } = parseSchema(
      JSON.stringify({
        tables: {
          posts: {
            columns: [
              "title",
              { name: "author", type: "ref" },
              { name: "n", type: "int" },
            ],
          },
          "bad name": {},
        },
      })
    );
    expect(s.tables.map((t) => t.name)).toEqual(["posts"]);
    expect(s.tables[0].columns.map((c) => `${c.name}:${c.type}`)).toEqual([
      "id:number",
      "title:string",
      "author:ref",
      "n:number",
    ]);
    expect(errors.join("\n")).toMatch(/author: ref column needs/);
    expect(errors.join("\n")).toMatch(/invalid table name "bad name"/);
    expect(parseSchema("{oops").errors[0]).toMatch(/not valid JSON/);
    expect(parseSchema("[]").errors[0]).toMatch(/tables/);
    expect(
      parseSchema(
        '{"tables":[{"name":"a","columns":[{"name":"b","type":"ref","ref":"zzz"}]}]}'
      ).errors[0]
    ).toMatch(/unknown table "zzz"/);
  });

  it("round-trips and offers helpers", () => {
    expect(parseSchema(serializeSchema(schema)).schema).toEqual(schema);
    expect(tableFromPath("data/users.json")).toBe("users");
    expect(tableFromPath("data/schema.json")).toBeNull();
    expect(tableFromPath("src/users.json")).toBeNull();
    expect(displayValue(T("users"), users[0])).toBe("a@x.io");
    expect(displayValue(T("roles"), roles[1])).toBe("Editor");
    expect(isImageValue(T("users").columns[6], "x")).toBe(true);
    expect(isImageValue(undefined, "https://a/b.png?x=1")).toBe(true);
    expect(isImageValue(undefined, "data:image/svg+xml,<svg/>")).toBe(true);
    expect(isImageValue(undefined, "hello")).toBe(false);
    expect(
      referencesTo(schema, "roles").map(
        (r) => `${r.table.name}.${r.column.name}`
      )
    ).toEqual(["users.role_id"]);
    expect(parseRows('[1, {"id": 1}]').rows).toEqual([{ id: 1 }]);
    expect(parseRows('{"rows": [{"id": 2}]}').rows).toEqual([{ id: 2 }]);
    expect(parseRows("nope").error).toBeTruthy();
  });
});

describe("validation", () => {
  it("coerces text input by column type", () => {
    const u = T("users");
    const col = (n: string) => u.columns.find((c) => c.name === n)!;
    expect(coerceValue(col("id"), "12")).toBe(12);
    expect(coerceValue(col("id"), "abc")).toBe("abc");
    expect(coerceValue(col("id"), "")).toBeNull();
    expect(coerceValue(col("active"), "yes")).toBe(true);
    expect(coerceValue(col("active"), "0")).toBe(false);
    expect(coerceValue(col("prefs"), '{"a":1}')).toEqual({ a: 1 });
    expect(coerceValue(col("prefs"), "{bad")).toBe("{bad");
    expect(coerceValue(col("role_id"), "2", schema)).toBe(2);
    expect(coerceValue(col("email"), 5)).toBe("5");
  });

  it("checks required, types, unique and refs", () => {
    const errs = (
      row: Record<string, unknown>,
      opts?: { partial?: boolean; excludeId?: number }
    ) =>
      validateRow(schema, T("users"), row, lookup, opts).map(
        (e) => `${e.column}:${e.message}`
      );
    expect(errs({ id: 3, email: "c@x.io", role_id: 2 })).toEqual([]);
    expect(errs({ id: 3, role_id: 2 })).toEqual(["email:is required"]);
    expect(
      errs({
        id: 3,
        email: "a@x.io",
        role_id: 9,
        active: "no",
        joined: "yesterday",
        bogus: 1,
      })
    ).toEqual([
      'bogus:unknown column "bogus"',
      'email:must be unique ("a@x.io" is already used)',
      'role_id:no roles row with id "9"',
      "active:must be true or false",
      "joined:must be a date (ISO 8601, e.g. 2026-09-16)",
    ]);
    expect(
      errs({ id: 1, email: "a@x.io" }, { partial: true, excludeId: 1 })
    ).toEqual([]);
    expect(
      errs({ email: "a@x.io" }, { partial: true, excludeId: 2 })
    ).toHaveLength(1);
    expect(errs({ email: null }, { partial: true })).toEqual([
      "email:is required",
    ]);
  });

  it("applies defaults, generates ids and finds referrers", () => {
    expect(applyDefaults(T("users"), { email: "x" })).toEqual({
      email: "x",
      active: true,
    });
    expect(nextId(T("users"), users)).toBe(3);
    expect(nextId(T("users"), [])).toBe(1);
    const strTable = parseSchema(
      '{"tables":[{"name":"t","primaryKey":"key","columns":[{"name":"key","type":"string"}]}]}'
    ).schema.tables[0];
    expect(String(nextId(strTable, []))).toMatch(/^t_[a-z0-9]+$/);
    expect(findReferrers(schema, "roles", 2, lookup)).toEqual([
      { table: "users", column: "role_id", count: 1 },
    ]);
    expect(findReferrers(schema, "roles", 9, lookup)).toEqual([]);
  });
});

describe("query", () => {
  const rows = [
    { id: 1, name: "Home", sort: 2, parent_id: null, ok: true },
    { id: 2, name: "About us", sort: 1, parent_id: 1, ok: false },
    { id: 3, name: "Blog", sort: 3, parent_id: 1, ok: true, tags: ["a", "b"] },
  ];

  it("parses the filter grammar", () => {
    expect(
      parseFilter('name:home sort>=2 parent_id=null "two words" ok!=false')
    ).toEqual([
      { column: "name", op: ":", value: "home" },
      { column: "sort", op: ">=", value: "2" },
      { column: "parent_id", op: "=", value: "null" },
      { column: null, op: "~", value: "two words" },
      { column: "ok", op: "!=", value: "false" },
    ]);
  });

  it("matches rows", () => {
    expect(
      rows.filter((r) => matchesFilter(r, "home")).map((r) => r.id)
    ).toEqual([1]);
    expect(
      rows.filter((r) => matchesFilter(r, "parent_id=1")).map((r) => r.id)
    ).toEqual([2, 3]);
    expect(
      rows.filter((r) => matchesFilter(r, "parent_id=null")).map((r) => r.id)
    ).toEqual([1]);
    expect(
      rows.filter((r) => matchesFilter(r, "sort>1 ok=true")).map((r) => r.id)
    ).toEqual([1, 3]);
    expect(
      rows.filter((r) => matchesFilter(r, "name!=Home")).map((r) => r.id)
    ).toEqual([2, 3]);
    expect(
      rows.filter((r) => matchesFilter(r, "tags:b")).map((r) => r.id)
    ).toEqual([3]);
    expect(rows.filter((r) => matchesFilter(r, "  ")).length).toBe(3);
  });

  it("sorts, paginates and slices", () => {
    expect(parseSort("-sort")).toEqual({ column: "sort", dir: "desc" });
    expect(parseSort("name desc")).toEqual({ column: "name", dir: "desc" });
    expect(queryRows(rows, { sort: "sort" }).rows.map((r) => r.id)).toEqual([
      2, 1, 3,
    ]);
    expect(queryRows(rows, { sort: "-name" }).rows.map((r) => r.id)).toEqual([
      1, 3, 2,
    ]);
    expect(
      queryRows(rows, { sort: "parent_id" }).rows.map((r) => r.id)
    ).toEqual([2, 3, 1]);
    const p = queryRows(rows, { pageSize: 2, page: 2 });
    expect(p).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(p.rows.map((r) => r.id)).toEqual([3]);
    expect(queryRows(rows, { pageSize: 2, page: 9 }).page).toBe(2);
    expect(
      queryRows(rows, { offset: 1, limit: 1 }).rows.map((r) => r.id)
    ).toEqual([2]);
    expect(
      queryRows(rows, { where: { parent_id: 1, ok: true } }).rows.map(
        (r) => r.id
      )
    ).toEqual([3]);
    expect(compareValues("a10", "a9")).toBeGreaterThan(0);
    expect(compareValues(null, 1)).toBe(1);
  });
});

describe("csv", () => {
  it("round-trips with quotes, commas and newlines", () => {
    const rows = [
      { id: 1, name: 'He said "hi", twice', note: "line1\nline2", tags: ["a"] },
      { id: 2, name: "", note: null },
    ];
    const csv = toCsv(rows, ["id", "name", "note", "tags"]);
    expect(csv.split("\n")[0]).toBe("id,name,note,tags");
    const back = parseCsv(csv);
    expect(back.headers).toEqual(["id", "name", "note", "tags"]);
    expect(back.rows[0]).toEqual({
      id: "1",
      name: 'He said "hi", twice',
      note: "line1\nline2",
      tags: '["a"]',
    });
    expect(back.rows[1]).toEqual({ id: "2", name: "", note: "", tags: "" });
    expect(parseCsv("﻿a,b\r\n1,2\r\n").rows).toEqual([{ a: "1", b: "2" }]);
  });
});

describe("migration", () => {
  it("diffs schemas including renames", () => {
    const next: DataSchema = JSON.parse(JSON.stringify(schema));
    const u = next.tables[1];
    u.name = "people";
    u.columns.find((c) => c.name === "active")!.name = "enabled";
    u.columns = u.columns.filter((c) => c.name !== "prefs");
    u.columns.push({ name: "nick", type: "string", default: "-" });
    u.columns.find((c) => c.name === "id")!.type = "string";
    next.tables.push({
      name: "posts",
      primaryKey: "id",
      columns: [{ name: "id", type: "number" }],
    });
    next.tables = next.tables.filter((t) => t.name !== "roles");
    const steps = diffSchema(schema, next, {
      tables: { users: "people" },
      columns: { users: { active: "enabled" } },
    });
    expect(steps.map((s) => s.kind)).toEqual([
      "dropTable",
      "renameTable",
      "changeType",
      "renameColumn",
      "dropColumn",
      "addColumn",
      "addTable",
    ]);
    expect(isDestructive(steps)).toBe(true);
    expect(steps.map(describeStep).join("\n")).toContain(
      "Rename column people.active to enabled"
    );
    expect(isDestructive(diffSchema(schema, schema))).toBe(false);
    expect(diffSchema(schema, schema)).toEqual([]);
  });

  it("migrates rows", () => {
    const before = T("users");
    const after = {
      ...before,
      columns: [
        { name: "id", type: "string" as const },
        { name: "email", type: "string" as const },
        { name: "enabled", type: "boolean" as const },
        { name: "nick", type: "string" as const, default: "-" },
      ],
    };
    const out = migrateRows(before, after, users, { active: "enabled" });
    expect(out).toEqual([
      { id: "1", email: "a@x.io", enabled: true, nick: "-" },
      { id: "2", email: "b@x.io", enabled: false, nick: "-" },
    ]);
  });
});
