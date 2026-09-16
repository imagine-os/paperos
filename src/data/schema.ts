/**
 * The data model a project carries as files.
 *
 * `data/schema.json` describes tables and columns; `data/<table>.json` holds
 * an array of rows, each with the table's primary key (`id` by default).
 * Everything here is pure: parsing, serializing and small lookups. The
 * `DataStore` (store.ts) reads and writes the files.
 */

export const SCHEMA_PATH = "data/schema.json";

export const COLUMN_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "json",
  "ref",
  "image",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

export interface Column {
  name: string;
  type: ColumnType;
  required?: boolean;
  unique?: boolean;
  /** Value new rows get when the column is left out. */
  default?: unknown;
  /** For `ref` columns: the table whose primary key this column holds. */
  ref?: string;
  description?: string;
}

export interface Table {
  name: string;
  /** Column that identifies a row (default `id`). */
  primaryKey: string;
  /** Column shown when another table refers to a row (default: name/title/label, else the key). */
  display?: string;
  description?: string;
  columns: Column[];
}

export interface DataSchema {
  tables: Table[];
}

export type RowId = string | number;
export type Row = Record<string, unknown>;

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidName(name: unknown): name is string {
  return typeof name === "string" && NAME_RE.test(name);
}

export function tablePath(table: string): string {
  return `data/${table}.json`;
}

/** `data/users.json` -> `users`; null for the schema file and anything else. */
export function tableFromPath(path: string): string | null {
  const m = /^data\/([A-Za-z_][A-Za-z0-9_]*)\.json$/.exec(path);
  return m && path !== SCHEMA_PATH ? m[1] : null;
}

export function isDataPath(path: string): boolean {
  return path === SCHEMA_PATH || tableFromPath(path) !== null;
}

export function emptySchema(): DataSchema {
  return { tables: [] };
}

export function newTable(name: string): Table {
  return {
    name,
    primaryKey: "id",
    columns: [{ name: "id", type: "number", required: true, unique: true }],
  };
}

export function getTable(schema: DataSchema, name: string): Table | undefined {
  return schema.tables.find((t) => t.name === name);
}

export function getColumn(table: Table, name: string): Column | undefined {
  return table.columns.find((c) => c.name === name);
}

/** The column whose value stands for a row (in ref cells, menus, graphs). */
export function displayColumn(table: Table): string {
  if (table.display && getColumn(table, table.display)) return table.display;
  for (const guess of ["name", "title", "label", "email"])
    if (getColumn(table, guess)) return guess;
  return table.primaryKey;
}

export function displayValue(
  table: Table,
  row: Row | null | undefined
): string {
  if (!row) return "";
  const v = row[displayColumn(table)];
  if (v === undefined || v === null) return String(row[table.primaryKey] ?? "");
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)(\?.*)?$/i;

/** True when a cell should render as a thumbnail. */
export function isImageValue(
  column: Column | undefined,
  value: unknown
): boolean {
  if (typeof value !== "string" || !value) return false;
  if (column?.type === "image") return true;
  return /^data:image\//i.test(value) || IMAGE_RE.test(value);
}

function normalizeColumn(
  raw: unknown,
  errors: string[],
  where: string
): Column | null {
  if (typeof raw === "string") raw = { name: raw, type: "string" };
  if (typeof raw !== "object" || raw === null) {
    errors.push(`${where}: column must be an object`);
    return null;
  }
  const c = raw as Record<string, unknown>;
  if (!isValidName(c.name)) {
    errors.push(`${where}: invalid column name ${JSON.stringify(c.name)}`);
    return null;
  }
  let type = typeof c.type === "string" ? (c.type as string) : "string";
  if (type === "text") type = "string";
  if (type === "int" || type === "integer" || type === "float") type = "number";
  if (type === "bool") type = "boolean";
  if (type === "object" || type === "array") type = "json";
  if (!(COLUMN_TYPES as readonly string[]).includes(type)) {
    errors.push(`${where}.${c.name}: unknown type "${type}"`);
    type = "string";
  }
  const col: Column = { name: c.name, type: type as ColumnType };
  if (c.required === true) col.required = true;
  if (c.unique === true) col.unique = true;
  if (c.default !== undefined) col.default = c.default;
  if (typeof c.ref === "string") col.ref = c.ref;
  if (typeof c.description === "string") col.description = c.description;
  if (col.type === "ref" && !col.ref)
    errors.push(`${where}.${c.name}: ref column needs "ref": "<table>"`);
  return col;
}

function normalizeTable(
  raw: unknown,
  errors: string[],
  index: number
): Table | null {
  if (typeof raw !== "object" || raw === null) {
    errors.push(`tables[${index}]: must be an object`);
    return null;
  }
  const t = raw as Record<string, unknown>;
  if (!isValidName(t.name)) {
    errors.push(
      `tables[${index}]: invalid table name ${JSON.stringify(t.name)}`
    );
    return null;
  }
  const where = `tables.${t.name}`;
  const primaryKey = isValidName(t.primaryKey) ? t.primaryKey : "id";
  const rawCols = Array.isArray(t.columns) ? t.columns : [];
  const columns: Column[] = [];
  for (const rc of rawCols) {
    const col = normalizeColumn(rc, errors, where);
    if (!col) continue;
    if (columns.some((c) => c.name === col.name)) {
      errors.push(`${where}: duplicate column "${col.name}"`);
      continue;
    }
    columns.push(col);
  }
  if (!columns.some((c) => c.name === primaryKey)) {
    columns.unshift({
      name: primaryKey,
      type: "number",
      required: true,
      unique: true,
    });
  }
  const table: Table = { name: t.name, primaryKey, columns };
  if (typeof t.display === "string") table.display = t.display;
  if (typeof t.description === "string") table.description = t.description;
  return table;
}

/**
 * Parses `data/schema.json`. Tolerant: what can be repaired is repaired
 * (missing types, a missing primary-key column) and everything else is
 * reported in `errors` while the rest of the schema still loads. Accepts
 * `{tables: [...]}` or `{tables: {name: {...}}}`.
 */
export function parseSchema(text: string): {
  schema: DataSchema;
  errors: string[];
} {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      schema: emptySchema(),
      errors: [
        `schema.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }
  if (typeof raw !== "object" || raw === null) {
    return {
      schema: emptySchema(),
      errors: ["schema.json must be an object with a tables list"],
    };
  }
  const r = raw as Record<string, unknown>;
  let list: unknown[] = [];
  if (Array.isArray(r.tables)) list = r.tables;
  else if (typeof r.tables === "object" && r.tables !== null) {
    list = Object.entries(r.tables as Record<string, unknown>).map(
      ([name, t]) =>
        typeof t === "object" && t !== null
          ? { name, ...(t as object) }
          : { name }
    );
  } else errors.push('schema.json has no "tables" list');

  const tables: Table[] = [];
  list.forEach((rt, i) => {
    const t = normalizeTable(rt, errors, i);
    if (!t) return;
    if (tables.some((x) => x.name === t.name)) {
      errors.push(`duplicate table "${t.name}"`);
      return;
    }
    tables.push(t);
  });
  for (const t of tables) {
    for (const c of t.columns) {
      if (c.type === "ref" && c.ref && !tables.some((x) => x.name === c.ref))
        errors.push(
          `tables.${t.name}.${c.name}: refers to unknown table "${c.ref}"`
        );
    }
    if (t.display && !getColumn(t, t.display))
      errors.push(
        `tables.${t.name}: display column "${t.display}" does not exist`
      );
  }
  return { schema: { tables }, errors };
}

export function serializeSchema(schema: DataSchema): string {
  return JSON.stringify(schema, null, 2) + "\n";
}

export function serializeRows(rows: Row[]): string {
  return JSON.stringify(rows, null, 2) + "\n";
}

/** Parses `data/<table>.json`: an array of objects (anything else counts as empty). */
export function parseRows(text: string): { rows: Row[]; error: string | null } {
  try {
    const raw = JSON.parse(text);
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as Row).rows)
        ? ((raw as Row).rows as unknown[])
        : null;
    if (!list) return { rows: [], error: "expected an array of rows" };
    return {
      rows: list.filter(
        (r): r is Row =>
          typeof r === "object" && r !== null && !Array.isArray(r)
      ),
      error: null,
    };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Columns of `table` that point at `target` (plus the columns of other tables pointing at it). */
export function referencesTo(
  schema: DataSchema,
  target: string
): { table: Table; column: Column }[] {
  const out: { table: Table; column: Column }[] = [];
  for (const table of schema.tables)
    for (const column of table.columns)
      if (column.type === "ref" && column.ref === target)
        out.push({ table, column });
  return out;
}
