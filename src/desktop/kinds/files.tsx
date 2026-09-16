"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { closeFileDoc } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import {
  basename,
  buildTree,
  dirname,
  extname,
  filterTree,
  getProjectStore,
  joinPath,
  type FileEntry,
  type ProjectSession,
  type TreeNode,
} from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";
import { Dropdown, MenuItem, MenuSeparator } from "../menu";
import {
  canOpenFolder,
  importGithubProject,
  importZipProject,
  openFolderProject,
  openSampleProject,
} from "../project-actions";

const ICONS: Record<string, string> = {
  html: "\u{1F310}",
  htm: "\u{1F310}",
  css: "\u{1F3A8}",
  js: "\u{1F7E8}",
  mjs: "\u{1F7E8}",
  cjs: "\u{1F7E8}",
  jsx: "⚛",
  ts: "\u{1F7E6}",
  tsx: "⚛",
  json: "\u{1F4E6}",
  md: "\u{1F4DD}",
  markdown: "\u{1F4DD}",
  svg: "\u{1F58C}",
  png: "\u{1F5BC}",
  jpg: "\u{1F5BC}",
  txt: "\u{1F4C4}",
  yml: "⚙",
  yaml: "⚙",
  toml: "⚙",
};

export function fileIcon(path: string): string {
  return ICONS[extname(path)] ?? "\u{1F4C4}";
}

interface ContextTarget {
  path: string;
  type: "file" | "dir";
  x: number;
  y: number;
}

/** File tree of the active project with search, context menu and project switching. */
export function FilesWindow({ shape, editor }: WindowKindProps) {
  const store = getProjectStore();
  const state = useSignal(store.state);
  const [session, setSession] = useState<ProjectSession | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<ContextTarget | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const activeId = state.activeId;

  useEffect(() => {
    store.init();
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      setSession(null);
      return;
    }
    store.session(activeId).then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, [store, activeId, state.projects]);

  const entries = useSignal(session?.files ?? EMPTY_FILES);
  const permission = useSignal(session?.permission ?? GRANTED);
  const tree = useMemo(
    () => filterTree(buildTree(entries), query),
    [entries, query]
  );
  const writable = !!session?.backend?.writable;

  const open = (path: string, kind: "editor" | "markdown" = "editor") => {
    if (!activeId) return;
    openFile(editor, { project: activeId, path }, { kind, nearId: shape.id });
  };

  const toggle = (path: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const contextMenu = (e: React.MouseEvent, node: TreeNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    const box = frameRef.current?.getBoundingClientRect();
    const zoom = editor.getZoomLevel();
    const x = box ? (e.clientX - box.left) / zoom : 0;
    const y = box ? (e.clientY - box.top) / zoom : 0;
    setMenu({ path: node?.path ?? "", type: node?.type ?? "dir", x, y });
  };

  // ----- mutations -----
  const parentDir = (t: ContextTarget) =>
    t.type === "dir" ? t.path : dirname(t.path);

  const newFile = async (t: ContextTarget) => {
    const name = window.prompt("New file name", "untitled.txt");
    if (!name || !activeId) return;
    const path = joinPath(parentDir(t), name);
    await store.createFile(activeId, path, "");
    open(path);
  };

  const newFolder = async (t: ContextTarget) => {
    const name = window.prompt("New folder name", "folder");
    if (!name || !activeId) return;
    await store.createFolder(activeId, joinPath(parentDir(t), name));
  };

  const rename = async (t: ContextTarget) => {
    const name = window.prompt("Rename", basename(t.path));
    if (!name || !activeId || name === basename(t.path)) return;
    const to = joinPath(dirname(t.path), name);
    await store.renameEntry(activeId, t.path, to);
    closeFileDoc(activeId, t.path);
  };

  const remove = async (t: ContextTarget) => {
    if (!activeId || !window.confirm(`Delete "${t.path}"?`)) return;
    await store.deleteEntry(activeId, t.path);
    closeFileDoc(activeId, t.path);
  };

  const project = state.projects.find((p) => p.id === activeId);

  return (
    <div
      ref={frameRef}
      className="pos-files"
      data-testid="files-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
      onContextMenu={(e) => contextMenu(e, null)}
    >
      <div className="pos-toolbar">
        <select
          className="pos-select"
          aria-label="Project"
          data-testid="project-switcher"
          value={activeId ?? ""}
          onChange={(e) => store.setActive(e.target.value)}
        >
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Dropdown label="Open" testId="files-open" small>
          <MenuItem
            label="Open folder..."
            disabled={!canOpenFolder()}
            onSelect={() => void openFolderProject()}
          />
          <MenuItem
            label="Open sample project"
            onSelect={() => void openSampleProject()}
          />
          <MenuItem
            label="Import ZIP..."
            onSelect={() => void importZipProject()}
          />
          <MenuItem
            label="Import GitHub repo..."
            onSelect={() => void importGithubProject()}
          />
          <MenuSeparator />
          <MenuItem
            label="Rename project..."
            disabled={!project}
            onSelect={() => {
              if (!project) return;
              const name = window.prompt("Project name", project.name);
              if (name) store.rename(project.id, name);
            }}
          />
          <MenuItem
            label="Remove project"
            danger
            disabled={!project}
            onSelect={() => {
              if (
                project &&
                window.confirm(`Remove project "${project.name}" from PaperOS?`)
              )
                store.remove(project.id);
            }}
          />
        </Dropdown>
      </div>
      <input
        className="pos-files__search"
        type="search"
        placeholder="Filter files..."
        aria-label="Filter files"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="pos-files__tree" role="tree" data-testid="file-tree">
        {state.status === "loading" && (
          <div className="pos-files__hint">Loading projects...</div>
        )}
        {state.status === "ready" && !project && (
          <div className="pos-files__hint">
            No project. Use Open to add one.
          </div>
        )}
        {project && permission !== "granted" && (
          <div className="pos-files__hint">
            <p>
              PaperOS needs permission to read &quot;{project.name}&quot; again.
            </p>
            <button
              type="button"
              className="pos-button pos-button--primary"
              onClick={() => store.grantAccess(project.id)}
            >
              Grant access
            </button>
          </div>
        )}
        {project &&
          permission === "granted" &&
          tree.length === 0 &&
          entries.length > 0 && (
            <div className="pos-files__hint">
              No files match &quot;{query}&quot;.
            </div>
          )}
        {project &&
          permission === "granted" &&
          entries.length === 0 &&
          session?.backend && (
            <div className="pos-files__hint">
              Empty project. Right-click to add a file.
            </div>
          )}
        <TreeList
          nodes={tree}
          depth={0}
          collapsed={query ? EMPTY_SET : collapsed}
          onToggle={toggle}
          onOpen={(p) => open(p)}
          onContextMenu={contextMenu}
        />
      </div>
      {project && (
        <div className="pos-files__footer" title={project.source}>
          {project.backend === "fsa"
            ? "Folder on disk"
            : sourceLabel(project.source)}
          {!writable && " (read-only)"}
        </div>
      )}
      {menu && (
        <div
          className="pos-menu pos-ctx"
          role="menu"
          data-testid="file-context-menu"
          style={{
            left: Math.max(0, Math.min(menu.x, shape.props.w - 200)),
            top: menu.y,
          }}
          onPointerDown={stopEventPropagation}
          onClick={() => setMenu(null)}
        >
          {menu.type === "file" && (
            <>
              <MenuItem
                label="Open in editor"
                onSelect={() => open(menu.path)}
              />
              {(extname(menu.path) === "md" ||
                extname(menu.path) === "markdown") && (
                <MenuItem
                  label="Open as Markdown"
                  onSelect={() => open(menu.path, "markdown")}
                />
              )}
              <MenuSeparator />
            </>
          )}
          <MenuItem
            label="New file..."
            disabled={!writable}
            onSelect={() => void newFile(menu)}
          />
          <MenuItem
            label="New folder..."
            disabled={!writable}
            onSelect={() => void newFolder(menu)}
          />
          {menu.path && (
            <>
              <MenuItem
                label="Rename..."
                disabled={!writable}
                onSelect={() => void rename(menu)}
              />
              <MenuItem
                label="Delete"
                danger
                disabled={!writable}
                onSelect={() => void remove(menu)}
              />
            </>
          )}
        </div>
      )}
      {menu && <CloseOnOutside onClose={() => setMenu(null)} />}
    </div>
  );
}

const NO_FILES: FileEntry[] = [];
const EMPTY_FILES = {
  get: () => NO_FILES,
  set() {},
  update() {},
  subscribe: () => () => {},
} as const;
const GRANTED = {
  get: () => "granted" as const,
  set() {},
  update() {},
  subscribe: () => () => {},
} as const;
const EMPTY_SET = new Set<string>();

function sourceLabel(source: string): string {
  if (source === "sample") return "Sample project (in this browser)";
  if (source === "zip") return "Imported ZIP (in this browser)";
  if (source === "drop") return "Dropped files (in this browser)";
  if (source.startsWith("github:"))
    return `GitHub ${source.slice(7)} (in this browser)`;
  return source;
}

function TreeList({
  nodes,
  depth,
  collapsed,
  onToggle,
  onOpen,
  onContextMenu,
}: {
  nodes: TreeNode[];
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isDir = node.type === "dir";
        const closed = isDir && collapsed.has(node.path);
        return (
          <div key={node.path} role="none">
            <button
              type="button"
              role="treeitem"
              aria-expanded={isDir ? !closed : undefined}
              aria-selected={false}
              className={`pos-files__row pos-files__row--${node.type}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              data-path={node.path}
              title={node.path}
              onClick={() => (isDir ? onToggle(node.path) : onOpen(node.path))}
              onContextMenu={(e) => onContextMenu(e, node)}
            >
              <span className="pos-files__icon" aria-hidden="true">
                {isDir ? (closed ? "▸" : "▾") : fileIcon(node.path)}
              </span>
              <span className="pos-files__name">{node.name}</span>
            </button>
            {isDir && !closed && (
              <TreeList
                nodes={node.children}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                onOpen={onOpen}
                onContextMenu={onContextMenu}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/** Closes a popup on any pointer down outside it or Escape. */
function CloseOnOutside({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".pos-ctx")) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [onClose]);
  return null;
}
