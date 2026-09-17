"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import {
  componentPath,
  defaultProps,
  DESIGN_README_PATH,
  type ComponentDef,
} from "@/design/components";
import { galleryDocument } from "@/design/gallery";
import { newBlockId, pagePath, parsePage, serializePage } from "@/design/pages";
import { writeDesignFile, type DesignModel } from "@/design/project-design";
import { starterDesignFiles } from "@/design/starter";
import {
  isColor,
  scaleKeys,
  serializeTokens,
  SEMANTIC_COLORS,
  TOKENS_PATH,
  type DesignTokens,
} from "@/design/tokens";
import { readLiveText } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import { resolvedTheme } from "@/ide/theme";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";
import { Dropdown, MenuItem } from "../menu";
import { parseContent } from "./data-common";
import {
  isDesignMessage,
  openPagesWindow,
  useDesign,
  type DesignWindowContent,
} from "./design-common";
import { PropEditor } from "./prop-editor";

const WRITE_DELAY_MS = 250;
const TABS: { id: NonNullable<DesignWindowContent["tab"]>; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "components", label: "Components" },
  { id: "guidelines", label: "Guidelines" },
];

/** The Design System window: tokens, the component gallery and the guidelines. */
export function DesignWindow({ shape, editor, update }: WindowKindProps) {
  const { project, design, loading } = useDesign();
  const content = parseContent<DesignWindowContent>(shape.props.content);
  const tab = content.tab ?? "tokens";
  const appTheme = useSignal(resolvedTheme);
  const theme = content.theme ?? appTheme;
  const set = (patch: Partial<DesignWindowContent>) =>
    update({ content: JSON.stringify({ ...content, ...patch }) });

  const createStarter = async () => {
    if (!project) return;
    for (const [path, text] of Object.entries(starterDesignFiles()))
      await writeDesignFile(project, path, text);
  };

  return (
    <div
      className="pos-design"
      data-testid="design-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <div className="pos-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pos-tabs__tab${tab === t.id ? " pos-tabs__tab--active" : ""}`}
              data-testid={`design-tab-${t.id}`}
              onClick={() => set({ tab: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="pos-toolbar__status">
          {loading && !design ? "Loading…" : ""}
          {design && design.tokenErrors.length > 0 && (
            <span title={design.tokenErrors.join("\n")}>
              {design.tokenErrors.length} token problem
              {design.tokenErrors.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <button
          type="button"
          className="pos-button pos-button--small"
          title="Preview theme"
          data-testid="design-theme"
          onClick={() => set({ theme: theme === "dark" ? "light" : "dark" })}
        >
          {theme === "dark" ? "☀ Light" : "☽ Dark"}
        </button>
      </div>
      {!project && <div className="pos-files__hint">No project is open.</div>}
      {project &&
        design &&
        !design.hasTokens &&
        design.components.length === 0 && (
          <div className="pos-files__hint">
            <p>
              This project has no design system yet. Create{" "}
              <code>design/tokens.json</code>, a starter component library and{" "}
              <code>design/README.md</code>:
            </p>
            <button
              type="button"
              className="pos-button pos-button--primary"
              data-testid="design-create"
              onClick={() => void createStarter()}
            >
              Create design system
            </button>
          </div>
        )}
      {project &&
        design &&
        (design.hasTokens || design.components.length > 0) && (
          <>
            {tab === "tokens" && (
              <TokensTab project={project} design={design} theme={theme} />
            )}
            {tab === "components" && (
              <ComponentsTab
                project={project}
                design={design}
                theme={theme}
                selected={content.component}
                onSelect={(component) => set({ component })}
                onOpenFile={(path) =>
                  openFile(editor, { project, path }, { nearId: shape.id })
                }
                onInsert={(page, block) => {
                  void insertBlock(project, page, block).then(() =>
                    openPagesWindow(editor, { page, block: block.id })
                  );
                }}
              />
            )}
            {tab === "guidelines" && (
              <GuidelinesTab
                design={design}
                onEdit={() =>
                  openFile(
                    editor,
                    { project, path: DESIGN_README_PATH },
                    { nearId: shape.id }
                  )
                }
                onCreate={() =>
                  void writeDesignFile(
                    project,
                    DESIGN_README_PATH,
                    starterDesignFiles()[DESIGN_README_PATH]
                  )
                }
              />
            )}
          </>
        )}
    </div>
  );
}

/** Appends a block to a page file (creating the page when it does not exist). */
async function insertBlock(
  project: string,
  pageName: string,
  block: {
    id: string;
    name: string;
    span: number;
    props: Record<string, unknown>;
  }
): Promise<void> {
  const store = getProjectStore();
  const path = pagePath(pageName);
  const text = await readLiveText(project, path, store);
  const parsed = text === null ? null : parsePage(text, path).page;
  const page = parsed ?? {
    name: pageName,
    title: pageName,
    route: `/${pageName}`,
    layout: { columns: 12, gap: "4" },
    components: [],
    links: [],
    bindings: [],
  };
  page.components = [...page.components, block];
  await writeDesignFile(project, path, serializePage(page));
}

// ----- Tokens -------------------------------------------------------------------

function TokensTab({
  project,
  design,
  theme,
}: {
  project: string;
  design: DesignModel;
  theme: "light" | "dark";
}) {
  const [draft, setDraft] = useState<DesignTokens>(design.tokens);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const fileText = useMemo(
    () => serializeTokens(design.tokens),
    [design.tokens]
  );

  // Follow external edits (an editor, an agent) unless a local write is in flight.
  useEffect(() => {
    if (!dirty.current) setDraft(design.tokens);
  }, [design.tokens]);

  const change = (next: DesignTokens) => {
    setDraft(next);
    dirty.current = true;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      const text = serializeTokens(next);
      const done = () => {
        dirty.current = false;
      };
      if (text === fileText) return done();
      void writeDesignFile(project, TOKENS_PATH, text).then(done, done);
    }, WRITE_DELAY_MS);
  };
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    []
  );

  const setColor = (name: string, scheme: "light" | "dark", value: string) =>
    change({
      ...draft,
      color: {
        ...draft.color,
        [name]: { ...draft.color[name], [scheme]: value },
      },
    });
  const setScale = (
    group: "spacing" | "radius" | "shadow" | "breakpoint",
    key: string,
    value: string
  ) => change({ ...draft, [group]: { ...draft[group], [key]: value } });
  const setType = (
    group: keyof DesignTokens["typography"],
    key: string,
    value: string
  ) =>
    change({
      ...draft,
      typography: {
        ...draft.typography,
        [group]: { ...draft.typography[group], [key]: value },
      },
    });

  const colorNames = [
    ...SEMANTIC_COLORS.filter((c) => draft.color[c]),
    ...Object.keys(draft.color).filter(
      (c) => !(SEMANTIC_COLORS as readonly string[]).includes(c)
    ),
  ];

  const srcdoc = useMemo(
    () =>
      galleryDocument({
        tokens: draft,
        components: design.components.filter((c) =>
          ["Button", "Card", "Badge", "Stat", "Table", "Form", "Hero"].includes(
            c.name
          )
        ),
        schema: design.schema,
        tables: design.tables,
        theme,
      }),
    [draft, design.components, design.schema, design.tables, theme]
  );

  return (
    <div className="pos-design__body">
      <div className="pos-design__panel" data-testid="tokens-panel">
        <section>
          <div className="pos-data__heading">Colors (light / dark)</div>
          {colorNames.map((name) => (
            <div key={name} className="pos-tokens__row">
              <span className="pos-tokens__name">{name}</span>
              {(["light", "dark"] as const).map((scheme) => {
                const v = draft.color[name][scheme];
                return (
                  <span key={scheme} className="pos-tokens__swatch-wrap">
                    <input
                      type="color"
                      className="pos-tokens__swatch"
                      value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#888888"}
                      title={`${name} (${scheme})`}
                      aria-label={`${name} ${scheme}`}
                      data-testid={`token-color-${name}-${scheme}`}
                      onChange={(e) => setColor(name, scheme, e.target.value)}
                    />
                    <input
                      className={`pos-input pos-tokens__value${isColor(v) ? "" : " pos-input--error"}`}
                      value={v}
                      aria-label={`${name} ${scheme} value`}
                      data-testid={`token-text-${name}-${scheme}`}
                      onChange={(e) => setColor(name, scheme, e.target.value)}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </section>
        <section>
          <div className="pos-data__heading">Typography</div>
          {Object.entries(draft.typography.fontFamily).map(([k, v]) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">font {k}</span>
              <input
                className="pos-input pos-tokens__wide"
                value={v}
                style={{ fontFamily: v }}
                onChange={(e) => setType("fontFamily", k, e.target.value)}
              />
            </label>
          ))}
          {scaleKeys(draft.typography.fontSize).map((k) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">size {k}</span>
              <input
                className="pos-input pos-tokens__value"
                value={draft.typography.fontSize[k]}
                onChange={(e) => setType("fontSize", k, e.target.value)}
              />
              <span
                className="pos-tokens__sample"
                style={{ fontSize: draft.typography.fontSize[k] }}
              >
                Aa
              </span>
            </label>
          ))}
          <div className="pos-tokens__inline">
            {Object.entries(draft.typography.fontWeight).map(([k, v]) => (
              <label key={k} className="pos-tokens__mini">
                <span style={{ fontWeight: Number(v) || 400 }}>{k}</span>
                <input
                  className="pos-input pos-tokens__value"
                  value={v}
                  onChange={(e) => setType("fontWeight", k, e.target.value)}
                />
              </label>
            ))}
            {Object.entries(draft.typography.lineHeight).map(([k, v]) => (
              <label key={k} className="pos-tokens__mini">
                <span>line {k}</span>
                <input
                  className="pos-input pos-tokens__value"
                  value={v}
                  onChange={(e) => setType("lineHeight", k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="pos-data__heading">Spacing</div>
          {scaleKeys(draft.spacing).map((k) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">{k}</span>
              <input
                className="pos-input pos-tokens__value"
                value={draft.spacing[k]}
                onChange={(e) => setScale("spacing", k, e.target.value)}
              />
              <span
                className="pos-tokens__bar"
                style={{ width: draft.spacing[k] }}
              />
            </label>
          ))}
        </section>
        <section>
          <div className="pos-data__heading">Radius</div>
          {scaleKeys(draft.radius).map((k) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">{k}</span>
              <input
                className="pos-input pos-tokens__value"
                value={draft.radius[k]}
                onChange={(e) => setScale("radius", k, e.target.value)}
              />
              <span
                className="pos-tokens__radius"
                style={{ borderRadius: draft.radius[k] }}
              />
            </label>
          ))}
        </section>
        <section>
          <div className="pos-data__heading">Shadows</div>
          {scaleKeys(draft.shadow).map((k) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">{k}</span>
              <input
                className="pos-input pos-tokens__wide"
                value={draft.shadow[k]}
                onChange={(e) => setScale("shadow", k, e.target.value)}
              />
              <span
                className="pos-tokens__shadow"
                style={{ boxShadow: draft.shadow[k] }}
              />
            </label>
          ))}
        </section>
        <section>
          <div className="pos-data__heading">Breakpoints</div>
          {Object.entries(draft.breakpoint).map(([k, v]) => (
            <label key={k} className="pos-tokens__row">
              <span className="pos-tokens__name">{k}</span>
              <input
                className="pos-input pos-tokens__value"
                value={v}
                onChange={(e) => setScale("breakpoint", k, e.target.value)}
              />
            </label>
          ))}
        </section>
        <div className="pos-connections__muted pos-tokens__foot">
          Saved to <code>{TOKENS_PATH}</code>; the preview and every page
          follow.
        </div>
      </div>
      <iframe
        className="pos-design__preview"
        title="Token preview"
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        data-testid="tokens-preview"
      />
    </div>
  );
}

// ----- Components -------------------------------------------------------------

function ComponentsTab({
  project,
  design,
  theme,
  selected,
  onSelect,
  onOpenFile,
  onInsert,
}: {
  project: string;
  design: DesignModel;
  theme: "light" | "dark";
  selected?: string;
  onSelect: (name: string | undefined) => void;
  onOpenFile: (path: string) => void;
  onInsert: (
    page: string,
    block: {
      id: string;
      name: string;
      span: number;
      props: Record<string, unknown>;
    }
  ) => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const def = design.components.find((c) => c.name === selected);
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [variant, setVariant] = useState<string | undefined>(undefined);
  const [newPage, setNewPage] = useState("");

  useEffect(() => {
    setProps(def ? defaultProps(def) : {});
    setVariant(undefined);
  }, [def]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        e.source !== iframe.current?.contentWindow ||
        !isDesignMessage(e.data)
      )
        return;
      if (e.data.type === "select" && e.data.name) {
        onSelect(e.data.name);
        if (e.data.variant) setVariant(e.data.variant);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect]);

  const groups = useMemo(() => {
    const map = new Map<string, ComponentDef[]>();
    for (const c of design.components)
      (
        map.get(c.category ?? "Other") ??
        map.set(c.category ?? "Other", []).get(c.category ?? "Other")!
      ).push(c);
    return [...map.entries()];
  }, [design.components]);

  const srcdoc = useMemo(
    () =>
      galleryDocument({
        tokens: design.tokens,
        components: design.components,
        schema: design.schema,
        tables: design.tables,
        theme,
        ...(def ? { only: { name: def.name, props, variant } } : {}),
      }),
    [design, theme, def, props, variant]
  );

  const insert = (pageName: string) => {
    if (!def) return;
    const changed: Record<string, unknown> = {};
    const defaults = defaultProps(def);
    for (const [k, v] of Object.entries(props))
      if (JSON.stringify(v) !== JSON.stringify(defaults[k])) changed[k] = v;
    onInsert(pageName, {
      id: newBlockId(def.name),
      name: def.name,
      span: 12,
      props: changed,
      ...(variant ? { variant } : {}),
    });
  };

  return (
    <div className="pos-design__body">
      <aside
        className="pos-data__tables pos-design__list"
        data-testid="component-list"
      >
        <button
          type="button"
          className={`pos-data__table${!def ? " pos-data__table--active" : ""}`}
          onClick={() => onSelect(undefined)}
        >
          <span className="pos-data__table-name">All components</span>
          <span className="pos-data__count">{design.components.length}</span>
        </button>
        {groups.map(([category, list]) => (
          <div key={category}>
            <div className="pos-data__heading">{category}</div>
            {list.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`pos-data__table${def?.name === c.name ? " pos-data__table--active" : ""}`}
                data-testid={`component-${c.name}`}
                title={c.description}
                onClick={() => onSelect(c.name)}
              >
                <span className="pos-data__table-name">
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </span>
                <span className="pos-data__count">{c.variants.length + 1}</span>
              </button>
            ))}
          </div>
        ))}
        {design.componentErrors.length > 0 && (
          <div
            className="pos-design__errors"
            title={design.componentErrors.join("\n")}
          >
            {design.componentErrors.length} component file problem
            {design.componentErrors.length === 1 ? "" : "s"}
          </div>
        )}
      </aside>
      <iframe
        ref={iframe}
        className="pos-design__preview"
        title="Component gallery"
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        data-testid="component-gallery"
      />
      {def && (
        <aside
          className="pos-design__inspector"
          data-testid="component-inspector"
        >
          <div className="pos-connections__title">
            <strong>{def.name}</strong>
            <span className="pos-connections__muted">{def.description}</span>
          </div>
          <div className="pos-design__actions">
            <Dropdown label="Insert into page" small testId="insert-into-page">
              {design.pages.map((p) => (
                <MenuItem
                  key={p.name}
                  label={`${p.title} (${p.route})`}
                  testId={`insert-into-${p.name}`}
                  onSelect={() => insert(p.name)}
                />
              ))}
              <div className="pos-menu__separator" role="separator" />
              <div className="pos-design__newpage">
                <input
                  className="pos-input"
                  placeholder="new page name"
                  value={newPage}
                  onChange={(e) => setNewPage(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && newPage.trim()) {
                      insert(
                        newPage
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]+/g, "-")
                      );
                      setNewPage("");
                    }
                  }}
                />
              </div>
            </Dropdown>
            <button
              type="button"
              className="pos-button pos-button--small"
              onClick={() => onOpenFile(componentPath(def.name))}
            >
              Open JSON
            </button>
          </div>
          {def.variants.length > 0 && (
            <label className="pos-props__row">
              <span className="pos-props__name">
                variant<small>preset</small>
              </span>
              <select
                className="pos-select"
                value={variant ?? ""}
                onChange={(e) => setVariant(e.target.value || undefined)}
                data-testid="inspector-variant"
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
          <PropEditor
            defs={def.props}
            values={props}
            schema={design.schema}
            onChange={(name, value) =>
              setProps((p) => ({ ...p, [name]: value }))
            }
          />
          {def.slots.length > 0 && (
            <div className="pos-connections__muted">
              Slots: {def.slots.join(", ")}
            </div>
          )}
          <div className="pos-connections__muted pos-tokens__foot">
            {project ? `design/components/${def.name}.json` : ""}
          </div>
        </aside>
      )}
    </div>
  );
}

// ----- Guidelines ---------------------------------------------------------------

function GuidelinesTab({
  design,
  onEdit,
  onCreate,
}: {
  design: DesignModel;
  onEdit: () => void;
  onCreate: () => void;
}) {
  const [html, setHtml] = useState("");
  const text = design.readme;
  useEffect(() => {
    let cancelled = false;
    if (text === null) {
      setHtml("");
      return;
    }
    void (async () => {
      const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import("marked"),
        import("dompurify"),
      ]);
      const raw = await marked.parse(text, { gfm: true, breaks: false });
      if (!cancelled)
        setHtml(DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }));
    })();
    return () => {
      cancelled = true;
    };
  }, [text]);
  if (text === null)
    return (
      <div className="pos-files__hint">
        <p>
          No <code>{DESIGN_README_PATH}</code> yet.
        </p>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onCreate}
        >
          Create guidelines
        </button>
      </div>
    );
  return (
    <div className="pos-design__guidelines">
      <div className="pos-toolbar pos-toolbar--dense">
        <span className="pos-toolbar__path">{DESIGN_README_PATH}</span>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <article
        className="pos-markdown__body"
        data-testid="design-guidelines"
        // Sanitized with DOMPurify above.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
