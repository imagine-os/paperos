import { insertWindow } from "@/wm/operations";
import { collectWindowIds, findLeaf } from "@/wm/tree";
import type { LayoutNode } from "@/wm/types";

/**
 * Where a new file window goes in an active layout. Editors stack in the
 * editor column: the new window is inserted below the focused tiled editor
 * (or the last tiled editor), so opening many files never squeezes the
 * Files column. Without any tiled editor it goes right of Files (or of
 * `anchorId`), and with nothing to anchor to it joins on the right.
 */
export function placeFileWindow(
  root: LayoutNode | null,
  newId: string,
  options: {
    focusedId: string | null;
    /** Ids of windows that are editors, any state. */
    editorIds: string[];
    anchorId: string | null;
  }
): LayoutNode {
  const tiled = new Set(collectWindowIds(root));
  const editors = options.editorIds.filter(
    (id) => tiled.has(id) && id !== newId
  );
  const focused =
    options.focusedId && editors.includes(options.focusedId)
      ? options.focusedId
      : (editors.at(-1) ?? null);
  if (focused) {
    return insertWindow(root, newId, findLeaf(root, focused)!.id, "bottom");
  }
  const anchor =
    options.anchorId && tiled.has(options.anchorId)
      ? findLeaf(root, options.anchorId)!.id
      : null;
  return insertWindow(root, newId, anchor, "right");
}
