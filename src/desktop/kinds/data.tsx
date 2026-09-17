"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import {
  displayValue,
  getTable,
  isImageValue,
  tablePath,
  type Column,
  type DataSchema,
  type Row,
  type RowId,
} from "@/data/schema";
import { DataError, type DataStore, type TableInfo } from "@/data/store";
import type { SortSpec } from "@/data/query";
import { openFile } from "@/ide/open-file";
import type { WindowKindProps } from "../window-kinds";
import { Dropdown, MenuItem } from "../menu";
import { EmptyState } from "./empty-state";
import {
  addFirstTable,
  downloadText,
  openConnectionsWindow,
  openSchemaWindow,
  parseContent,
  pickTextFile,
  useActiveData,
  useAsyncValue,
  type DataWindowContent,
} from "./data-common";

export const PAGE_SIZE = 50;

/** Data browser: the project's tables as an editable grid. `content` holds {table, filter}. */
export function DataWindow({ shape, editor, update }: WindowKindProps) {
  const { project, store, tick } = useActiveData();
  const content = parseContent<DataWindowContent>(shape.props.content);
  const tables = useAsyncValue(
    () => (store ? store.tables() : Promise.resolve([])),
    [store, tick],
    [] as TableInfo[]
  );
  const hasSchema = useAsyncValue(
    () => (store ? store.hasSchema() : Promise.resolve(false)),
    [store, tick],
    false
  );
  const schema = useAsyncValue(
    () => (store ? store.schema() : Promise.resolve({ tables: [] })),
    [store, tick],
    {
      tables: [],
    } as DataSchema
  );
  const schemaErrors = useAsyncValue(
    () => (store ? store.schemaErrors() : Promise.resolve([])),
    [store, tick],
    [] as string[]
  );

  const table =
    content.table && tables.value.some((t) => t.name === content.table)
      ? content.table
      : (tables.value[0]?.name ?? null);

  const select = (name: string, filter?: string) =>
    update({
      content: JSON.stringify({ table: name, ...(filter ? { filter } : {}) }),
      title: `Data: ${name}`,
    });

  useEffect(() => {
    if (table && shape.props.title === "Data")
      update({ title: `Data: ${table}` });
  }, [table, shape.props.title, update]);

  return (
    <div
      className="pos-data"
      data-testid="data-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      {!project && <div className="pos-files__hint">No project is open.</div>}
      {project && store && !hasSchema.loading && !hasSchema.value && (
        <div className="pos-files__hint pos-data__empty">
          <p>
            This project has no <code>data/schema.json</code> yet.
          </p>
          <button
            type="button"
            className="pos-button pos-button--primary"
            data-testid="data-create-schema"
            onClick={() =>
              void store.ensureSchema().then(() => openSchemaWindow(editor))
            }
          >
            Create a data model
          </button>
        </div>
      )}
      {project && store && hasSchema.value && (
        <div className="pos-data__body">
          <aside
            className="pos-data__tables"
            data-testid="data-tables"
            aria-label="Tables"
          >
            <div className="pos-data__heading">Tables</div>
            {tables.value.map((t) => (
              <button
                key={t.name}
                type="button"
                className={`pos-data__table${t.name === table ? " pos-data__table--active" : ""}`}
                data-testid={`data-table-${t.name}`}
                title={t.description ?? t.path}
                onClick={() => select(t.name)}
              >
                <span className="pos-data__table-name">{t.name}</span>
                <span className="pos-data__count">{t.rowCount}</span>
              </button>
            ))}
            {tables.value.length === 0 && !tables.loading && (
              <div className="pos-files__hint">No tables yet.</div>
            )}
            <button
              type="button"
              className="pos-button pos-button--small pos-data__schema-link"
              onClick={() => openSchemaWindow(editor, table ?? undefined)}
            >
              Schema...
            </button>
            {schemaErrors.value.length > 0 && (
              <div
                className="pos-data__schema-errors"
                title={schemaErrors.value.join("\n")}
              >
                {schemaErrors.value.length} schema problem
                {schemaErrors.value.length > 1 ? "s" : ""}
              </div>
            )}
          </aside>
          {!table && store && !tables.loading && (
            <EmptyState
              icon={"\u{1F5C3}"}
              title="No tables yet"
              testId="data-empty"
              actions={[
                {
                  label: "Add a table",
                  primary: true,
                  testId: "data-add-table",
                  onClick: async () => select(await addFirstTable(store)),
                },
                {
                  label: "Open Schema",
                  onClick: () => openSchemaWindow(editor),
                },
              ]}
            >
              <p>
                Tables are JSON files under <code>data/</code>. Start with an{" "}
                <code>items</code> table and shape it in Schema, or import a CSV
                once a table exists.
              </p>
            </EmptyState>
          )}
          {table && store && (
            <TableGrid
              key={`${project}:${table}`}
              store={store}
              schema={schema.value}
              table={table}
              initialFilter={content.filter ?? ""}
              tick={tick}
              onFollowRef={(t, id) =>
                select(
                  t,
                  `${getTable(schema.value, t)?.primaryKey ?? "id"}=${String(id)}`
                )
              }
              onOpenFile={() =>
                openFile(
                  editor,
                  { project, path: tablePath(table) },
                  { nearId: shape.id }
                )
              }
              onOpenConnections={() => openConnectionsWindow(editor, { table })}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface GridProps {
  store: DataStore;
  schema: DataSchema;
  table: string;
  initialFilter: string;
  tick: number;
  onFollowRef: (table: string, id: RowId) => void;
  onOpenFile: () => void;
  onOpenConnections: () => void;
}

interface EditState {
  id: RowId;
  column: string;
  draft: string;
}

function TableGrid({
  store,
  schema,
  table,
  initialFilter,
  tick,
  onFollowRef,
  onOpenFile,
  onOpenConnections,
}: GridProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null
  );
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setFilter(initialFilter), [initialFilter]);

  const def = getTable(schema, table);
  const result = useAsyncValue(
    () => store.query(table, { filter, sort, page, pageSize: PAGE_SIZE }),
    [store, table, filter, sort, page, tick],
    { rows: [] as Row[], total: 0, page: 1, pageCount: 1 }
  );
  const fileError = useAsyncValue(
    () => store.rowsError(table),
    [store, table, tick],
    null as string | null
  );

  // Rows of the tables our ref columns point at (for display values and the ref editor).
  const refTables = [
    ...new Set(
      (def?.columns ?? [])
        .filter((c) => c.type === "ref" && c.ref)
        .map((c) => c.ref!)
    ),
  ];
  const refRows = useAsyncValue(
    async () => {
      const out: Record<string, Row[]> = {};
      for (const t of refTables)
        out[t] = getTable(schema, t) ? await store.rows(t) : [];
      return out;
    },
    [store, table, tick, refTables.join(",")],
    {} as Record<string, Row[]>
  );

  const say = useCallback((text: string, error = false) => {
    setStatus({ text, error });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(
      () => setStatus(null),
      error ? 8000 : 3000
    );
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      say(label);
    } catch (e) {
      say(
        e instanceof DataError || e instanceof Error ? e.message : String(e),
        true
      );
    }
  };

  if (!def)
    return <div className="pos-files__hint">Unknown table {table}.</div>;
  const pk = def.primaryKey;

  const toggleSort = (column: string) =>
    setSort((s) =>
      s?.column !== column
        ? { column, dir: "asc" }
        : s.dir === "asc"
          ? { column, dir: "desc" }
          : null
    );

  const commit = async () => {
    if (!edit) return;
    const { id, column, draft } = edit;
    setEdit(null);
    const current = result.value.rows.find((r) => String(r[pk]) === String(id));
    const col = def.columns.find((c) => c.name === column);
    if (!current || !col) return;
    const before = current[column];
    const beforeText =
      before === undefined || before === null
        ? ""
        : typeof before === "object"
          ? JSON.stringify(before)
          : String(before);
    if (draft === beforeText) return;
    await run(`Saved ${table}.${column}`, () =>
      store.update(table, id, { [column]: draft === "" ? null : draft })
    );
  };

  const startEdit = (row: Row, col: Column) => {
    if (col.name === pk && col.type === "number") return;
    const v = row[col.name];
    setEdit({
      id: row[pk] as RowId,
      column: col.name,
      draft:
        v === undefined || v === null
          ? ""
          : typeof v === "object"
            ? JSON.stringify(v, null, 2)
            : String(v),
    });
  };

  const addRow = () =>
    run("Row added", async () => {
      const row: Row = {};
      for (const c of def.columns) {
        if (c.name === pk || c.default !== undefined || !c.required) continue;
        if (c.type === "string" || c.type === "image")
          row[c.name] = `New ${c.name}`;
        else if (c.type === "number") row[c.name] = 0;
        else if (c.type === "boolean") row[c.name] = false;
        else if (c.type === "date")
          row[c.name] = new Date().toISOString().slice(0, 10);
        else if (c.type === "json") row[c.name] = {};
        else if (c.type === "ref" && c.ref)
          row[c.name] =
            (await store.rows(c.ref))[0]?.[
              getTable(schema, c.ref)?.primaryKey ?? "id"
            ] ?? null;
      }
      await store.insert(table, row);
      setSort(null);
      setPage(Math.max(1, Math.ceil((result.value.total + 1) / PAGE_SIZE)));
    });

  const deleteRow = (row: Row) =>
    run("Row deleted", async () => {
      const id = row[pk] as RowId;
      if (
        !window.confirm(
          `Delete ${table} ${String(id)} (${displayValue(def, row)})?`
        )
      )
        return;
      try {
        await store.remove(table, id);
      } catch (e) {
        if (!(e instanceof DataError) || !/referenced by/.test(e.message))
          throw e;
        if (
          !window.confirm(
            `${e.message.split(". Pass")[0]}.\n\nClear those references and delete anyway?`
          )
        )
          return;
        await store.remove(table, id, { onReferences: "nullify" });
      }
    });

  const doImport = (mode: "append" | "replace") =>
    run(`Imported (${mode})`, async () => {
      const picked = await pickTextFile(".json,.csv,text/csv,application/json");
      if (!picked) return;
      const format = /\.csv$/i.test(picked.name) ? "csv" : "json";
      const r = await store.importRows(table, picked.text, format, mode);
      say(`Imported ${r.count} row${r.count === 1 ? "" : "s"} (${mode})`);
    });

  const doExport = (format: "json" | "csv") =>
    run(`Exported ${format.toUpperCase()}`, async () => {
      downloadText(
        `${table}.${format}`,
        await store.exportRows(table, format),
        format === "csv" ? "text/csv" : "application/json"
      );
    });

  const toggleJson = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { rows, total, pageCount } = result.value;
  const first = total === 0 ? 0 : (result.value.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, result.value.page * PAGE_SIZE);

  return (
    <div className="pos-data__main">
      <div className="pos-toolbar pos-toolbar--dense">
        <input
          className="pos-data__filter"
          type="search"
          data-testid="data-filter"
          placeholder="Filter (text, col=value, col>3, col:part)"
          aria-label="Filter rows"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <span
          className={`pos-toolbar__status${status?.error ? " pos-data__status--error" : ""}`}
          data-testid="data-status"
          title={status?.text}
        >
          {status?.text ?? result.error ?? fileError.value ?? ""}
        </span>
        <button
          type="button"
          className="pos-button pos-button--small pos-button--primary"
          data-testid="data-add-row"
          onClick={() => void addRow()}
        >
          + Row
        </button>
        <Dropdown label="More" small align="right" testId="data-more">
          <MenuItem
            label="Import JSON / CSV (append)..."
            onSelect={() => void doImport("append")}
          />
          <MenuItem
            label="Import JSON / CSV (replace all)..."
            onSelect={() => void doImport("replace")}
          />
          <MenuItem
            label="Export JSON"
            onSelect={() => void doExport("json")}
          />
          <MenuItem label="Export CSV" onSelect={() => void doExport("csv")} />
          <MenuItem label={`Open ${tablePath(table)}`} onSelect={onOpenFile} />
          <MenuItem label="Show connections" onSelect={onOpenConnections} />
        </Dropdown>
      </div>
      <div className="pos-data__scroll">
        <table className="pos-data__grid" data-testid="data-grid">
          <thead>
            <tr>
              {def.columns.map((c) => (
                <th
                  key={c.name}
                  className="pos-data__th"
                  data-sort={sort?.column === c.name ? sort.dir : undefined}
                  title={`${c.type}${c.ref ? ` -> ${c.ref}` : ""}${c.required ? ", required" : ""}${c.unique ? ", unique" : ""}${c.description ? `\n${c.description}` : ""}`}
                  onClick={() => toggleSort(c.name)}
                >
                  {c.name}
                  <span className="pos-data__type">
                    {c.type === "ref" ? `→ ${c.ref}` : c.type}
                  </span>
                  {sort?.column === c.name && (
                    <span className="pos-data__sort">
                      {sort.dir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
              <th className="pos-data__th pos-data__th--actions">
                <span className="pos-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = row[pk] as RowId;
              return (
                <tr
                  key={String(id)}
                  data-id={String(id)}
                  data-testid="data-row"
                >
                  {def.columns.map((c) => {
                    const editing =
                      edit &&
                      String(edit.id) === String(id) &&
                      edit.column === c.name;
                    return (
                      <td
                        key={c.name}
                        className={`pos-data__td${editing ? " pos-data__td--editing" : ""}`}
                        data-column={c.name}
                        data-testid="data-cell"
                        onDoubleClick={() => !editing && startEdit(row, c)}
                      >
                        {editing ? (
                          <CellEditor
                            column={c}
                            edit={edit}
                            schema={schema}
                            refRows={refRows.value}
                            onChange={(draft) => setEdit({ ...edit, draft })}
                            onCommit={() => void commit()}
                            onCancel={() => setEdit(null)}
                          />
                        ) : (
                          <CellValue
                            column={c}
                            value={row[c.name]}
                            schema={schema}
                            refRows={refRows.value}
                            expanded={expanded.has(`${String(id)}:${c.name}`)}
                            onToggle={() =>
                              toggleJson(`${String(id)}:${c.name}`)
                            }
                            onFollow={onFollowRef}
                            onBoolean={(v) =>
                              void run("Saved", () =>
                                store.update(table, id, { [c.name]: v })
                              )
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="pos-data__td pos-data__td--actions">
                    <button
                      type="button"
                      className="pos-data__delete"
                      title="Delete row"
                      aria-label={`Delete row ${String(id)}`}
                      onClick={() => void deleteRow(row)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !result.loading && (
          <div className="pos-files__hint">
            {total === 0 && !filter
              ? "No rows yet. Use + Row or import a file."
              : "No rows match."}
          </div>
        )}
      </div>
      <div className="pos-data__footer">
        <span>
          {first}–{last} of {total}
          {filter ? " (filtered)" : ""}
        </span>
        <span className="pos-data__pager">
          <button
            type="button"
            className="pos-button pos-button--small"
            disabled={result.value.page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span>
            {result.value.page} / {pageCount}
          </span>
          <button
            type="button"
            className="pos-button pos-button--small"
            disabled={result.value.page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </span>
      </div>
    </div>
  );
}

function CellValue({
  column,
  value,
  schema,
  refRows,
  expanded,
  onToggle,
  onFollow,
  onBoolean,
}: {
  column: Column;
  value: unknown;
  schema: DataSchema;
  refRows: Record<string, Row[]>;
  expanded: boolean;
  onToggle: () => void;
  onFollow: (table: string, id: RowId) => void;
  onBoolean: (v: boolean) => void;
}) {
  if (column.type === "boolean") {
    return (
      <input
        type="checkbox"
        className="pos-data__bool"
        checked={value === true}
        aria-label={column.name}
        onChange={(e) => onBoolean(e.target.checked)}
      />
    );
  }
  if (value === undefined || value === null || value === "")
    return (
      <span className="pos-data__null">{value === "" ? '""' : "null"}</span>
    );
  if (column.type === "ref" && column.ref) {
    const target = getTable(schema, column.ref);
    const row = target
      ? (refRows[column.ref] ?? []).find(
          (r) => String(r[target.primaryKey]) === String(value)
        )
      : undefined;
    return (
      <span className="pos-data__ref" title={`${column.ref} ${String(value)}`}>
        <button
          type="button"
          className="pos-data__ref-link"
          onClick={() => onFollow(column.ref!, value as RowId)}
        >
          {target && row ? displayValue(target, row) : String(value)}
        </button>
        {!row && (
          <span className="pos-data__ref-missing" title="No such row">
            ?
          </span>
        )}
      </span>
    );
  }
  if (isImageValue(column, value)) {
    return (
      <span className="pos-data__image" title={String(value)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pos-data__thumb" src={String(value)} alt="" />
        <span className="pos-data__image-text">
          {String(value).replace(/^data:image\/[^,]+,.*/, "data:image")}
        </span>
      </span>
    );
  }
  if (column.type === "json" || (typeof value === "object" && value !== null)) {
    const summary = Array.isArray(value)
      ? `[${value.length}]`
      : typeof value === "object"
        ? `{${Object.keys(value as object).length}}`
        : String(value);
    return (
      <span className="pos-data__json">
        <button
          type="button"
          className="pos-data__json-toggle"
          onClick={onToggle}
          title="Expand / collapse"
        >
          {expanded ? "▾" : "▸"} {summary}
        </button>
        {expanded && (
          <pre className="pos-data__json-body">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </span>
    );
  }
  return <span className="pos-data__text">{String(value)}</span>;
}

function CellEditor({
  column,
  edit,
  schema,
  refRows,
  onChange,
  onCommit,
  onCancel,
}: {
  column: Column;
  edit: EditState;
  schema: DataSchema;
  refRows: Record<string, Row[]>;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) ref.current.select();
  }, []);
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") onCancel();
    else if (e.key === "Enter" && !(column.type === "json" && !e.ctrlKey)) {
      e.preventDefault();
      onCommit();
    }
  };
  if (column.type === "ref" && column.ref) {
    const target = getTable(schema, column.ref);
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        className="pos-select pos-data__input"
        data-testid="data-cell-editor"
        value={edit.draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={keys}
      >
        <option value="">(none)</option>
        {target &&
          (refRows[column.ref] ?? []).map((r) => (
            <option
              key={String(r[target.primaryKey])}
              value={String(r[target.primaryKey])}
            >
              {displayValue(target, r)} ({String(r[target.primaryKey])})
            </option>
          ))}
      </select>
    );
  }
  if (column.type === "json") {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        className="pos-data__input pos-data__textarea"
        data-testid="data-cell-editor"
        value={edit.draft}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={keys}
        title="Ctrl+Enter to save"
      />
    );
  }
  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      className="pos-data__input"
      data-testid="data-cell-editor"
      type={
        column.type === "number"
          ? "number"
          : column.type === "date" &&
              /^\d{4}-\d{2}-\d{2}$/.test(edit.draft || "0000-00-00")
            ? "date"
            : "text"
      }
      step={column.type === "number" ? "any" : undefined}
      value={edit.draft}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={keys}
    />
  );
}
