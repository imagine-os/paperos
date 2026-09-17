"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { layoutErd } from "@/data/erd";
import { describeStep, type Renames } from "@/data/migrate";
import {
  COLUMN_TYPES,
  isValidName,
  newTable,
  parseSchema,
  type Column,
  type ColumnType,
  type DataSchema,
  type Table,
} from "@/data/schema";
import type { DataStore } from "@/data/store";
import type { WindowKindProps } from "../window-kinds";
import { EmptyState } from "./empty-state";
import {
  addFirstTable,
  openDataWindow,
  parseContent,
  useActiveData,
  useAsyncValue,
} from "./data-common";

interface DraftColumn extends Column {
  _orig?: string;
}
interface DraftTable extends Omit<Table, "columns"> {
  _orig?: string;
  columns: DraftColumn[];
}
interface Draft {
  tables: DraftTable[];
}

function toDraft(schema: DataSchema): Draft {
  return {
    tables: schema.tables.map((t) => ({
      ...t,
      _orig: t.name,
      columns: t.columns.map((c) => ({ ...c, _orig: c.name })),
    })),
  };
}

function fromDraft(draft: Draft): { schema: DataSchema; renames: Renames } {
  const renames: Renames = { tables: {}, columns: {} };
  const schema: DataSchema = {
    tables: draft.tables.map((t) => {
      if (t._orig && t._orig !== t.name) renames.tables![t._orig] = t.name;
      const cols: Record<string, string> = {};
      const columns = t.columns.map((c) => {
        if (c._orig && c._orig !== c.name) cols[c._orig] = c.name;
        const { _orig, ...rest } = c;
        void _orig;
        return rest;
      });
      if (t._orig && Object.keys(cols).length) renames.columns![t._orig] = cols;
      const { _orig, ...rest } = t;
      void _orig;
      return { ...rest, columns };
    }),
  };
  return { schema, renames };
}

/** Schema window: an entity-relationship diagram plus a form that edits data/schema.json. */
export function SchemaWindow({ shape, editor, update }: WindowKindProps) {
  const { project, store, tick } = useActiveData();
  const content = parseContent<{ table?: string; tab?: string }>(
    shape.props.content
  );
  const schema = useAsyncValue(
    () => (store ? store.schema() : Promise.resolve({ tables: [] })),
    [store, tick],
    {
      tables: [],
    } as DataSchema
  );
  const hasSchema = useAsyncValue(
    () => (store ? store.hasSchema() : Promise.resolve(false)),
    [store, tick],
    false
  );
  const errors = useAsyncValue(
    () => (store ? store.schemaErrors() : Promise.resolve([])),
    [store, tick],
    [] as string[]
  );
  const tab = content.tab === "edit" ? "edit" : "diagram";
  const setTab = (t: "diagram" | "edit") =>
    update({ content: JSON.stringify({ ...content, tab: t }) });

  return (
    <div
      className="pos-schema"
      data-testid="schema-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <button
          type="button"
          className={`pos-button pos-button--small${tab === "diagram" ? " pos-button--primary" : ""}`}
          data-testid="schema-tab-diagram"
          onClick={() => setTab("diagram")}
        >
          Diagram
        </button>
        <button
          type="button"
          className={`pos-button pos-button--small${tab === "edit" ? " pos-button--primary" : ""}`}
          data-testid="schema-tab-edit"
          onClick={() => setTab("edit")}
        >
          Edit
        </button>
        <span className="pos-toolbar__status" title={errors.value.join("\n")}>
          {errors.value.length
            ? `${errors.value.length} problem${errors.value.length > 1 ? "s" : ""} in schema.json`
            : `${schema.value.tables.length} table${schema.value.tables.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {!project && <div className="pos-files__hint">No project is open.</div>}
      {project && store && tab === "diagram" && (
        <Erd
          schema={schema.value}
          hasSchema={hasSchema.value}
          shapeId={shape.id}
          onOpenTable={(t) => openDataWindow(editor, { table: t })}
          onCreate={() => void store.ensureSchema().then(() => setTab("edit"))}
          onAddTable={() => void addFirstTable(store)}
          onEdit={() => setTab("edit")}
        />
      )}
      {project && store && tab === "edit" && (
        <SchemaEditor
          key={project}
          store={store}
          schema={schema.value}
          tick={tick}
          initialTable={content.table}
        />
      )}
    </div>
  );
}

// ----- diagram -----------------------------------------------------------------

function Erd({
  schema,
  hasSchema,
  shapeId,
  onOpenTable,
  onCreate,
  onAddTable,
  onEdit,
}: {
  schema: DataSchema;
  hasSchema: boolean;
  shapeId: string;
  onOpenTable: (table: string) => void;
  onCreate: () => void;
  onAddTable: () => void;
  onEdit: () => void;
}) {
  const layout = useMemo(() => layoutErd(schema), [schema]);
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ x: number; y: number; k: number } | null>(
    null
  );
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null
  );
  const marker = `erd-arrow-${shapeId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const fit = () => {
    const box = host.current?.getBoundingClientRect();
    if (!box) return;
    const k =
      Math.min(box.width / layout.width, box.height / layout.height, 1.4) || 1;
    setView({
      k,
      x: (box.width - layout.width * k) / 2,
      y: (box.height - layout.height * k) / 2,
    });
  };
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (!view) return;
    const box = host.current!.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const k = Math.min(4, Math.max(0.2, view.k * factor));
    setView({
      k,
      x: px - ((px - view.x) * k) / view.k,
      y: py - ((py - view.y) * k) / view.k,
    });
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!view || (e.target as Element).closest(".pos-erd__table")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !view) return;
    setView({
      ...view,
      x: drag.current.vx + e.clientX - drag.current.x,
      y: drag.current.vy + e.clientY - drag.current.y,
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  if (!hasSchema) {
    return (
      <div className="pos-files__hint pos-data__empty">
        <p>
          This project has no <code>data/schema.json</code> yet.
        </p>
        <button
          type="button"
          className="pos-button pos-button--primary"
          onClick={onCreate}
        >
          Create a data model
        </button>
      </div>
    );
  }

  return (
    <div
      ref={host}
      className="pos-erd"
      data-testid="schema-erd"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg className="pos-erd__svg" width="100%" height="100%">
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" className="pos-erd__arrow" />
          </marker>
        </defs>
        <g
          transform={
            view ? `translate(${view.x} ${view.y}) scale(${view.k})` : undefined
          }
        >
          {layout.edges.map((e, i) => (
            <polyline
              key={i}
              className={`pos-erd__edge${e.self ? " pos-erd__edge--self" : ""}`}
              points={e.points.map((p) => `${p.x},${p.y}`).join(" ")}
              markerEnd={`url(#${marker})`}
            >
              <title>
                {e.from}.{e.column} → {e.to}
              </title>
            </polyline>
          ))}
          {layout.nodes.map((n) => (
            <g
              key={n.name}
              className="pos-erd__table"
              data-table={n.name}
              transform={`translate(${n.x} ${n.y})`}
              onClick={() => onOpenTable(n.name)}
              role="button"
              tabIndex={0}
            >
              <title>Open {n.name} in Data</title>
              <rect className="pos-erd__box" width={n.w} height={n.h} rx="8" />
              <rect className="pos-erd__head" width={n.w} height={30} rx="8" />
              <rect className="pos-erd__head" y={16} width={n.w} height={14} />
              <text className="pos-erd__title" x={12} y={20}>
                {n.name}
              </text>
              {n.columns.map((c) => (
                <g key={c.name}>
                  <text
                    className={`pos-erd__col${c.key ? " pos-erd__col--key" : ""}${c.type === "ref" ? " pos-erd__col--ref" : ""}`}
                    x={12}
                    y={c.y + 4}
                  >
                    {c.key ? "⚿ " : ""}
                    {c.name}
                  </text>
                  <text
                    className="pos-erd__type"
                    x={n.w - 10}
                    y={c.y + 4}
                    textAnchor="end"
                  >
                    {c.type === "ref" ? `→ ${c.ref}` : c.type}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
      <div className="pos-erd__controls">
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={fit}
          title="Fit diagram"
        >
          Fit
        </button>
      </div>
      {layout.nodes.length === 0 && (
        <div className="pos-erd__hint">
          <EmptyState
            icon={"\u{1F5FA}"}
            title="No tables yet"
            testId="schema-empty"
            actions={[
              {
                label: "Add a table",
                primary: true,
                testId: "schema-add-table",
                onClick: onAddTable,
              },
              { label: "Edit schema.json", onClick: onEdit },
            ]}
          >
            <p>
              The diagram draws one box per table and a line per reference.
              Start with an <code>items</code> table, then rename it and add
              columns in Edit.
            </p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}

// ----- editor ------------------------------------------------------------------

function SchemaEditor({
  store,
  schema,
  tick,
  initialTable,
}: {
  store: DataStore;
  schema: DataSchema;
  tick: number;
  initialTable?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(schema));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    initialTable ?? schema.tables[0]?.name ?? null
  );
  const [status, setStatus] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  // Follow external changes while nothing is being edited.
  useEffect(() => {
    if (!dirty) {
      setDraft(toDraft(schema));
      setSelected((s) =>
        s && schema.tables.some((t) => t.name === s)
          ? s
          : (schema.tables[0]?.name ?? null)
      );
    }
  }, [schema, tick, dirty]);

  const table = draft.tables.find((t) => t.name === selected) ?? null;

  const patch = (fn: (d: Draft) => Draft) => {
    setDraft((d) => fn(d));
    setDirty(true);
    setStatus(null);
  };
  const patchTable = (fn: (t: DraftTable) => DraftTable) =>
    patch((d) => ({
      tables: d.tables.map((t) => (t.name === selected ? fn(t) : t)),
    }));
  const patchColumn = (index: number, fn: (c: DraftColumn) => DraftColumn) =>
    patchTable((t) => ({
      ...t,
      columns: t.columns.map((c, i) => (i === index ? fn(c) : c)),
    }));

  const addTable = () => {
    const name = window.prompt(
      "Table name (letters, digits, underscore)",
      "items"
    );
    if (!name) return;
    if (!isValidName(name) || draft.tables.some((t) => t.name === name)) {
      setStatus({
        text: `"${name}" is not a valid, unused table name`,
        error: true,
      });
      return;
    }
    patch((d) => ({
      tables: [
        ...d.tables,
        {
          ...newTable(name),
          columns: newTable(name).columns.map((c) => ({ ...c })),
        },
      ],
    }));
    setSelected(name);
  };

  const removeTable = () => {
    if (
      !table ||
      !window.confirm(
        `Remove table ${table.name} from the schema? Its rows file is deleted when you apply.`
      )
    )
      return;
    patch((d) => ({ tables: d.tables.filter((t) => t.name !== table.name) }));
    setSelected(draft.tables.find((t) => t.name !== table.name)?.name ?? null);
  };

  const apply = async () => {
    const { schema: next, renames } = fromDraft(draft);
    const parsed = parseSchema(JSON.stringify(next));
    if (parsed.errors.length) {
      setStatus({ text: parsed.errors.join("; "), error: true });
      return;
    }
    const names = next.tables.map((t) => t.name);
    if (new Set(names).size !== names.length) {
      setStatus({ text: "Two tables have the same name", error: true });
      return;
    }
    for (const t of next.tables) {
      const cols = t.columns.map((c) => c.name);
      if (new Set(cols).size !== cols.length) {
        setStatus({
          text: `Table ${t.name} has duplicate column names`,
          error: true,
        });
        return;
      }
    }
    try {
      const plan = await store.planSchema(next, renames);
      if (plan.length === 0) {
        setStatus({ text: "No changes to apply" });
        setDirty(false);
        return;
      }
      const ok = window.confirm(
        `Apply ${plan.length} change${plan.length > 1 ? "s" : ""} to the schema and the row files?\n\n${plan.map((s) => `• ${describeStep(s)}`).join("\n")}`
      );
      if (!ok) return;
      await store.setSchema(next, renames);
      setDirty(false);
      setStatus({
        text: `Applied ${plan.length} change${plan.length > 1 ? "s" : ""}`,
      });
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : String(e),
        error: true,
      });
    }
  };

  const revert = () => {
    setDraft(toDraft(schema));
    setDirty(false);
    setStatus(null);
  };

  const defaultText = (v: unknown) =>
    v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  const parseDefault = (c: DraftColumn, text: string): unknown => {
    if (text === "") return undefined;
    if (c.type === "number")
      return Number.isFinite(Number(text)) ? Number(text) : text;
    if (c.type === "boolean")
      return text === "true" ? true : text === "false" ? false : text;
    if (c.type === "json") {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  };

  return (
    <div className="pos-schema__edit" data-testid="schema-editor">
      <aside className="pos-data__tables">
        <div className="pos-data__heading">Tables</div>
        {draft.tables.map((t) => (
          <button
            key={t._orig ?? t.name}
            type="button"
            className={`pos-data__table${t.name === selected ? " pos-data__table--active" : ""}`}
            data-testid={`schema-table-${t.name}`}
            onClick={() => setSelected(t.name)}
          >
            <span className="pos-data__table-name">{t.name}</span>
            <span className="pos-data__count">{t.columns.length}</span>
          </button>
        ))}
        <button
          type="button"
          className="pos-button pos-button--small pos-data__schema-link"
          data-testid="schema-add-table"
          onClick={addTable}
        >
          + Table
        </button>
      </aside>
      <div className="pos-schema__form">
        {!table && (
          <div className="pos-files__hint">Pick a table or add one.</div>
        )}
        {table && (
          <>
            <div className="pos-schema__row">
              <label>
                Name
                <input
                  className="pos-schema__input"
                  data-testid="schema-table-name"
                  value={table.name}
                  onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const name = e.target.value;
                    patchTable((t) => ({ ...t, name }));
                    setSelected(name);
                  }}
                />
              </label>
              <label>
                Primary key
                <select
                  className="pos-select"
                  value={table.primaryKey}
                  onChange={(e) =>
                    patchTable((t) => ({ ...t, primaryKey: e.target.value }))
                  }
                >
                  {table.columns.map((c) => (
                    <option key={c._orig ?? c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Display
                <select
                  className="pos-select"
                  value={table.display ?? ""}
                  onChange={(e) =>
                    patchTable((t) => ({
                      ...t,
                      display: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">(auto)</option>
                  {table.columns.map((c) => (
                    <option key={c._orig ?? c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="pos-schema__desc">
              Description
              <input
                className="pos-schema__input"
                value={table.description ?? ""}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) =>
                  patchTable((t) => ({
                    ...t,
                    description: e.target.value || undefined,
                  }))
                }
              />
            </label>
            <table className="pos-schema__columns">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th title="Required">Req</th>
                  <th title="Unique">Uniq</th>
                  <th>Default</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.columns.map((c, i) => (
                  <tr key={c._orig ?? `new-${i}`} data-testid="schema-column">
                    <td>
                      <input
                        className="pos-schema__input"
                        aria-label="Column name"
                        value={c.name}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          patchColumn(i, (x) => ({
                            ...x,
                            name: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="pos-select"
                        aria-label="Column type"
                        value={c.type}
                        onChange={(e) =>
                          patchColumn(i, (x) => ({
                            ...x,
                            type: e.target.value as ColumnType,
                            ref:
                              e.target.value === "ref"
                                ? (x.ref ?? draft.tables[0]?.name)
                                : undefined,
                          }))
                        }
                      >
                        {COLUMN_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {c.type === "ref" && (
                        <select
                          className="pos-select"
                          aria-label="Referenced table"
                          value={c.ref ?? ""}
                          onChange={(e) =>
                            patchColumn(i, (x) => ({
                              ...x,
                              ref: e.target.value,
                            }))
                          }
                        >
                          {draft.tables.map((t) => (
                            <option key={t._orig ?? t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Required"
                        checked={!!c.required}
                        onChange={(e) =>
                          patchColumn(i, (x) => ({
                            ...x,
                            required: e.target.checked || undefined,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Unique"
                        checked={!!c.unique}
                        onChange={(e) =>
                          patchColumn(i, (x) => ({
                            ...x,
                            unique: e.target.checked || undefined,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="pos-schema__input"
                        aria-label="Default value"
                        placeholder="none"
                        value={defaultText(c.default)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          patchColumn(i, (x) => ({
                            ...x,
                            default: parseDefault(x, e.target.value),
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pos-data__delete"
                        title="Remove column"
                        aria-label={`Remove column ${c.name}`}
                        disabled={c.name === table.primaryKey}
                        onClick={() =>
                          patchTable((t) => ({
                            ...t,
                            columns: t.columns.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pos-schema__actions">
              <button
                type="button"
                className="pos-button pos-button--small"
                data-testid="schema-add-column"
                onClick={() =>
                  patchTable((t) => ({
                    ...t,
                    columns: [
                      ...t.columns,
                      {
                        name: `column_${t.columns.length + 1}`,
                        type: "string",
                      },
                    ],
                  }))
                }
              >
                + Column
              </button>
              <button
                type="button"
                className="pos-button pos-button--small pos-schema__danger"
                onClick={removeTable}
              >
                Delete table
              </button>
            </div>
          </>
        )}
        <div className="pos-schema__footer">
          <span
            className={`pos-toolbar__status${status?.error ? " pos-data__status--error" : ""}`}
            data-testid="schema-status"
          >
            {status?.text ?? (dirty ? "Unsaved changes" : "")}
          </span>
          <button
            type="button"
            className="pos-button pos-button--small"
            disabled={!dirty}
            onClick={revert}
          >
            Revert
          </button>
          <button
            type="button"
            className="pos-button pos-button--small pos-button--primary"
            data-testid="schema-apply"
            disabled={!dirty}
            onClick={() => void apply()}
          >
            Apply...
          </button>
        </div>
      </div>
    </div>
  );
}
