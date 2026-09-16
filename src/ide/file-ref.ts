/** What editor and markdown windows keep in their `content` prop: which file they show. */
export interface FileRef {
  project: string;
  path: string;
}

export function encodeFileRef(ref: FileRef): string {
  return JSON.stringify(ref);
}

export function parseFileRef(content: string): FileRef | null {
  if (!content) return null;
  try {
    const v = JSON.parse(content) as Partial<FileRef>;
    if (typeof v.project === "string" && typeof v.path === "string") {
      return { project: v.project, path: v.path };
    }
  } catch {
    // Not a ref (an old note, or empty).
  }
  return null;
}

export function sameRef(a: FileRef | null, b: FileRef | null): boolean {
  return !!a && !!b && a.project === b.project && a.path === b.path;
}
