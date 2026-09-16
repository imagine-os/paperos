/**
 * The DataStore: tables and rows over a project's files.
 *
 * It reads `data/schema.json` and `data/<table>.json`, validates writes
 * against the schema and writes the files back. In the browser the files
 * are the live Yjs documents (see `project-fs.ts`), so editors, the preview
 * and the Data windows all see the same content; in tests a memory fs does.
 */
import { signal } from "@/ide/signal";
import { parseCsv, toCsv } from "./csv";
import {
  diffSchema,
  migrateRows,
  type MigrationStep,
  type Renames,
} from "./migrate";
import { queryRows, type QueryOptions, type QueryResult } from "./query";
import {
  emptySchema,
  getColumn,
  getTable,
  parseRows,
  parseSchema,
  serializeRows,
  serializeSchema,
  tablePath,
  SCHEMA_PATH,
  type Column,
  type DataSchema,
  type Row,
  type RowId,
  type Table,
} from "./schema";
import {
  applyDefaults,
  coerceValue,
  findReferrers,
  formatErrors,
  nextId,
  sameId,
  validateRow,
  type ValidationError,
} from "./validate";

/** What the store needs from a project: text files and a change notification. */
export interface DataFs {
  list(): Promise<string[]>;
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Called after any file may have changed (the store re-reads and compares). */
  onChange(listener: () => void): () => void;
}

export interface TableInfo {
  name: string;
  primaryKey: string;
  display?: string;
  description?: string;
  columns: Column[];
  rowCount: number;
  /** The file holding the rows. */
  path: string;
}

export class DataError extends Error {
  constructor(
    message: string,
    readonly errors: ValidationError[] = []
  ) {
    super(message);
    this.name = "DataError";
  }
}

interface Cached<T> {
  text: string | null;
  value: T;
}

const REFRESH_DELAY_MS = 40;

export class DataStore {
  /** Bumps whenever the schema or any table's rows changed (from anywhere). */
  readonly changed = signal(0);
  private schemaCache: Cached<{ schema: DataSchema; errors: string[] }> | null =
    null;
  private rowCache = new Map<
    string,
    Cached<{ rows: Row[]; error: string | null }>
  >();
  private off: () => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing = 0;

  constructor(private readonly fs: DataFs) {
    this.off = fs.onChange(() => this.scheduleRefresh());
  }

  dispose(): void {
    this.off();
    if (this.timer) clearTimeout(this.timer);
  }

  // ----- reading -------------------------------------------------------------

  async hasSchema(): Promise<boolean> {
    return (await this.fs.read(SCHEMA_PATH)) !== null;
  }

  async schema(): Promise<DataSchema> {
    return (await this.loadSchema()).schema;
  }

  async schemaErrors(): Promise<string[]> {
    return (await this.loadSchema()).errors;
  }

  private async loadSchema() {
    const text = await this.fs.read(SCHEMA_PATH);
    if (this.schemaCache && this.schemaCache.text === text)
      return this.schemaCache.value;
    const value =
      text === null ? { schema: emptySchema(), errors: [] } : parseSchema(text);
    this.schemaCache = { text, value };
    return value;
  }

  async table(name: string): Promise<Table> {
    const schema = await this.schema();
    return (
      getTable(schema, name) ??
      fail(
        `No table "${name}". Tables: ${schema.tables.map((t) => t.name).join(", ") || "(none)"}`
      )
    );
  }

  async tables(): Promise<TableInfo[]> {
    const schema = await this.schema();
    return Promise.all(
      schema.tables.map(async (t) => ({
        name: t.name,
        primaryKey: t.primaryKey,
        display: t.display,
        description: t.description,
        columns: t.columns,
        rowCount: (await this.rows(t.name)).length,
        path: tablePath(t.name),
      }))
    );
  }

  /** All rows of a table (a missing or broken file counts as empty). */
  async rows(table: string): Promise<Row[]> {
    return (await this.loadRows(table)).rows;
  }

  /** The parse error of a table file, if any. */
  async rowsError(table: string): Promise<string | null> {
    return (await this.loadRows(table)).error;
  }

  private async loadRows(table: string) {
    const path = tablePath(table);
    const text = await this.fs.read(path);
    const hit = this.rowCache.get(table);
    if (hit && hit.text === text) return hit.value;
    const value = text === null ? { rows: [], error: null } : parseRows(text);
    this.rowCache.set(table, { text, value });
    return value;
  }

  async query(table: string, options: QueryOptions = {}): Promise<QueryResult> {
    await this.table(table);
    return queryRows(await this.rows(table), options);
  }

  async get(table: string, id: RowId): Promise<Row | null> {
    const t = await this.table(table);
    return (
      (await this.rows(table)).find((r) => sameId(r[t.primaryKey], id)) ?? null
    );
  }

  // ----- writing -------------------------------------------------------------

  private async lookupFor(schema: DataSchema) {
    const all = new Map<string, Row[]>();
    for (const t of schema.tables) all.set(t.name, await this.rows(t.name));
    return (name: string) => all.get(name);
  }

  private async writeRows(table: string, rows: Row[]): Promise<void> {
    this.writing++;
    try {
      await this.fs.write(tablePath(table), serializeRows(rows));
    } finally {
      this.writing--;
    }
    this.rowCache.set(table, {
      text: serializeRows(rows),
      value: { rows, error: null },
    });
    this.changed.update((n) => n + 1);
  }

  private coerceRow(schema: DataSchema, table: Table, row: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      const c = getColumn(table, k);
      out[k] = c ? coerceValue(c, v, schema) : v;
    }
    return out;
  }

  /** Inserts a row (generating the primary key when absent). Throws a DataError with details. */
  async insert(table: string, row: Row): Promise<Row> {
    const schema = await this.schema();
    const t = await this.table(table);
    const rows = await this.rows(table);
    let next = applyDefaults(t, this.coerceRow(schema, t, row));
    if (
      next[t.primaryKey] === undefined ||
      next[t.primaryKey] === null ||
      next[t.primaryKey] === ""
    )
      next = { ...next, [t.primaryKey]: nextId(t, rows) };
    const errors = validateRow(schema, t, next, await this.lookupFor(schema));
    if (errors.length)
      throw new DataError(
        `Cannot insert into ${table}: ${formatErrors(errors)}`,
        errors
      );
    await this.writeRows(table, [...rows, orderColumns(t, next)]);
    return next;
  }

  async update(table: string, id: RowId, patch: Row): Promise<Row> {
    const schema = await this.schema();
    const t = await this.table(table);
    const rows = await this.rows(table);
    const index = rows.findIndex((r) => sameId(r[t.primaryKey], id));
    if (index === -1)
      fail(`No ${table} row with ${t.primaryKey} "${String(id)}"`);
    const clean = this.coerceRow(schema, t, patch);
    const errors = validateRow(schema, t, clean, await this.lookupFor(schema), {
      partial: true,
      excludeId: id,
    });
    if (errors.length)
      throw new DataError(
        `Cannot update ${table}: ${formatErrors(errors)}`,
        errors
      );
    const merged = orderColumns(t, { ...rows[index], ...clean });
    const next = [...rows];
    next[index] = merged;
    await this.writeRows(table, next);
    return merged;
  }

  /**
   * Deletes a row. When other rows refer to it the call fails unless
   * `onReferences` is "nullify" (clear those refs) or "cascade" (delete them).
   */
  async remove(
    table: string,
    id: RowId,
    options: { onReferences?: "block" | "nullify" | "cascade" } = {}
  ): Promise<{
    deleted: boolean;
    affected: { table: string; column: string; count: number }[];
  }> {
    const schema = await this.schema();
    const t = await this.table(table);
    const rows = await this.rows(table);
    if (!rows.some((r) => sameId(r[t.primaryKey], id)))
      return { deleted: false, affected: [] };
    const lookup = await this.lookupFor(schema);
    const referrers = findReferrers(schema, table, id, lookup);
    const mode = options.onReferences ?? "block";
    if (referrers.length && mode === "block") {
      throw new DataError(
        `Cannot delete ${table} ${String(id)}: referenced by ${referrers
          .map((r) => `${r.count} ${r.table}.${r.column}`)
          .join(", ")}. Pass onReferences: "nullify" or "cascade".`
      );
    }
    for (const ref of referrers) {
      const other = getTable(schema, ref.table)!;
      const list = lookup(ref.table) ?? [];
      const next =
        mode === "cascade"
          ? list.filter((r) => !sameId(r[ref.column], id))
          : list.map((r) =>
              sameId(r[ref.column], id) ? { ...r, [ref.column]: null } : r
            );
      if (mode === "cascade" && ref.table === table) {
        // Self references (a tree): children go with the parent, recursively.
        const gone = new Set<string>([String(id)]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const r of list)
            if (
              !gone.has(String(r[other.primaryKey])) &&
              gone.has(String(r[ref.column]))
            ) {
              gone.add(String(r[other.primaryKey]));
              changed = true;
            }
        }
        await this.writeRows(
          table,
          list.filter((r) => !gone.has(String(r[other.primaryKey])))
        );
        return { deleted: true, affected: referrers };
      }
      await this.writeRows(ref.table, next);
    }
    const current = await this.rows(table);
    await this.writeRows(
      table,
      current.filter((r) => !sameId(r[t.primaryKey], id))
    );
    return { deleted: true, affected: referrers };
  }

  /** Replaces every row of a table (import). Validates each row first when `validate` (default). */
  async replaceRows(
    table: string,
    rows: Row[],
    options: { validate?: boolean } = {}
  ): Promise<void> {
    const schema = await this.schema();
    const t = await this.table(table);
    const clean = rows.map((r) =>
      applyDefaults(t, this.coerceRow(schema, t, r))
    );
    if (options.validate !== false) {
      const lookup = await this.lookupFor(schema);
      const withNew = (name: string) => (name === table ? [] : lookup(name));
      clean.forEach((r, i) => {
        const errors = validateRow(schema, t, r, withNew).filter(
          (e) =>
            !(
              e.column === t.primaryKey &&
              e.message.startsWith("must be unique")
            )
        );
        if (errors.length)
          throw new DataError(`Row ${i + 1}: ${formatErrors(errors)}`, errors);
      });
      const ids = new Set<string>();
      for (const r of clean) {
        const k = String(r[t.primaryKey]);
        if (ids.has(k)) throw new DataError(`Duplicate ${t.primaryKey} "${k}"`);
        ids.add(k);
      }
    }
    await this.writeRows(
      table,
      clean.map((r) => orderColumns(t, r))
    );
  }

  async exportRows(table: string, format: "json" | "csv"): Promise<string> {
    const t = await this.table(table);
    const rows = await this.rows(table);
    return format === "csv"
      ? toCsv(
          rows,
          t.columns.map((c) => c.name)
        )
      : serializeRows(rows);
  }

  async importRows(
    table: string,
    text: string,
    format: "json" | "csv",
    mode: "append" | "replace" = "append"
  ): Promise<{ count: number }> {
    const t = await this.table(table);
    let incoming: Row[];
    if (format === "csv") {
      const parsed = parseCsv(text);
      const unknown = parsed.headers.filter((h) => h && !getColumn(t, h));
      if (unknown.length)
        throw new DataError(
          `Unknown column${unknown.length > 1 ? "s" : ""} in CSV: ${unknown.join(", ")}`
        );
      incoming = parsed.rows.map((r) => {
        const row: Row = {};
        for (const [k, v] of Object.entries(r)) if (k) row[k] = v;
        return row;
      });
    } else {
      const parsed = parseRows(text);
      if (parsed.error) throw new DataError(`Cannot import: ${parsed.error}`);
      incoming = parsed.rows;
    }
    if (mode === "replace") {
      await this.replaceRows(table, incoming);
      return { count: incoming.length };
    }
    const existing = await this.rows(table);
    const schema = await this.schema();
    const lookup = await this.lookupFor(schema);
    const merged = [...existing];
    for (const [i, raw] of incoming.entries()) {
      let row = applyDefaults(t, this.coerceRow(schema, t, raw));
      if (
        row[t.primaryKey] === undefined ||
        row[t.primaryKey] === null ||
        row[t.primaryKey] === ""
      )
        row = { ...row, [t.primaryKey]: nextId(t, merged) };
      const errors = validateRow(schema, t, row, (name) =>
        name === table ? merged : lookup(name)
      );
      if (errors.length)
        throw new DataError(`Row ${i + 1}: ${formatErrors(errors)}`, errors);
      merged.push(orderColumns(t, row));
    }
    await this.writeRows(table, merged);
    return { count: incoming.length };
  }

  // ----- schema --------------------------------------------------------------

  /** The steps `setSchema` would take, without changing anything. */
  async planSchema(
    next: DataSchema,
    renames?: Renames
  ): Promise<MigrationStep[]> {
    return diffSchema(await this.schema(), normalize(next), renames);
  }

  /**
   * Writes a new schema and migrates the row files to match: new tables
   * get an empty file, dropped tables lose theirs, renamed tables move,
   * and rows gain, lose, rename or convert columns.
   */
  async setSchema(
    next: DataSchema,
    renames: Renames = {}
  ): Promise<MigrationStep[]> {
    const before = await this.schema();
    const after = normalize(next);
    const steps = diffSchema(before, after, renames);
    this.writing++;
    try {
      for (const step of steps) {
        if (step.kind === "dropTable") {
          if ((await this.fs.read(tablePath(step.table))) !== null)
            await this.fs.remove(tablePath(step.table));
          this.rowCache.delete(step.table);
        }
        if (step.kind === "renameTable") {
          if ((await this.fs.read(tablePath(step.table))) !== null)
            await this.fs.rename(tablePath(step.table), tablePath(step.to));
          this.rowCache.delete(step.table);
        }
      }
      for (const table of after.tables) {
        const oldName =
          Object.entries(renames.tables ?? {}).find(
            ([, to]) => to === table.name
          )?.[0] ?? table.name;
        const old = getTable(before, oldName);
        if (!old) {
          if ((await this.fs.read(tablePath(table.name))) === null)
            await this.fs.write(tablePath(table.name), serializeRows([]));
          continue;
        }
        const touched = steps.some(
          (s) =>
            "table" in s &&
            s.table === table.name &&
            s.kind !== "changeMeta" &&
            s.kind !== "renameTable"
        );
        if (!touched) continue;
        const rows = (await this.loadRows(table.name)).rows;
        const migrated = migrateRows(
          old,
          table,
          rows,
          renames.columns?.[oldName] ?? {},
          after
        );
        await this.fs.write(tablePath(table.name), serializeRows(migrated));
        this.rowCache.set(table.name, {
          text: serializeRows(migrated),
          value: { rows: migrated, error: null },
        });
      }
      await this.fs.write(SCHEMA_PATH, serializeSchema(after));
      this.schemaCache = {
        text: serializeSchema(after),
        value: { schema: after, errors: [] },
      };
    } finally {
      this.writing--;
    }
    this.changed.update((n) => n + 1);
    return steps;
  }

  /** Creates an empty `data/schema.json` when the project has none. */
  async ensureSchema(): Promise<void> {
    if (!(await this.hasSchema())) await this.setSchema(emptySchema());
  }

  // ----- change tracking -----------------------------------------------------

  private scheduleRefresh() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, REFRESH_DELAY_MS);
  }

  /** Re-reads the data files and bumps `changed` when any differs from the cache. */
  async refresh(): Promise<boolean> {
    if (this.writing) return false;
    let dirty = false;
    const schemaText = await this.fs.read(SCHEMA_PATH);
    if (!this.schemaCache || this.schemaCache.text !== schemaText) {
      dirty = true;
      await this.loadSchema();
    }
    const schema = (await this.loadSchema()).schema;
    for (const t of schema.tables) {
      const text = await this.fs.read(tablePath(t.name));
      const hit = this.rowCache.get(t.name);
      if (!hit || hit.text !== text) {
        dirty = true;
        await this.loadRows(t.name);
      }
    }
    if (dirty) this.changed.update((n) => n + 1);
    return dirty;
  }
}

/** Rows keep the schema's column order, unknown keys last. */
function orderColumns(table: Table, row: Row): Row {
  const out: Row = {};
  for (const c of table.columns)
    if (row[c.name] !== undefined) out[c.name] = row[c.name];
  for (const k of Object.keys(row))
    if (!(k in out) && row[k] !== undefined) out[k] = row[k];
  return out;
}

/** Runs a schema object through the parser so the same repairs apply. */
function normalize(schema: DataSchema): DataSchema {
  return parseSchema(JSON.stringify(schema)).schema;
}

function fail(message: string): never {
  throw new DataError(message);
}

/** A DataFs over a Map, for tests and the fake Canvas API host. */
export function memoryDataFs(initial: Record<string, string> = {}): DataFs & {
  files: Map<string, string>;
  emit(): void;
} {
  const files = new Map(Object.entries(initial));
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    files,
    emit,
    async list() {
      return [...files.keys()];
    },
    async read(path) {
      return files.get(path) ?? null;
    },
    async write(path, text) {
      files.set(path, text);
      emit();
    },
    async remove(path) {
      files.delete(path);
      emit();
    },
    async rename(from, to) {
      const t = files.get(from);
      if (t !== undefined) {
        files.delete(from);
        files.set(to, t);
        emit();
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
