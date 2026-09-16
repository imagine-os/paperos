import type { FileEntry, TreeNode } from "./types";
import { ancestors, basename } from "./paths";

/** Builds a sorted tree (folders first, then files, case-insensitive) from flat entries. */
export function buildTree(entries: FileEntry[]): TreeNode[] {
  const dirs = new Map<string, TreeNode>();
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };
  dirs.set("", root);

  const ensureDir = (path: string): TreeNode => {
    const found = dirs.get(path);
    if (found) return found;
    const node: TreeNode = {
      name: basename(path),
      path,
      type: "dir",
      children: [],
    };
    dirs.set(path, node);
    ensureDir(
      path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
    ).children.push(node);
    return node;
  };

  for (const e of entries) {
    if (!e.path) continue;
    for (const a of ancestors(e.path)) ensureDir(a);
    if (e.type === "dir") {
      ensureDir(e.path);
    } else {
      const parent = ensureDir(
        e.path.slice(0, Math.max(0, e.path.lastIndexOf("/")))
      );
      if (!parent.children.some((c) => c.path === e.path)) {
        parent.children.push({
          name: basename(e.path),
          path: e.path,
          type: "file",
          children: [],
        });
      }
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

/** Keeps files whose path contains `query` (case-insensitive) and the folders leading to them. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((n) => {
      if (n.type === "file") return n.path.toLowerCase().includes(q) ? [n] : [];
      const children = walk(n.children);
      return children.length ? [{ ...n, children }] : [];
    });
  return walk(nodes);
}

/** Depth-first list of file paths. */
export function flattenFiles(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.type === "file" ? [n.path] : flattenFiles(n.children)
  );
}
