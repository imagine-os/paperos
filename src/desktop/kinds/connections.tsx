"use client";

import { useEffect, useMemo, useState } from "react";
import { stopEventPropagation } from "tldraw";
import type { Binding, BindingIndex, SourceInfo } from "@/data/bindings";
import { scanProjectBindings } from "@/data/project-fs";
import { docsChanged } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";
import {
  openDataWindow,
  parseContent,
  useActiveData,
  useAsyncValue,
  type ConnectionsContent,
} from "./data-common";

const SCAN_DELAY_MS = 250;
const KIND_LABEL: Record<SourceInfo["kind"], string> = {
  component: "Component",
  page: "Page",
  html: "HTML file",
  js: "Script",
};

/** Connections: which components, pages and files read or write each table, and the reverse. */
export function ConnectionsWindow({ shape, editor, update }: WindowKindProps) {
  const { project, store, tick } = useActiveData();
  const projects = getProjectStore();
  const docTick = useSignal(docsChanged);
  const fileTick = useSignal(projects.changes);
  const content = parseContent<ConnectionsContent>(shape.props.content);

  // Debounce the rescans: documents change on every keystroke.
  const [scanTick, setScanTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScanTick((n) => n + 1), SCAN_DELAY_MS);
    return () => clearTimeout(t);
  }, [tick, docTick, fileTick, project]);

  const index = useAsyncValue(
    async (): Promise<BindingIndex | null> =>
      project && store ? scanProjectBindings(project, projects) : null,
    [project, store, scanTick],
    null
  );

  const select = (next: ConnectionsContent) =>
    update({ content: JSON.stringify(next) });
  const idx = index.value;
  const selectedSource =
    idx && content.source
      ? idx.sources.find(
          (s) => s.path === content.source || s.name === content.source
        )
      : undefined;
  const selectedTable =
    idx && content.table && !selectedSource ? content.table : undefined;

  const openBinding = (b: Binding) => {
    if (!project) return;
    openFile(
      editor,
      { project, path: b.path },
      { line: b.line, nearId: shape.id }
    );
  };

  return (
    <div
      className="pos-connections"
      data-testid="connections-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      {!project && <div className="pos-files__hint">No project is open.</div>}
      {project && idx && (
        <>
          <Graph
            index={idx}
            selectedTable={selectedTable}
            selectedSource={selectedSource?.path}
            onTable={(t) => select({ table: t })}
            onSource={(p) => select({ source: p })}
          />
          <div className="pos-connections__body">
            <aside className="pos-data__tables">
              <div className="pos-data__heading">Tables</div>
              {idx.tables.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pos-data__table${selectedTable === t ? " pos-data__table--active" : ""}`}
                  data-testid={`connections-table-${t}`}
                  onClick={() => select({ table: t })}
                >
                  <span className="pos-data__table-name">{t}</span>
                  <span className="pos-data__count">
                    {idx.byTable[t]?.length ?? 0}
                  </span>
                </button>
              ))}
              {(["page", "component", "html", "js"] as const).map((kind) => {
                const list = idx.sources.filter((s) => s.kind === kind);
                if (!list.length) return null;
                return (
                  <div key={kind}>
                    <div className="pos-data__heading">{KIND_LABEL[kind]}s</div>
                    {list.map((s) => (
                      <button
                        key={s.path}
                        type="button"
                        className={`pos-data__table${selectedSource?.path === s.path ? " pos-data__table--active" : ""}`}
                        data-testid={`connections-source-${s.path}`}
                        title={s.path}
                        onClick={() => select({ source: s.path })}
                      >
                        <span className="pos-data__table-name">{s.name}</span>
                        <span className="pos-data__count">
                          {s.tables.length + s.indirect.length}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </aside>
            <div
              className="pos-connections__detail"
              data-testid="connections-detail"
            >
              {selectedTable && (
                <TableDetail
                  table={selectedTable}
                  index={idx}
                  onOpenData={() =>
                    openDataWindow(editor, { table: selectedTable })
                  }
                  onOpen={openBinding}
                  onSource={(p) => select({ source: p })}
                />
              )}
              {selectedSource && (
                <SourceDetail
                  source={selectedSource}
                  index={idx}
                  onOpen={openBinding}
                  onOpenFile={() =>
                    openFile(
                      editor,
                      { project, path: selectedSource.path },
                      { nearId: shape.id }
                    )
                  }
                  onTable={(t) => select({ table: t })}
                />
              )}
              {!selectedTable && !selectedSource && (
                <div className="pos-files__hint">
                  Pick a table to see the components, pages and files that use
                  it, or a source to see its tables.
                  {idx.bindings.length === 0 && (
                    <p>
                      No bindings found. Add{" "}
                      <code>data-source=&quot;table&quot;</code> to HTML,{" "}
                      <code>bindings</code> to <code>components/*.json</code> or{" "}
                      <code>pages/*.json</code>, or call{" "}
                      <code>paperos.data.&lt;table&gt;.list()</code> in a
                      script.
                    </p>
                  )}
                </div>
              )}
              <div className="pos-connections__sections">
                <section>
                  <div className="pos-data__heading">
                    Unused tables ({idx.unusedTables.length})
                  </div>
                  {idx.unusedTables.length === 0 && (
                    <div className="pos-connections__muted">
                      Every table is bound somewhere.
                    </div>
                  )}
                  <div className="pos-connections__chips">
                    {idx.unusedTables.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="pos-connections__chip"
                        onClick={() => select({ table: t })}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="pos-data__heading">
                    Broken bindings ({idx.broken.length})
                  </div>
                  {idx.broken.length === 0 && (
                    <div className="pos-connections__muted">
                      All bindings point at existing tables and columns.
                    </div>
                  )}
                  {idx.broken.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      className="pos-connections__binding pos-connections__binding--broken"
                      data-testid="connections-broken"
                      onClick={() => openBinding(p.binding)}
                    >
                      <span className="pos-connections__loc">
                        {p.binding.path}:{p.binding.line}
                      </span>
                      <span>{p.message}</span>
                    </button>
                  ))}
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: Binding["mode"] }) {
  return (
    <span className={`pos-connections__mode pos-connections__mode--${mode}`}>
      {mode}
    </span>
  );
}

function BindingRow({
  b,
  index,
  onOpen,
  label,
}: {
  b: Binding;
  index: BindingIndex;
  onOpen: (b: Binding) => void;
  label: string;
}) {
  const broken = index.broken.some((p) => p.binding === b);
  return (
    <button
      type="button"
      className={`pos-connections__binding${broken ? " pos-connections__binding--broken" : ""}`}
      data-testid="connections-binding"
      title={`Open ${b.path} at line ${b.line}`}
      onClick={() => onOpen(b)}
    >
      <span className="pos-connections__name">{label}</span>
      <ModeBadge mode={b.mode} />
      <span className="pos-connections__loc">
        {b.path}:{b.line}
      </span>
      {b.fields.length > 0 && (
        <span className="pos-connections__fields">{b.fields.join(", ")}</span>
      )}
      {b.filter && (
        <span className="pos-connections__fields">filter: {b.filter}</span>
      )}
    </button>
  );
}

function TableDetail({
  table,
  index,
  onOpenData,
  onOpen,
  onSource,
}: {
  table: string;
  index: BindingIndex;
  onOpenData: () => void;
  onOpen: (b: Binding) => void;
  onSource: (path: string) => void;
}) {
  const list = index.byTable[table] ?? [];
  const groups: [string, Binding[]][] = (
    ["component", "page", "html", "js"] as const
  )
    .map((k): [string, Binding[]] => [
      `${KIND_LABEL[k]}s`,
      list.filter((b) => b.kind === k),
    ])
    .filter(([, l]) => l.length > 0);
  const pages = index.sources.filter((s) =>
    s.indirect.some((i) => i.table === table)
  );
  return (
    <div>
      <div className="pos-connections__title">
        <strong>{table}</strong>
        <span className="pos-connections__muted">
          {list.length} binding{list.length === 1 ? "" : "s"}
          {!index.tables.includes(table) && " · not in the schema"}
        </span>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onOpenData}
        >
          Open in Data
        </button>
      </div>
      {groups.map(([label, l]) => (
        <section key={label}>
          <div className="pos-data__heading">{label}</div>
          {l.map((b, i) => (
            <BindingRow
              key={i}
              b={b}
              index={index}
              onOpen={onOpen}
              label={b.source}
            />
          ))}
        </section>
      ))}
      {pages.length > 0 && (
        <section>
          <div className="pos-data__heading">Pages through components</div>
          {pages.map((p) => (
            <button
              key={p.path}
              type="button"
              className="pos-connections__binding"
              onClick={() => onSource(p.path)}
            >
              <span className="pos-connections__name">{p.name}</span>
              <span className="pos-connections__fields">
                via{" "}
                {p.indirect
                  .filter((i) => i.table === table)
                  .map((i) => i.via)
                  .join(", ")}
              </span>
            </button>
          ))}
        </section>
      )}
      {list.length === 0 && (
        <div className="pos-files__hint">
          Nothing reads or writes this table.
        </div>
      )}
    </div>
  );
}

function SourceDetail({
  source,
  index,
  onOpen,
  onOpenFile,
  onTable,
}: {
  source: SourceInfo;
  index: BindingIndex;
  onOpen: (b: Binding) => void;
  onOpenFile: () => void;
  onTable: (t: string) => void;
}) {
  const list = index.bySource[source.path] ?? [];
  return (
    <div>
      <div className="pos-connections__title">
        <strong>{source.name}</strong>
        <span className="pos-connections__muted">
          {KIND_LABEL[source.kind]} · {source.path}
        </span>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onOpenFile}
        >
          Open file
        </button>
      </div>
      <section>
        <div className="pos-data__heading">Tables</div>
        {list.map((b, i) => (
          <BindingRow
            key={i}
            b={b}
            index={index}
            onOpen={onOpen}
            label={b.table}
          />
        ))}
        {list.length === 0 && (
          <div className="pos-connections__muted">No direct bindings.</div>
        )}
      </section>
      {source.indirect.length > 0 && (
        <section>
          <div className="pos-data__heading">Through components</div>
          {source.indirect.map((i, k) => (
            <button
              key={k}
              type="button"
              className="pos-connections__binding"
              onClick={() => onTable(i.table)}
            >
              <span className="pos-connections__name">{i.table}</span>
              <span className="pos-connections__fields">via {i.via}</span>
            </button>
          ))}
        </section>
      )}
      {source.components.length > 0 && (
        <section>
          <div className="pos-data__heading">Components</div>
          <div className="pos-connections__chips">
            {source.components.map((c) => (
              <span
                key={c}
                className="pos-connections__chip pos-connections__chip--static"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const ROW = 24;
const GRAPH_W = 440;

/** Two columns (tables left, sources right) joined by one line per table/source pair. */
function Graph({
  index,
  selectedTable,
  selectedSource,
  onTable,
  onSource,
}: {
  index: BindingIndex;
  selectedTable?: string;
  selectedSource?: string;
  onTable: (t: string) => void;
  onSource: (p: string) => void;
}) {
  const tables = useMemo(
    () => [
      ...new Set([...index.tables, ...index.bindings.map((b) => b.table)]),
    ],
    [index]
  );
  const sources = index.sources;
  const edges = useMemo(() => {
    const seen = new Map<
      string,
      { table: string; source: string; broken: boolean }
    >();
    for (const b of index.bindings) {
      const key = `${b.table}|${b.path}`;
      const broken = index.broken.some((p) => p.binding === b);
      const prev = seen.get(key);
      if (!prev) seen.set(key, { table: b.table, source: b.path, broken });
      else prev.broken = prev.broken || broken;
    }
    return [...seen.values()];
  }, [index]);
  const h = Math.max(tables.length, sources.length, 1) * ROW + 16;
  const ty = (t: string) => 12 + tables.indexOf(t) * ROW + ROW / 2;
  const sy = (p: string) =>
    12 + sources.findIndex((s) => s.path === p) * ROW + ROW / 2;
  const active = (t: string, p: string) =>
    t === selectedTable || p === selectedSource;
  return (
    <svg
      className="pos-connections__graph"
      viewBox={`0 0 ${GRAPH_W} ${h}`}
      width="100%"
      height={Math.min(h, 200)}
      preserveAspectRatio="xMidYMin meet"
      data-testid="connections-graph"
    >
      {edges.map((e) => (
        <path
          key={`${e.table}|${e.source}`}
          className={`pos-connections__edge${e.broken ? " pos-connections__edge--broken" : ""}${active(e.table, e.source) ? " pos-connections__edge--active" : ""}`}
          d={`M${130},${ty(e.table)} C${GRAPH_W / 2},${ty(e.table)} ${GRAPH_W / 2},${sy(e.source)} ${GRAPH_W - 150},${sy(e.source)}`}
        />
      ))}
      {tables.map((t) => (
        <g
          key={t}
          className={`pos-connections__node${selectedTable === t ? " pos-connections__node--active" : ""}${index.unusedTables.includes(t) ? " pos-connections__node--unused" : ""}`}
          transform={`translate(8 ${ty(t) - 9})`}
          onClick={() => onTable(t)}
          role="button"
        >
          <rect width={122} height={18} rx={4} />
          <text x={6} y={13}>
            {t.length > 16 ? `${t.slice(0, 15)}…` : t}
          </text>
        </g>
      ))}
      {sources.map((s) => (
        <g
          key={s.path}
          className={`pos-connections__node pos-connections__node--source${selectedSource === s.path ? " pos-connections__node--active" : ""}`}
          transform={`translate(${GRAPH_W - 150} ${sy(s.path) - 9})`}
          onClick={() => onSource(s.path)}
          role="button"
        >
          <rect width={142} height={18} rx={4} />
          <text x={6} y={13}>
            {(s.kind === "component" || s.kind === "page"
              ? `${s.kind === "page" ? "page " : ""}${s.name}`
              : s.path
            ).slice(0, 20)}
          </text>
        </g>
      ))}
    </svg>
  );
}
