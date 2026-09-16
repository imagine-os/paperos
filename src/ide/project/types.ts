export type BackendKind = "memory" | "fsa";

export interface ProjectMeta {
  id: string;
  name: string;
  backend: BackendKind;
  /** Where the project came from, for display: "sample", "zip", "github:owner/repo", "folder", "drop". */
  source: string;
  createdAt: number;
  updatedAt: number;
}

export type EntryType = "file" | "dir";

export interface FileEntry {
  path: string;
  type: EntryType;
}

/** A file tree node built from a flat entry list. */
export interface TreeNode {
  name: string;
  path: string;
  type: EntryType;
  children: TreeNode[];
}

/**
 * What a project's files live in. Every method takes normalized paths.
 * `writable` is false for read-only imports; the UI hides mutations then.
 */
export interface ProjectBackend {
  readonly kind: BackendKind;
  readonly writable: boolean;
  list(): Promise<FileEntry[]>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Files handed to the memory backend on import: path -> text. */
export type FileMap = Record<string, string>;
