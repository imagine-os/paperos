import type { LayoutLeaf, LayoutNode, LayoutSplit, WindowId } from "./types";

let counter = 0;

/** Ids only need to be unique within one tree; keep them short and readable. */
export function nodeId(prefix = "n"): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function leaf(windowId: WindowId): LayoutLeaf {
  return { type: "leaf", id: nodeId("l"), windowId };
}

export function split(
  direction: LayoutSplit["direction"],
  children: LayoutNode[],
  ratios?: number[]
): LayoutSplit {
  return {
    type: "split",
    id: nodeId("s"),
    direction,
    children,
    ratios: ratios ?? equalRatios(children.length),
  };
}

export function equalRatios(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

export function normalizeRatios(ratios: number[]): number[] {
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalRatios(ratios.length);
  return ratios.map((r) => r / sum);
}

export function findNode(
  root: LayoutNode | null,
  id: string
): LayoutNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  if (root.type === "leaf") return null;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export function findParent(
  root: LayoutNode | null,
  id: string
): LayoutSplit | Extract<LayoutNode, { type: "grid" }> | null {
  if (!root || root.type === "leaf") return null;
  for (const child of root.children) {
    if (child.id === id) return root;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return null;
}

export function findLeaf(
  root: LayoutNode | null,
  windowId: WindowId
): LayoutLeaf | null {
  if (!root) return null;
  if (root.type === "leaf") return root.windowId === windowId ? root : null;
  for (const child of root.children) {
    const hit = findLeaf(child, windowId);
    if (hit) return hit;
  }
  return null;
}

/** Window ids in depth-first (reading) order. */
export function collectWindowIds(root: LayoutNode | null): WindowId[] {
  if (!root) return [];
  if (root.type === "leaf") return [root.windowId];
  return root.children.flatMap(collectWindowIds);
}

export function collectLeaves(root: LayoutNode | null): LayoutLeaf[] {
  if (!root) return [];
  if (root.type === "leaf") return [root];
  return root.children.flatMap(collectLeaves);
}

/** Replaces the node with `id` by whatever `fn` returns (null removes it). */
export function replaceNode(
  root: LayoutNode | null,
  id: string,
  fn: (node: LayoutNode) => LayoutNode | null
): LayoutNode | null {
  if (!root) return null;
  if (root.id === id) return fn(root);
  if (root.type === "leaf") return root;
  const children: LayoutNode[] = [];
  const ratios: number[] = [];
  root.children.forEach((child, i) => {
    const next = replaceNode(child, id, fn);
    if (next) {
      children.push(next);
      if (root.type === "split") ratios.push(root.ratios[i]);
    }
  });
  if (root.type === "split") {
    return { ...root, children, ratios: normalizeRatios(ratios) };
  }
  return { ...root, children };
}

/**
 * Removes empty containers and unwraps containers with a single child, so
 * every operation leaves a minimal tree behind. Returns null for an empty tree.
 */
export function normalize(root: LayoutNode | null): LayoutNode | null {
  if (!root || root.type === "leaf") return root;
  const children = root.children
    .map(normalize)
    .filter((c): c is LayoutNode => c !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  if (root.type === "split") {
    // Keep ratios of the children that survived.
    const kept = root.children
      .map((c, i) => (normalize(c) ? root.ratios[i] : null))
      .filter((r): r is number => r !== null);
    return {
      ...root,
      children,
      ratios:
        kept.length === children.length
          ? normalizeRatios(kept)
          : equalRatios(children.length),
    };
  }
  return { ...root, children, rows: gridRows(children.length, root.cols) };
}

export function gridRows(count: number, cols: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, cols)));
}

/** Keeps only leaves whose window is in `keep`. */
export function pruneTree(
  root: LayoutNode | null,
  keep: ReadonlySet<WindowId>
): LayoutNode | null {
  const prune = (node: LayoutNode): LayoutNode | null => {
    if (node.type === "leaf") return keep.has(node.windowId) ? node : null;
    const children: LayoutNode[] = [];
    const ratios: number[] = [];
    node.children.forEach((c, i) => {
      const next = prune(c);
      if (next) {
        children.push(next);
        if (node.type === "split") ratios.push(node.ratios[i]);
      }
    });
    if (node.type === "split") {
      return { ...node, children, ratios: normalizeRatios(ratios) };
    }
    return { ...node, children };
  };
  return normalize(root ? prune(root) : null);
}
