import { createJsonStore, type JsonStore, type StorageLike } from "./storage";
import { isPreset } from "./presets";
import type { LayoutNode, Workspace } from "./types";

export const WORKSPACES_KEY = "paperos-v2:workspaces";

/** What the desktop captures when saving: everything but the identity fields. */
export type WorkspaceSnapshot = Pick<
  Workspace,
  "preset" | "root" | "windowIds" | "region" | "camera"
>;

interface WorkspaceState {
  version: 1;
  activeId: string | null;
  items: Workspace[];
}

export interface WorkspaceStore {
  list(): Workspace[];
  get(id: string): Workspace | undefined;
  getActiveId(): string | null;
  setActive(id: string | null): void;
  create(name: string, snapshot: WorkspaceSnapshot): Workspace;
  /** Overwrites the arrangement of an existing workspace. */
  save(id: string, snapshot: WorkspaceSnapshot): Workspace | undefined;
  rename(id: string, name: string): void;
  duplicate(id: string): Workspace | undefined;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export function newWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The two workspaces a fresh install starts with. */
export function defaultWorkspaces(now = Date.now()): Workspace[] {
  const base = {
    root: null,
    windowIds: [],
    region: null,
    camera: null,
    createdAt: now,
    updatedAt: now,
  };
  return [
    { ...base, id: "ws_desk", name: "Desk", preset: "free" },
    { ...base, id: "ws_grid", name: "Grid", preset: "grid" },
  ];
}

function isRect(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    ["x", "y", "w", "h"].every(
      (k) => typeof (v as Record<string, unknown>)[k] === "number"
    )
  );
}

function isNode(v: unknown): v is LayoutNode {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  if (typeof n.id !== "string") return false;
  if (n.type === "leaf") return typeof n.windowId === "string";
  if (!Array.isArray(n.children) || !n.children.every(isNode)) return false;
  if (n.type === "split") {
    return (
      (n.direction === "horizontal" || n.direction === "vertical") &&
      Array.isArray(n.ratios) &&
      n.ratios.length === n.children.length &&
      n.ratios.every((r) => typeof r === "number" && r > 0)
    );
  }
  return (
    n.type === "grid" &&
    typeof n.rows === "number" &&
    typeof n.cols === "number"
  );
}

export function parseWorkspace(raw: unknown): Workspace | null {
  if (typeof raw !== "object" || raw === null) return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.id !== "string" || typeof w.name !== "string") return null;
  if (typeof w.preset !== "string" || !isPreset(w.preset)) return null;
  const root = w.root === null || w.root === undefined ? null : w.root;
  if (root !== null && !isNode(root)) return null;
  const windowIds = Array.isArray(w.windowIds)
    ? w.windowIds.filter((x): x is string => typeof x === "string")
    : [];
  const camera = w.camera as Record<string, unknown> | null | undefined;
  const cameraOk =
    camera &&
    typeof camera.x === "number" &&
    typeof camera.y === "number" &&
    typeof camera.z === "number";
  return {
    id: w.id,
    name: w.name,
    preset: w.preset,
    root,
    windowIds,
    region: isRect(w.region) ? (w.region as Workspace["region"]) : null,
    camera: cameraOk ? (camera as unknown as Workspace["camera"]) : null,
    createdAt: typeof w.createdAt === "number" ? w.createdAt : Date.now(),
    updatedAt: typeof w.updatedAt === "number" ? w.updatedAt : Date.now(),
  };
}

function parseState(raw: unknown): WorkspaceState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1 || !Array.isArray(s.items)) return null;
  const items = s.items
    .map(parseWorkspace)
    .filter((w): w is Workspace => w !== null);
  const activeId =
    typeof s.activeId === "string" && items.some((w) => w.id === s.activeId)
      ? s.activeId
      : null;
  return { version: 1, activeId, items };
}

export function createWorkspaceStore(
  storage: StorageLike | null,
  key: string = WORKSPACES_KEY,
  now: () => number = Date.now
): WorkspaceStore {
  const store: JsonStore<WorkspaceState> = createJsonStore(
    storage,
    key,
    () => ({ version: 1, activeId: null, items: defaultWorkspaces(now()) }),
    parseState
  );

  const patch = (id: string, fn: (w: Workspace) => Workspace) =>
    store.update((s) => ({
      ...s,
      items: s.items.map((w) => (w.id === id ? fn(w) : w)),
    }));

  return {
    list: () => store.get().items,
    get: (id) => store.get().items.find((w) => w.id === id),
    getActiveId: () => store.get().activeId,
    setActive(id) {
      store.update((s) => ({ ...s, activeId: id }));
    },
    create(name, snapshot) {
      const t = now();
      const ws: Workspace = {
        id: newWorkspaceId(),
        name: name.trim() || "Workspace",
        ...snapshot,
        createdAt: t,
        updatedAt: t,
      };
      store.update((s) => ({ ...s, activeId: ws.id, items: [...s.items, ws] }));
      return ws;
    },
    save(id, snapshot) {
      if (!this.get(id)) return undefined;
      patch(id, (w) => ({ ...w, ...snapshot, updatedAt: now() }));
      return this.get(id);
    },
    rename(id, name) {
      const clean = name.trim();
      if (!clean) return;
      patch(id, (w) => ({ ...w, name: clean, updatedAt: now() }));
    },
    duplicate(id) {
      const source = this.get(id);
      if (!source) return undefined;
      const t = now();
      const copy: Workspace = {
        ...source,
        id: newWorkspaceId(),
        name: `${source.name} copy`,
        createdAt: t,
        updatedAt: t,
      };
      store.update((s) => {
        const at = s.items.findIndex((w) => w.id === id);
        const items = [...s.items];
        items.splice(at + 1, 0, copy);
        return { ...s, items };
      });
      return copy;
    },
    remove(id) {
      store.update((s) => ({
        ...s,
        activeId: s.activeId === id ? null : s.activeId,
        items: s.items.filter((w) => w.id !== id),
      }));
    },
    subscribe: (l) => store.subscribe(l),
  };
}
