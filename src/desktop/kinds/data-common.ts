"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor, TLShapeId } from "tldraw";
import { getDataStore } from "@/data/project-fs";
import { newTable } from "@/data/schema";
import type { DataStore } from "@/data/store";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { getWindowManager } from "@/wm/window-manager";
import { createWindow } from "../create-window";
import type { WindowShape } from "../window-shape";

/** The active project's DataStore and a tick that bumps when its data changes. */
export function useActiveData(): {
  project: string | null;
  store: DataStore | null;
  tick: number;
} {
  const projects = getProjectStore();
  const state = useSignal(projects.state);
  const project = state.activeId;
  const store = project ? getDataStore(project, projects) : null;
  const tick = useSignal(store?.changed ?? ZERO);
  useEffect(() => {
    projects.init();
  }, [projects]);
  return { project, store, tick };
}

const ZERO = {
  get: () => 0,
  set() {},
  update() {},
  subscribe: () => () => {},
} as const;

/** Runs an async producer whenever `deps` change and keeps the latest result (stale results are dropped). */
export function useAsyncValue<T>(
  producer: () => Promise<T>,
  deps: unknown[],
  initial: T
): { value: T; error: string | null; loading: boolean } {
  const [value, setValue] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    producer().then(
      (v) => {
        if (seq.current !== n) return;
        setValue(v);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (seq.current !== n) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { value, error, loading };
}

/** What a Data window keeps in `content`. */
export interface DataWindowContent {
  table?: string;
  filter?: string;
}

/** What a Connections window keeps in `content`. */
export interface ConnectionsContent {
  table?: string;
  source?: string;
}

export function parseContent<T extends object>(content: string): T {
  if (!content) return {} as T;
  try {
    const v = JSON.parse(content);
    return typeof v === "object" && v !== null ? (v as T) : ({} as T);
  } catch {
    // A bare table name.
    return { table: content } as unknown as T;
  }
}

function windowsOfKind(editor: Editor, kind: string): WindowShape[] {
  return editor
    .getCurrentPageShapes()
    .filter(
      (s): s is WindowShape =>
        s.type === "window" && (s as WindowShape).props.kind === kind
    );
}

/**
 * Opens (or reuses) a window of `kind` with `content`: the focused window of
 * that kind, else the first one, else a new one that joins the layout when
 * one is active.
 */
export function openKindWindow(
  editor: Editor,
  kind: string,
  content: object | string,
  options: { title?: string; reuse?: boolean } = {}
): TLShapeId {
  const wm = getWindowManager(editor);
  const text = typeof content === "string" ? content : JSON.stringify(content);
  const existing = windowsOfKind(editor, kind);
  const focused = wm.getFocusedId();
  const target =
    options.reuse === false
      ? undefined
      : (existing.find((w) => w.id === focused) ?? existing[0]);
  if (target) {
    editor.updateShape<WindowShape>({
      id: target.id,
      type: "window",
      props: {
        content: text,
        ...(options.title ? { title: options.title } : {}),
      },
    });
    wm.focusWindow(target.id);
    return target.id;
  }
  const id = createWindow(editor, {
    kind,
    content: text,
    title: options.title,
  });
  if (wm.root.get()) wm.tileWindow(id);
  wm.focusWindow(id);
  return id;
}

export function openDataWindow(
  editor: Editor,
  content: DataWindowContent
): TLShapeId {
  return openKindWindow(editor, "data", content, {
    title: content.table ? `Data: ${content.table}` : "Data",
  });
}

export function openConnectionsWindow(
  editor: Editor,
  content: ConnectionsContent
): TLShapeId {
  return openKindWindow(editor, "connections", content);
}

export function openSchemaWindow(editor: Editor, table?: string): TLShapeId {
  return openKindWindow(editor, "schema", table ? { table } : "");
}

/** Saves text as a download (exports). */
export function downloadText(
  name: string,
  text: string,
  type = "text/plain"
): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lets the user pick a file and resolves with its text (null when cancelled). */
export function pickTextFile(
  accept: string
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, text: await f.text() });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** The table an empty data model starts with: `items` (id, name, done). */
export const FIRST_TABLE = "items";

/**
 * One-click fix for a project without tables: creates `data/schema.json`
 * when it is missing, adds the `items` table and two rows. Returns the
 * table's name.
 */
export async function addFirstTable(store: DataStore): Promise<string> {
  await store.ensureSchema();
  const schema = await store.schema();
  if (schema.tables.some((t) => t.name === FIRST_TABLE)) return FIRST_TABLE;
  const table = newTable(FIRST_TABLE);
  table.display = "name";
  table.description = "A starter table. Rename it, add columns in Schema.";
  table.columns.push(
    { name: "name", type: "string", required: true },
    { name: "done", type: "boolean", default: false }
  );
  await store.setSchema({ tables: [...schema.tables, table] });
  await store.insert(FIRST_TABLE, { id: 1, name: "First item", done: true });
  await store.insert(FIRST_TABLE, { id: 2, name: "Second item", done: false });
  return FIRST_TABLE;
}
