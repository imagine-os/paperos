/**
 * Schema changes as a plan of steps, and the row migration each step needs.
 * The Schema window shows the plan before writing; the DataStore applies it.
 */
import { coerceValue } from "./validate";
import {
  getColumn,
  getTable,
  type DataSchema,
  type Row,
  type Table,
} from "./schema";

export type MigrationStep =
  | { kind: "addTable"; table: string }
  | { kind: "dropTable"; table: string }
  | { kind: "renameTable"; table: string; to: string }
  | { kind: "addColumn"; table: string; column: string; default?: unknown }
  | { kind: "dropColumn"; table: string; column: string }
  | { kind: "renameColumn"; table: string; column: string; to: string }
  | {
      kind: "changeType";
      table: string;
      column: string;
      from: string;
      to: string;
    }
  | { kind: "changeMeta"; table: string; column: string };

/** Explicit renames the schema form knows about (old name -> new name). */
export interface Renames {
  tables?: Record<string, string>;
  columns?: Record<string, Record<string, string>>;
}

export function diffSchema(
  before: DataSchema,
  after: DataSchema,
  renames: Renames = {}
): MigrationStep[] {
  const steps: MigrationStep[] = [];
  const tableRenames = renames.tables ?? {};
  const renamedTo = new Set(Object.values(tableRenames));

  for (const old of before.tables) {
    const newName = tableRenames[old.name] ?? old.name;
    const next = getTable(after, newName);
    if (!next) {
      steps.push({ kind: "dropTable", table: old.name });
      continue;
    }
    if (newName !== old.name)
      steps.push({ kind: "renameTable", table: old.name, to: newName });
    const colRenames = renames.columns?.[old.name] ?? {};
    const colRenamedTo = new Set(Object.values(colRenames));
    for (const oc of old.columns) {
      const nn = colRenames[oc.name] ?? oc.name;
      const nc = getColumn(next, nn);
      if (!nc) {
        steps.push({ kind: "dropColumn", table: newName, column: oc.name });
        continue;
      }
      if (nn !== oc.name)
        steps.push({
          kind: "renameColumn",
          table: newName,
          column: oc.name,
          to: nn,
        });
      if (nc.type !== oc.type)
        steps.push({
          kind: "changeType",
          table: newName,
          column: nn,
          from: oc.type,
          to: nc.type,
        });
      else if (
        nc.ref !== oc.ref ||
        !!nc.required !== !!oc.required ||
        !!nc.unique !== !!oc.unique ||
        JSON.stringify(nc.default) !== JSON.stringify(oc.default)
      )
        steps.push({ kind: "changeMeta", table: newName, column: nn });
    }
    for (const nc of next.columns) {
      const existed = old.columns.some(
        (oc) => (colRenames[oc.name] ?? oc.name) === nc.name
      );
      if (!existed && !colRenamedTo.has(nc.name))
        steps.push({
          kind: "addColumn",
          table: newName,
          column: nc.name,
          default: nc.default,
        });
    }
  }
  for (const t of after.tables) {
    const existed = before.tables.some(
      (old) => (tableRenames[old.name] ?? old.name) === t.name
    );
    if (!existed && !renamedTo.has(t.name))
      steps.push({ kind: "addTable", table: t.name });
  }
  return steps;
}

export function describeStep(step: MigrationStep): string {
  switch (step.kind) {
    case "addTable":
      return `Create table ${step.table} (new empty data/${step.table}.json)`;
    case "dropTable":
      return `Delete table ${step.table} and its rows (data/${step.table}.json)`;
    case "renameTable":
      return `Rename table ${step.table} to ${step.to} (moves data/${step.table}.json)`;
    case "addColumn":
      return `Add column ${step.table}.${step.column}${
        step.default !== undefined
          ? ` with default ${JSON.stringify(step.default)}`
          : " (empty in existing rows)"
      }`;
    case "dropColumn":
      return `Remove column ${step.table}.${step.column} from every row`;
    case "renameColumn":
      return `Rename column ${step.table}.${step.column} to ${step.to} in every row`;
    case "changeType":
      return `Change ${step.table}.${step.column} from ${step.from} to ${step.to} (values are converted where possible)`;
    case "changeMeta":
      return `Update constraints of ${step.table}.${step.column}`;
  }
}

/** True when the plan touches rows (needs a confirm), not just constraints. */
export function isDestructive(steps: MigrationStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "dropTable" ||
      s.kind === "dropColumn" ||
      s.kind === "changeType"
  );
}

/**
 * Migrates one table's rows from `before` to `after`: renames columns,
 * drops the removed ones, adds new ones with their default and converts
 * values whose type changed.
 */
export function migrateRows(
  before: Table,
  after: Table,
  rows: Row[],
  columnRenames: Record<string, string> = {},
  schema?: DataSchema
): Row[] {
  return rows.map((row) => {
    const out: Row = {};
    for (const nc of after.columns) {
      const oldName =
        Object.entries(columnRenames).find(([, to]) => to === nc.name)?.[0] ??
        nc.name;
      const oc = getColumn(before, oldName);
      const has = Object.prototype.hasOwnProperty.call(row, oldName);
      if (!oc || !has) {
        if (nc.default !== undefined) out[nc.name] = nc.default;
        continue;
      }
      const v = row[oldName];
      out[nc.name] = oc.type === nc.type ? v : convert(v, nc, schema);
    }
    return out;
  });
}

function convert(
  v: unknown,
  to: Table["columns"][number],
  schema?: DataSchema
): unknown {
  if (v === undefined || v === null) return v;
  const c = coerceValue(
    to,
    typeof v === "object" && to.type !== "json" ? JSON.stringify(v) : v,
    schema
  );
  return c;
}
