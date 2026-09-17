/**
 * Immutable operations on a page's block tree, for the Page Builder.
 */
import type { PageBlock } from "./pages";

export function findBlock(blocks: PageBlock[], id: string): PageBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inner = b.children ? findBlock(b.children, id) : null;
    if (inner) return inner;
  }
  return null;
}

/** The id of the block containing `id`, null at the top level, undefined when absent. */
export function parentOf(
  blocks: PageBlock[],
  id: string,
  parent: string | null = null
): string | null | undefined {
  for (const b of blocks) {
    if (b.id === id) return parent;
    if (b.children) {
      const r = parentOf(b.children, id, b.id);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

export function updateBlock(
  blocks: PageBlock[],
  id: string,
  patch: Partial<PageBlock> | ((b: PageBlock) => PageBlock)
): PageBlock[] {
  return blocks.map((b) => {
    if (b.id === id)
      return typeof patch === "function" ? patch(b) : { ...b, ...patch };
    return b.children
      ? { ...b, children: updateBlock(b.children, id, patch) }
      : b;
  });
}

export function removeBlock(blocks: PageBlock[], id: string): PageBlock[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.children ? { ...b, children: removeBlock(b.children, id) } : b
    );
}

/** Inserts `block` under `parentId` (null = top level) at `index` (end when omitted). */
export function insertBlock(
  blocks: PageBlock[],
  block: PageBlock,
  parentId: string | null,
  index?: number
): PageBlock[] {
  if (parentId === null) {
    const list = [...blocks];
    list.splice(index === undefined ? list.length : index, 0, block);
    return list;
  }
  return blocks.map((b) => {
    if (b.id === parentId) {
      const children = [...(b.children ?? [])];
      children.splice(index === undefined ? children.length : index, 0, block);
      return { ...b, children };
    }
    return b.children
      ? { ...b, children: insertBlock(b.children, block, parentId, index) }
      : b;
  });
}

/** Moves a block before `beforeId` (same or another parent), or to the end of `parentId` when beforeId is null. */
export function moveBlock(
  blocks: PageBlock[],
  id: string,
  target: { parentId: string | null; beforeId: string | null }
): PageBlock[] {
  const block = findBlock(blocks, id);
  if (!block || id === target.parentId || id === target.beforeId) return blocks;
  // A block cannot move into its own subtree.
  if (target.parentId && findBlock(block.children ?? [], target.parentId))
    return blocks;
  const without = removeBlock(blocks, id);
  if (target.beforeId === null)
    return insertBlock(without, block, target.parentId);
  const siblings =
    target.parentId === null
      ? without
      : (findBlock(without, target.parentId)?.children ?? []);
  const index = siblings.findIndex((b) => b.id === target.beforeId);
  return insertBlock(
    without,
    block,
    target.parentId,
    index === -1 ? undefined : index
  );
}

/** Swaps a block with its previous or next sibling. */
export function shiftBlock(
  blocks: PageBlock[],
  id: string,
  delta: -1 | 1
): PageBlock[] {
  const parent = parentOf(blocks, id);
  if (parent === undefined) return blocks;
  const siblings =
    parent === null ? blocks : (findBlock(blocks, parent)?.children ?? []);
  const i = siblings.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= siblings.length) return blocks;
  const next = [...siblings];
  [next[i], next[j]] = [next[j], next[i]];
  return parent === null
    ? next
    : updateBlock(blocks, parent, { children: next });
}
