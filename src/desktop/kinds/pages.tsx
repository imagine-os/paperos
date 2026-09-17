"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import type { ComponentDef } from "@/design/components";
import {
  findBlock,
  insertBlock,
  moveBlock,
  parentOf,
  removeBlock,
  shiftBlock,
  updateBlock,
} from "@/design/page-ops";
import {
  DEVICES,
  flattenBlocks,
  isComposedPage,
  newBlockId,
  pagePath,
  serializePage,
  validatePage,
  type Device,
  type PageBlock,
  type PageDef,
  type PageLink,
} from "@/design/pages";
import { writeDesignFile, type DesignModel } from "@/design/project-design";
import { readLiveText } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import { bundle } from "@/ide/preview/bundle";
import { getProjectStore } from "@/ide/project";
import { hintTable } from "@/lineage/open";
import type { WindowKindProps } from "../window-kinds";
import { Dropdown, MenuItem } from "../menu";
import { parseContent } from "./data-common";
import {
  createStarterDesign,
  isDesignMessage,
  openDesignWindow,
  useDesign,
  type PagesWindowContent,
} from "./design-common";
import { EmptyState } from "./empty-state";
import { PropEditor } from "./prop-editor";

const PREVIEW_DEBOUNCE_MS = 250;

/** The Page Builder: a page list, the block tree, an inspector and a device preview. */
export function PagesWindow({ shape, editor, update }: WindowKindProps) {
  const { project, design, loading } = useDesign();
  const content = parseContent<PagesWindowContent>(shape.props.content);
  const set = (patch: Partial<PagesWindowContent>) =>
    update({
      content: JSON.stringify({ ...content, ...patch }),
      ...(patch.page !== undefined ? { title: `Page: ${patch.page}` } : {}),
    });

  const pages = design?.pages ?? [];
  const page =
    pages.find((p) => p.name === content.page) ??
    (content.page ? undefined : pages[0]);

  // Pick the first page once pages are known.
  useEffect(() => {
    if (!content.page && pages[0]) set({ page: pages[0].name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  const save = (next: PageDef) => {
    if (!project) return;
    void writeDesignFile(project, pagePath(next.name), serializePage(next));
  };

  const newPage = () => {
    if (!project) return;
    const raw = window.prompt("Page name (letters, digits, dashes):", "about");
    if (!raw) return;
    const name = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");
    if (!name || pages.some((p) => p.name === name)) return;
    save({
      name,
      title: raw.trim().replace(/^./, (c) => c.toUpperCase()),
      route: `/${name}`,
      layout: { columns: 12, gap: "4", maxWidth: "1200px" },
      components: [],
      links: [],
      bindings: [],
    });
    set({ page: name, block: undefined });
  };

  return (
    <div
      className="pos-pages"
      data-testid="pages-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      {!project && <div className="pos-files__hint">No project is open.</div>}
      {project && design && (
        <div className="pos-pages__body">
          <aside
            className="pos-data__tables pos-pages__list"
            data-testid="page-list"
          >
            <div className="pos-data__heading">Pages</div>
            {pages.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`pos-data__table${page?.name === p.name ? " pos-data__table--active" : ""}`}
                data-testid={`page-${p.name}`}
                title={pagePath(p.name)}
                onClick={() => set({ page: p.name, block: undefined })}
              >
                <span className="pos-data__table-name">{p.title}</span>
                <span className="pos-data__count">{p.route}</span>
              </button>
            ))}
            <div className="pos-pages__list-actions">
              <button
                type="button"
                className="pos-button pos-button--small"
                data-testid="page-new"
                onClick={newPage}
              >
                + New page
              </button>
            </div>
            {design.components.length === 0 && (
              <div className="pos-files__hint">No component library yet.</div>
            )}
          </aside>
          {page ? (
            <PageEditor
              key={page.name}
              project={project}
              page={page}
              design={design}
              selectedBlock={content.block}
              device={content.device ?? page.device ?? "desktop"}
              sources={content.sources === true}
              onSelectBlock={(block) => set({ block })}
              onDevice={(device) => set({ device })}
              onSources={(sources) => set({ sources })}
              onHoverTable={(table) => hintTable(editor, table)}
              onSave={save}
              onOpenFile={() =>
                openFile(
                  editor,
                  { project, path: pagePath(page.name) },
                  { nearId: shape.id }
                )
              }
              onOpenDesign={(component) =>
                openDesignWindow(editor, { tab: "components", component })
              }
            />
          ) : loading ? (
            <div className="pos-files__hint">Loading…</div>
          ) : design.components.length === 0 ? (
            <EmptyState
              icon={"\u{1F4D0}"}
              title="No component library yet"
              testId="pages-no-library"
              actions={[
                {
                  label: "Create the starter library",
                  primary: true,
                  testId: "pages-create-library",
                  onClick: () => createStarterDesign(project),
                },
                {
                  label: "Open Design",
                  onClick: () =>
                    openDesignWindow(editor, { tab: "components" }),
                },
              ]}
            >
              <p>
                Pages are composed from components in{" "}
                <code>design/components/*.json</code>. The starter library has
                35 of them, styled by <code>design/tokens.json</code>.
              </p>
            </EmptyState>
          ) : (
            <EmptyState
              icon={"\u{1F4D0}"}
              title="No pages yet"
              testId="pages-empty"
              actions={[
                {
                  label: "New page",
                  primary: true,
                  testId: "pages-create-first",
                  onClick: newPage,
                },
              ]}
            >
              <p>
                A page is a 12-column grid of component blocks, bound to tables,
                previewed per device. It is saved as{" "}
                <code>pages/&lt;name&gt;.json</code>.
              </p>
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}

function PageEditor({
  project,
  page,
  design,
  selectedBlock,
  device,
  sources,
  onSelectBlock,
  onDevice,
  onSources,
  onHoverTable,
  onSave,
  onOpenFile,
  onOpenDesign,
}: {
  project: string;
  page: PageDef;
  design: DesignModel;
  selectedBlock?: string;
  device: Device;
  sources: boolean;
  onSelectBlock: (id: string | undefined) => void;
  onDevice: (device: Device) => void;
  onSources: (on: boolean) => void;
  onHoverTable: (table: string | null) => void;
  onSave: (page: PageDef) => void;
  onOpenFile: () => void;
  onOpenDesign: (component: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const block = selectedBlock
    ? findBlock(page.components, selectedBlock)
    : null;
  const def = block
    ? design.components.find((c) => c.name === block.name)
    : undefined;
  const problems = useMemo(
    () => validatePage(page, design.components, design.pages),
    [page, design.components, design.pages]
  );

  const setBlocks = (components: PageBlock[]) =>
    onSave({ ...page, components });
  const patchBlock = (
    id: string,
    patch: Partial<PageBlock> | ((b: PageBlock) => PageBlock)
  ) => setBlocks(updateBlock(page.components, id, patch));

  const addBlock = (c: ComponentDef, parentId: string | null) => {
    const b: PageBlock = {
      id: newBlockId(c.name),
      name: c.name,
      span: 12,
      props: {},
    };
    setBlocks(insertBlock(page.components, b, parentId));
    onSelectBlock(b.id);
  };

  const drop = (target: {
    parentId: string | null;
    beforeId: string | null;
  }) => {
    if (!dragId) return;
    setBlocks(moveBlock(page.components, dragId, target));
    setDragId(null);
  };

  return (
    <>
      <div className="pos-pages__tree" data-testid="page-blocks">
        <div className="pos-toolbar pos-toolbar--dense">
          <strong className="pos-toolbar__path">{page.title}</strong>
          <AddMenu
            components={design.components}
            onAdd={(c) => addBlock(c, null)}
          />
          <button
            type="button"
            className="pos-button pos-button--small"
            onClick={onOpenFile}
            title={pagePath(page.name)}
          >
            JSON
          </button>
        </div>
        {!isComposedPage(page) && (
          <div className="pos-files__hint">
            This page is rendered by <code>{page.file}</code>. Blocks added here
            render when the Preview entry is <code>{pagePath(page.name)}</code>.
          </div>
        )}
        <div
          className="pos-pages__blocks"
          onClick={() => onSelectBlock(undefined)}
        >
          <BlockList
            blocks={page.components}
            parentId={null}
            depth={0}
            columns={page.layout.columns}
            design={design}
            selected={selectedBlock}
            dragId={dragId}
            onSelect={onSelectBlock}
            onDragStart={setDragId}
            onDrop={drop}
            onShift={(id, d) => setBlocks(shiftBlock(page.components, id, d))}
            onSpan={(id, span) => patchBlock(id, { span })}
            onAddChild={(id) => {
              const c = design.components[0];
              if (c) addBlock(c, id);
            }}
            onAddChildOf={(id, c) => addBlock(c, id)}
            onRemove={(id) => {
              setBlocks(removeBlock(page.components, id));
              if (selectedBlock === id) onSelectBlock(undefined);
            }}
          />
          {page.components.length === 0 && (
            <div className="pos-files__hint">
              Empty page. Use <strong>Add block</strong> to place a component.
            </div>
          )}
        </div>
        {problems.length > 0 && (
          <div className="pos-design__errors" data-testid="page-problems">
            {problems.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
        )}
      </div>
      <div className="pos-pages__preview-col">
        <div className="pos-toolbar pos-toolbar--dense">
          <div className="pos-tabs" role="tablist">
            {(Object.keys(DEVICES) as Device[]).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={device === d}
                className={`pos-tabs__tab${device === d ? " pos-tabs__tab--active" : ""}`}
                data-testid={`device-${d}`}
                title={`${DEVICES[d].width} px`}
                onClick={() => onDevice(d)}
              >
                {DEVICES[d].label}
              </button>
            ))}
          </div>
          <span className="pos-toolbar__status">
            {DEVICES[device].width} × {DEVICES[device].height}
          </span>
          <button
            type="button"
            className={`pos-button pos-button--small${sources ? " pos-button--primary" : ""}`}
            title="Data sources: badge every block with the table and fields it binds; hover a badge to outline its table on the canvas"
            aria-pressed={sources}
            data-testid="pages-sources"
            onClick={() => onSources(!sources)}
          >
            Data sources
          </button>
        </div>
        <DevicePreview
          project={project}
          page={page}
          device={device}
          sources={sources}
          selected={selectedBlock}
          onSelectBlock={onSelectBlock}
          onHoverTable={onHoverTable}
        />
      </div>
      <aside
        className="pos-design__inspector pos-pages__inspector"
        data-testid="page-inspector"
      >
        {block ? (
          <BlockInspector
            block={block}
            def={def}
            page={page}
            design={design}
            onChange={(patch) => patchBlock(block.id, patch)}
            onRemove={() => {
              setBlocks(removeBlock(page.components, block.id));
              onSelectBlock(undefined);
            }}
            onOpenDesign={() => onOpenDesign(block.name)}
          />
        ) : (
          <PageSettings page={page} pages={design.pages} onChange={onSave} />
        )}
      </aside>
    </>
  );
}

function AddMenu({
  components,
  onAdd,
  label = "Add block",
  testId = "add-block",
}: {
  components: ComponentDef[];
  onAdd: (c: ComponentDef) => void;
  label?: string;
  testId?: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ComponentDef[]>();
    for (const c of components) {
      const k = c.category ?? "Other";
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return [...map.entries()];
  }, [components]);
  return (
    <Dropdown label={label} small testId={testId}>
      {groups.map(([category, list]) => (
        <div key={category}>
          <div className="pos-menu__heading">{category}</div>
          {list.map((c) => (
            <MenuItem
              key={c.name}
              label={`${c.icon ?? ""} ${c.name}`.trim()}
              testId={`${testId}-${c.name}`}
              onSelect={() => onAdd(c)}
            />
          ))}
        </div>
      ))}
      {components.length === 0 && (
        <div className="pos-menu__heading">No components</div>
      )}
    </Dropdown>
  );
}

function BlockList(props: {
  blocks: PageBlock[];
  parentId: string | null;
  depth: number;
  columns: number;
  design: DesignModel;
  selected?: string;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string | null) => void;
  onDrop: (target: {
    parentId: string | null;
    beforeId: string | null;
  }) => void;
  onShift: (id: string, delta: -1 | 1) => void;
  onSpan: (id: string, span: number) => void;
  onAddChild: (id: string) => void;
  onAddChildOf: (id: string, c: ComponentDef) => void;
  onRemove: (id: string) => void;
}) {
  const { blocks, parentId, depth, design } = props;
  return (
    <div className="pos-blocks" data-depth={depth}>
      {blocks.map((b) => {
        const def = design.components.find((c) => c.name === b.name);
        const container = def?.slots.includes("children") ?? false;
        const selected = props.selected === b.id;
        return (
          <div key={b.id} className="pos-blocks__group">
            <div
              className={`pos-block${selected ? " pos-block--selected" : ""}${props.dragId === b.id ? " pos-block--dragging" : ""}${def ? "" : " pos-block--missing"}`}
              data-testid={`block-${b.id}`}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                props.onDragStart(b.id);
              }}
              onDragEnd={() => props.onDragStart(null)}
              onDragOver={(e) => {
                if (props.dragId && props.dragId !== b.id) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.onDrop({ parentId, beforeId: b.id });
              }}
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect(b.id);
              }}
            >
              <span className="pos-block__grip" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="pos-block__icon" aria-hidden="true">
                {def?.icon ?? "?"}
              </span>
              <span className="pos-block__name">
                {b.name}
                {b.variant && <small> · {b.variant}</small>}
                {b.bindings?.[0] && (
                  <small className="pos-block__bind">
                    {" "}
                    ⇐ {b.bindings[0].table}
                  </small>
                )}
              </span>
              <span
                className="pos-block__span"
                style={{ ["--span" as string]: b.span / props.columns }}
                title={`${b.span} of ${props.columns} columns`}
              >
                <select
                  className="pos-select pos-block__span-select"
                  value={b.span}
                  aria-label="Columns"
                  data-testid={`block-span-${b.id}`}
                  onChange={(e) => props.onSpan(b.id, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Array.from({ length: props.columns }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}/{props.columns}
                      </option>
                    )
                  )}
                </select>
              </span>
              <span className="pos-block__actions">
                <button
                  type="button"
                  className="pos-block__button"
                  title="Move up"
                  aria-label="Move up"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onShift(b.id, -1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="pos-block__button"
                  title="Move down"
                  aria-label="Move down"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onShift(b.id, 1);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="pos-block__button pos-block__button--danger"
                  title="Remove block"
                  aria-label="Remove block"
                  data-testid={`block-remove-${b.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemove(b.id);
                  }}
                >
                  ×
                </button>
              </span>
            </div>
            {container && (
              <div
                className="pos-blocks__children"
                onDragOver={(e) => {
                  if (props.dragId && props.dragId !== b.id) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onDrop({ parentId: b.id, beforeId: null });
                }}
              >
                <BlockList
                  {...props}
                  blocks={b.children ?? []}
                  parentId={b.id}
                  depth={depth + 1}
                />
                <div
                  className="pos-blocks__add-child"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AddMenu
                    components={design.components}
                    label="+ child"
                    testId={`add-child-${b.id}`}
                    onAdd={(c) => props.onAddChildOf(b.id, c)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {props.dragId && (
        <div
          className="pos-blocks__dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onDrop({ parentId, beforeId: null });
          }}
        >
          drop here
        </div>
      )}
    </div>
  );
}

function BlockInspector({
  block,
  def,
  page,
  design,
  onChange,
  onRemove,
  onOpenDesign,
}: {
  block: PageBlock;
  def?: ComponentDef;
  page: PageDef;
  design: DesignModel;
  onChange: (patch: Partial<PageBlock> | ((b: PageBlock) => PageBlock)) => void;
  onRemove: () => void;
  onOpenDesign: () => void;
}) {
  const binding = block.bindings?.[0];
  const bindable = def?.props.some((p) => p.type === "table") ?? true;
  const table = design.schema.tables.find((t) => t.name === binding?.table);
  const setBinding = (
    patch: Partial<NonNullable<PageBlock["bindings"]>[number]> | null
  ) =>
    onChange((b) => {
      if (patch === null) {
        const { bindings: _drop, ...rest } = b;
        void _drop;
        return rest;
      }
      const current = b.bindings?.[0] ?? { table: "" };
      const next = { ...current, ...patch };
      if (!next.table) {
        const { bindings: _drop, ...rest } = b;
        void _drop;
        return rest;
      }
      return { ...b, bindings: [next, ...(b.bindings?.slice(1) ?? [])] };
    });
  const parent = parentOf(page.components, block.id);
  return (
    <div>
      <div className="pos-connections__title">
        <strong>{block.name}</strong>
        <span className="pos-connections__muted">
          {block.id}
          {parent ? ` · in ${parent}` : ""}
        </span>
      </div>
      {!def && (
        <div className="pos-design__errors">
          Unknown component. Add{" "}
          <code>design/components/{block.name}.json</code> or pick another.
        </div>
      )}
      <div className="pos-design__actions">
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onOpenDesign}
        >
          Open in Design
        </button>
        <button
          type="button"
          className="pos-button pos-button--small pos-menu__item--danger"
          onClick={onRemove}
          data-testid="inspector-remove"
        >
          Remove
        </button>
      </div>
      <label className="pos-props__row">
        <span className="pos-props__name">
          id<small>block</small>
        </span>
        <input
          className="pos-input"
          value={block.id}
          data-testid="inspector-id"
          onChange={(e) => {
            const id = e.target.value.trim();
            if (
              id &&
              !flattenBlocks(page.components).some(
                (b) => b.id === id && b !== block
              )
            )
              onChange({ id });
          }}
        />
      </label>
      {def && def.variants.length > 0 && (
        <label className="pos-props__row">
          <span className="pos-props__name">
            variant<small>preset</small>
          </span>
          <select
            className="pos-select"
            value={block.variant ?? ""}
            data-testid="inspector-variant"
            onChange={(e) =>
              onChange((b) => {
                const { variant: _v, ...rest } = b;
                void _v;
                return e.target.value
                  ? { ...rest, variant: e.target.value }
                  : rest;
              })
            }
          >
            <option value="">default</option>
            {def.variants.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {bindable && (
        <section className="pos-pages__binding" data-testid="inspector-binding">
          <div className="pos-data__heading">Data binding</div>
          <label className="pos-props__row">
            <span className="pos-props__name">
              table<small>data</small>
            </span>
            <select
              className="pos-select"
              value={binding?.table ?? ""}
              data-testid="binding-table"
              onChange={(e) =>
                e.target.value
                  ? setBinding({ table: e.target.value, fields: [] })
                  : setBinding(null)
              }
            >
              <option value="">(none)</option>
              {design.schema.tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {table && (
            <>
              <div className="pos-props__row">
                <span className="pos-props__name">
                  fields<small>columns</small>
                </span>
                <div className="pos-props__checks" data-testid="binding-fields">
                  {table.columns.map((c) => {
                    const list = binding?.fields ?? [];
                    return (
                      <label key={c.name} className="pos-props__check">
                        <input
                          type="checkbox"
                          checked={list.includes(c.name)}
                          onChange={(e) =>
                            setBinding({
                              fields: e.target.checked
                                ? [...list, c.name]
                                : list.filter((f) => f !== c.name),
                            })
                          }
                        />
                        {c.name}
                        <small>{c.type}</small>
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="pos-props__row">
                <span className="pos-props__name">
                  filter<small>rows</small>
                </span>
                <input
                  className="pos-input"
                  placeholder="e.g. active=true"
                  value={binding?.filter ?? ""}
                  onChange={(e) =>
                    setBinding({ filter: e.target.value || undefined })
                  }
                />
              </label>
              <label className="pos-props__row">
                <span className="pos-props__name">
                  order<small>sort</small>
                </span>
                <input
                  className="pos-input"
                  placeholder="e.g. -created"
                  value={binding?.order ?? ""}
                  onChange={(e) =>
                    setBinding({ order: e.target.value || undefined })
                  }
                />
              </label>
              <label className="pos-props__row">
                <span className="pos-props__name">
                  mode<small>access</small>
                </span>
                <select
                  className="pos-select"
                  value={binding?.mode ?? "read"}
                  onChange={(e) =>
                    setBinding({
                      mode: e.target.value === "write" ? "write" : undefined,
                    })
                  }
                >
                  <option value="read">read</option>
                  <option value="write">write</option>
                </select>
              </label>
            </>
          )}
        </section>
      )}
      {def && (
        <section>
          <div className="pos-data__heading">Props</div>
          <PropEditor
            defs={def.props.filter(
              (p) => !(binding && (p.name === "table" || p.name === "fields"))
            )}
            values={{
              ...Object.fromEntries(def.props.map((p) => [p.name, p.default])),
              ...(binding
                ? { table: binding.table, fields: binding.fields }
                : {}),
              ...block.props,
            }}
            schema={design.schema}
            onChange={(name, value) =>
              onChange((b) => {
                const props = { ...b.props };
                const p = def.props.find((x) => x.name === name);
                if (
                  value === undefined ||
                  (p && JSON.stringify(value) === JSON.stringify(p.default))
                )
                  delete props[name];
                else props[name] = value;
                return { ...b, props };
              })
            }
          />
        </section>
      )}
    </div>
  );
}

function PageSettings({
  page,
  pages,
  onChange,
}: {
  page: PageDef;
  pages: PageDef[];
  onChange: (page: PageDef) => void;
}) {
  const others = pages.filter((p) => p.name !== page.name);
  const setLink = (i: number, patch: Partial<PageLink>) =>
    onChange({
      ...page,
      links: page.links.map((l, k) => (k === i ? { ...l, ...patch } : l)),
    });
  return (
    <div data-testid="page-settings">
      <div className="pos-connections__title">
        <strong>{page.title}</strong>
        <span className="pos-connections__muted">{pagePath(page.name)}</span>
      </div>
      <label className="pos-props__row">
        <span className="pos-props__name">title</span>
        <input
          className="pos-input"
          value={page.title}
          data-testid="page-title"
          onChange={(e) => onChange({ ...page, title: e.target.value })}
        />
      </label>
      <label className="pos-props__row">
        <span className="pos-props__name">route</span>
        <input
          className="pos-input"
          value={page.route}
          onChange={(e) => onChange({ ...page, route: e.target.value })}
        />
      </label>
      <label className="pos-props__row">
        <span className="pos-props__name">
          device<small>hint</small>
        </span>
        <select
          className="pos-select"
          value={page.device ?? ""}
          onChange={(e) => {
            const { device: _d, ...rest } = page;
            void _d;
            onChange(
              e.target.value
                ? { ...rest, device: e.target.value as Device }
                : rest
            );
          }}
        >
          <option value="">any</option>
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <option key={d} value={d}>
              {DEVICES[d].label}
            </option>
          ))}
        </select>
      </label>
      <label className="pos-props__row">
        <span className="pos-props__name">
          columns<small>grid</small>
        </span>
        <input
          className="pos-input"
          type="number"
          min={1}
          max={24}
          value={page.layout.columns}
          onChange={(e) =>
            onChange({
              ...page,
              layout: {
                ...page.layout,
                columns: Math.max(
                  1,
                  Math.min(24, Number(e.target.value) || 12)
                ),
              },
            })
          }
        />
      </label>
      <label className="pos-props__row">
        <span className="pos-props__name">
          gap<small>space</small>
        </span>
        <input
          className="pos-input"
          value={page.layout.gap}
          onChange={(e) =>
            onChange({
              ...page,
              layout: { ...page.layout, gap: e.target.value },
            })
          }
        />
      </label>
      <label className="pos-props__row">
        <span className="pos-props__name">
          max width<small>css</small>
        </span>
        <input
          className="pos-input"
          value={page.layout.maxWidth ?? ""}
          placeholder="1200px"
          onChange={(e) =>
            onChange({
              ...page,
              layout: {
                ...page.layout,
                ...(e.target.value
                  ? { maxWidth: e.target.value }
                  : { maxWidth: undefined }),
              },
            })
          }
        />
      </label>
      <section>
        <div className="pos-data__heading">Links to other pages (UX flow)</div>
        {page.links.map((l, i) => (
          <div key={i} className="pos-pages__link">
            <select
              className="pos-select"
              value={l.to}
              onChange={(e) => setLink(i, { to: e.target.value })}
            >
              {!others.some((p) => p.name === l.to || p.route === l.to) && (
                <option value={l.to}>{l.to}</option>
              )}
              {others.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.title}
                </option>
              ))}
            </select>
            <input
              className="pos-input"
              placeholder="label"
              value={l.label ?? ""}
              onChange={(e) =>
                setLink(i, { label: e.target.value || undefined })
              }
            />
            <select
              className="pos-select"
              value={l.from ?? ""}
              title="From block"
              onChange={(e) =>
                setLink(i, { from: e.target.value || undefined })
              }
            >
              <option value="">(page)</option>
              {flattenBlocks(page.components).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pos-block__button pos-block__button--danger"
              aria-label="Remove link"
              onClick={() =>
                onChange({
                  ...page,
                  links: page.links.filter((_, k) => k !== i),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="pos-button pos-button--small"
          disabled={others.length === 0}
          onClick={() =>
            onChange({
              ...page,
              links: [...page.links, { to: others[0].name }],
            })
          }
        >
          + Link
        </button>
      </section>
      <div className="pos-connections__muted pos-tokens__foot">
        Select a block to edit its props and data binding. Click a block in the
        preview to select it.
      </div>
    </div>
  );
}

/** The page rendered through the bundler at the device's width, scaled to fit. */
function DevicePreview({
  project,
  page,
  device,
  sources,
  selected,
  onSelectBlock,
  onHoverTable,
}: {
  project: string;
  page: PageDef;
  device: Device;
  sources: boolean;
  selected?: string;
  onSelectBlock: (id: string) => void;
  onHoverTable: (table: string | null) => void;
}) {
  const store = getProjectStore();
  const iframe = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [srcdoc, setSrcdoc] = useState("");
  const [scale, setScale] = useState(1);
  const width = DEVICES[device].width;
  const pageText = useMemo(() => serializePage(page), [page]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const session = await store.session(project);
      const paths =
        session?.files
          .get()
          .filter((f) => f.type === "file")
          .map((f) => f.path) ?? [];
      const entry = pagePath(page.name);
      const out = await bundle(
        entry,
        (p) => (p === entry ? pageText : readLiveText(project, p, store)),
        { list: () => paths, markBlocks: true, sources }
      );
      if (!cancelled) setSrcdoc(out.html);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [project, page.name, pageText, store, sources]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 16) / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        e.source !== iframe.current?.contentWindow ||
        !isDesignMessage(e.data)
      )
        return;
      if (e.data.type === "block" && e.data.id) onSelectBlock(e.data.id);
      if (e.data.type === "hover-table") onHoverTable(e.data.table ?? null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectBlock, onHoverTable]);

  // Highlight the selected block inside the frame (a style tag is the only thing we can reach).
  const highlighted = useMemo(
    () =>
      selected
        ? srcdoc.replace(
            "</head>",
            `<style>[data-block="${selected.replace(/"/g, "")}"] { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }</style></head>`
          )
        : srcdoc,
    [srcdoc, selected]
  );

  return (
    <div className="pos-pages__preview" ref={host} data-device={device}>
      <div
        className="pos-pages__device-box"
        style={{ width: width * scale, height: DEVICES[device].height * scale }}
      >
        <div
          className="pos-pages__device"
          style={{
            width,
            height: DEVICES[device].height,
            transform: `scale(${scale})`,
          }}
        >
          <iframe
            ref={iframe}
            className="pos-pages__frame"
            title={`Preview of ${page.title}`}
            sandbox="allow-scripts"
            srcDoc={highlighted}
            data-testid="page-preview"
            style={{ width, height: DEVICES[device].height }}
          />
        </div>
      </div>
    </div>
  );
}
