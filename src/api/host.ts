/**
 * What the Canvas API facade needs from the app. The browser implementation
 * (`browser-host.ts`) sits on tldraw, the window manager and the IDE stores;
 * tests use a fake. Everything here speaks in plain values (no tldraw
 * records, no atoms), which is what keeps the facade testable in Node.
 */
import type { BindingIndex } from "@/data/bindings";
import type { Renames } from "@/data/migrate";
import type { QueryOptions, QueryResult } from "@/data/query";
import type { DataSchema, Row, RowId } from "@/data/schema";
import type { TableInfo } from "@/data/store";
import type { LayoutNode, LayoutPreset, Rect, Side } from "@/wm/types";

export interface WindowRecord {
  id: string;
  kind: string;
  title: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tiled: boolean;
}

export interface CameraRecord {
  x: number;
  y: number;
  z: number;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  preset: LayoutPreset;
  windowIds: string[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  source: string;
  backend: string;
}

export interface FileRecord {
  path: string;
  type: "file" | "dir";
}

export interface CommandRecord {
  id: string;
  title: string;
  group: string;
  shortcut?: string;
}

export interface CanvasHost {
  windows: {
    list(): WindowRecord[];
    get(id: string): WindowRecord | undefined;
    kinds(): string[];
    create(options: {
      kind: string;
      title?: string;
      content?: string;
      at?: { x: number; y: number };
      size?: { w: number; h: number };
    }): string;
    update(
      id: string,
      patch: Partial<
        Pick<WindowRecord, "title" | "content" | "x" | "y" | "w" | "h">
      >
    ): void;
    close(id: string): void;
    focus(id: string): void;
    focusedId(): string | null;
  };
  layout: {
    preset(): LayoutPreset;
    root(): LayoutNode | null;
    region(): Rect | null;
    applyPreset(preset: LayoutPreset): void;
    tile(id: string, side?: Side, targetId?: string): void;
    tileAll(): void;
    float(id: string): void;
    untileAll(): void;
    swap(a: string, b: string): void;
  };
  workspaces: {
    list(): WorkspaceRecord[];
    activeId(): string | null;
    save(name: string): WorkspaceRecord;
    apply(id: string): void;
    rename(id: string, name: string): void;
    remove(id: string): void;
  };
  projects: {
    list(): ProjectRecord[];
    activeId(): string | null;
    setActive(id: string): Promise<void>;
    openSample(): Promise<ProjectRecord>;
    importGithub(url: string): Promise<ProjectRecord>;
  };
  files: {
    list(project: string): Promise<FileRecord[]>;
    read(project: string, path: string): Promise<string>;
    /** Writes through the shared document (open editors update) and saves. */
    write(project: string, path: string, text: string): Promise<void>;
    create(project: string, path: string, text: string): Promise<void>;
    remove(project: string, path: string): Promise<void>;
    rename(project: string, from: string, to: string): Promise<void>;
    open(project: string, path: string, kind: "editor" | "markdown"): string;
  };
  data: {
    tables(project: string): Promise<TableInfo[]>;
    schema(
      project: string
    ): Promise<{ tables: DataSchema["tables"]; errors: string[] }>;
    /** Writes the schema and migrates rows; returns the steps taken (described). */
    setSchema(
      project: string,
      schema: DataSchema,
      renames?: Renames
    ): Promise<string[]>;
    list(
      project: string,
      table: string,
      options: QueryOptions
    ): Promise<QueryResult>;
    get(project: string, table: string, id: RowId): Promise<Row | null>;
    insert(project: string, table: string, row: Row): Promise<Row>;
    update(project: string, table: string, id: RowId, patch: Row): Promise<Row>;
    remove(
      project: string,
      table: string,
      id: RowId,
      onReferences?: "block" | "nullify" | "cascade"
    ): Promise<{
      deleted: boolean;
      affected: { table: string; column: string; count: number }[];
    }>;
    bindings(project: string): Promise<BindingIndex>;
    open(
      project: string,
      table: string | undefined,
      kind: "data" | "schema" | "connections"
    ): string;
  };
  preview: {
    reload(): number;
    setEntry(path: string): number;
  };
  console: {
    log(level: string, text: string): void;
    clear(): void;
  };
  commands: {
    list(): CommandRecord[];
    run(id: string, args?: Record<string, unknown>): Promise<boolean>;
  };
  canvas: {
    camera(): CameraRecord;
    setCamera(camera: CameraRecord): void;
    zoomTo(ids: string[]): void;
    screenshot(
      ids: string[],
      scale: number
    ): Promise<{ dataUrl: string; width: number; height: number }>;
  };
}
