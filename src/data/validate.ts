/**
 * Row validation against the schema: types, required, unique and
 * references. Pure functions; the DataStore calls them before writing.
 */
import {
  getColumn,
  getTable,
  type Column,
  type DataSchema,
  type Row,
  type RowId,
  type Table,
} from "./schema";

export interface ValidationError {
  column: string | null;
  message: string;
}

export type RowLookup = (table: string) => Row[] | undefined;

export function sameId(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  return String(a) === String(b);
}

export function isRowId(v: unknown): v is RowId {
  return (
    (typeof v === "string" && v.length > 0) ||
    (typeof v === "number" && Number.isFinite(v))
  );
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "";

/**
 * Turns a raw value (usually text typed into the grid or a CSV cell) into
 * the column's type where that is unambiguous. Values that cannot be
 * converted are returned as they came so validation can report them.
 */
export function coerceValue(
  column: Column,
  raw: unknown,
  schema?: DataSchema
): unknown {
  if (raw === undefined) return undefined;
  if (
    typeof raw === "string" &&
    column.type !== "string" &&
    column.type !== "image" &&
    raw.trim() === ""
  )
    return null;
  if (raw === null) return null;
  switch (column.type) {
    case "number": {
      if (typeof raw === "number") return raw;
      if (
        typeof raw === "string" &&
        raw.trim() !== "" &&
        Number.isFinite(Number(raw))
      )
        return Number(raw);
      return raw;
    }
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (["true", "yes", "1", "on"].includes(s)) return true;
        if (["false", "no", "0", "off"].includes(s)) return false;
      }
      if (typeof raw === "number") return raw !== 0;
      return raw;
    }
    case "json": {
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }
    case "ref": {
      const target =
        schema && column.ref ? getTable(schema, column.ref) : undefined;
      const pk = target ? getColumn(target, target.primaryKey) : undefined;
      if (
        pk?.type === "number" &&
        typeof raw === "string" &&
        raw.trim() !== "" &&
        Number.isFinite(Number(raw))
      )
        return Number(raw);
      return raw;
    }
    case "date":
    case "string":
    case "image":
    default:
      return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
  }
}

/** Null when `value` fits the column's type; else what is wrong. */
export function typeError(column: Column, value: unknown): string | null {
  if (isBlank(value)) return null;
  switch (column.type) {
    case "string":
    case "image":
      return typeof value === "string" ? null : "must be a string";
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : "must be a number";
    case "boolean":
      return typeof value === "boolean" ? null : "must be true or false";
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : "must be a date (ISO 8601, e.g. 2026-09-16)";
    case "ref":
      return isRowId(value) ? null : "must be the id of a row";
    case "json":
      return null;
  }
}

/**
 * Validates a row (or, with `partial`, a patch) for `table`. `lookup` gives
 * the rows of any table for unique and reference checks; `excludeId` is the
 * row being updated so it does not collide with itself.
 */
export function validateRow(
  schema: DataSchema,
  table: Table,
  row: Row,
  lookup: RowLookup,
  options: { partial?: boolean; excludeId?: RowId } = {}
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const key of Object.keys(row)) {
    if (!getColumn(table, key))
      errors.push({ column: key, message: `unknown column "${key}"` });
  }
  const own = lookup(table.name) ?? [];
  for (const column of table.columns) {
    const has = Object.prototype.hasOwnProperty.call(row, column.name);
    const value = row[column.name];
    if (!has && options.partial) continue;
    if (isBlank(value)) {
      if (column.required)
        errors.push({ column: column.name, message: "is required" });
      continue;
    }
    const te = typeError(column, value);
    if (te) {
      errors.push({ column: column.name, message: te });
      continue;
    }
    if (column.unique || column.name === table.primaryKey) {
      const clash = own.find(
        (r) =>
          sameId(r[column.name], value) &&
          !(
            options.excludeId !== undefined &&
            sameId(r[table.primaryKey], options.excludeId)
          )
      );
      if (clash)
        errors.push({
          column: column.name,
          message: `must be unique ("${String(value)}" is already used)`,
        });
    }
    if (column.type === "ref" && column.ref) {
      const target = getTable(schema, column.ref);
      if (!target) {
        errors.push({
          column: column.name,
          message: `refers to unknown table "${column.ref}"`,
        });
        continue;
      }
      const rows = lookup(target.name);
      if (rows && !rows.some((r) => sameId(r[target.primaryKey], value)))
        errors.push({
          column: column.name,
          message: `no ${target.name} row with ${target.primaryKey} "${String(value)}"`,
        });
    }
  }
  return errors;
}

export function formatErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => (e.column ? `${e.column} ${e.message}` : e.message))
    .join("; ");
}

/** Fills in defaults for columns the row leaves out. */
export function applyDefaults(table: Table, row: Row): Row {
  const out: Row = { ...row };
  for (const c of table.columns) {
    if (out[c.name] === undefined && c.default !== undefined)
      out[c.name] =
        typeof c.default === "object" && c.default !== null
          ? JSON.parse(JSON.stringify(c.default))
          : c.default;
  }
  return out;
}

/** A fresh primary key: max + 1 for numeric keys, a short random id otherwise. */
export function nextId(table: Table, rows: Row[]): RowId {
  const pk = getColumn(table, table.primaryKey);
  if (!pk || pk.type === "number") {
    let max = 0;
    for (const r of rows) {
      const v = r[table.primaryKey];
      if (typeof v === "number" && v > max) max = v;
      else if (typeof v === "string" && /^\d+$/.test(v) && Number(v) > max)
        max = Number(v);
    }
    return max + 1;
  }
  let id: string;
  do {
    id = `${table.name.slice(0, 3)}_${Math.random().toString(36).slice(2, 8)}`;
  } while (rows.some((r) => sameId(r[table.primaryKey], id)));
  return id;
}

/** Rows in other tables whose ref columns point at `id` of `target`. */
export function findReferrers(
  schema: DataSchema,
  target: string,
  id: RowId,
  lookup: RowLookup
): { table: string; column: string; count: number }[] {
  const out: { table: string; column: string; count: number }[] = [];
  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (column.type !== "ref" || column.ref !== target) continue;
      const count = (lookup(table.name) ?? []).filter((r) =>
        sameId(r[column.name], id)
      ).length;
      if (count) out.push({ table: table.name, column: column.name, count });
    }
  }
  return out;
}
