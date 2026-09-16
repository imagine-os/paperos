import { describe, expect, it } from "vitest";
import { leaf, split, collectWindowIds, findParent, findLeaf } from "@/wm/tree";
import type { LayoutNode } from "@/wm/types";
import { placeFileWindow } from "./editor-placement";

/** The IDE tree: Files | Editor | (Preview / Console). */
function ideTree(): LayoutNode {
  return split(
    "horizontal",
    [
      leaf("files"),
      leaf("editor1"),
      split("vertical", [leaf("preview"), leaf("console")]),
    ],
    [0.2, 0.45, 0.35]
  );
}

describe("placeFileWindow", () => {
  it("stacks a new editor under the focused editor instead of widening the row", () => {
    const root = placeFileWindow(ideTree(), "editor2", {
      focusedId: "editor1",
      editorIds: ["editor1", "editor2"],
      anchorId: "files",
    });
    expect(root.type).toBe("split");
    expect((root as { children: unknown[] }).children).toHaveLength(3);
    const column = findParent(root, findLeaf(root, "editor2")!.id)!;
    expect(column.type).toBe("split");
    expect((column as { direction: string }).direction).toBe("vertical");
    expect(collectWindowIds(column)).toEqual(["editor1", "editor2"]);
  });

  it("keeps stacking in the same column for more files", () => {
    let root = placeFileWindow(ideTree(), "editor2", {
      focusedId: "editor1",
      editorIds: ["editor1", "editor2"],
      anchorId: "files",
    });
    root = placeFileWindow(root, "editor3", {
      focusedId: "editor2",
      editorIds: ["editor1", "editor2", "editor3"],
      anchorId: "files",
    });
    const column = findParent(root, findLeaf(root, "editor3")!.id)!;
    expect(collectWindowIds(column)).toEqual(["editor1", "editor2", "editor3"]);
    expect((root as { children: unknown[] }).children).toHaveLength(3);
  });

  it("uses the last tiled editor when the focus is elsewhere, ignoring floating editors", () => {
    const root = placeFileWindow(ideTree(), "editor2", {
      focusedId: "console",
      editorIds: ["floating-editor", "editor1", "editor2"],
      anchorId: "files",
    });
    const column = findParent(root, findLeaf(root, "editor2")!.id)!;
    expect(collectWindowIds(column)).toEqual(["editor1", "editor2"]);
  });

  it("goes right of the anchor when no editor is tiled, else joins on the right", () => {
    const noEditor = split("horizontal", [leaf("files"), leaf("preview")]);
    const root = placeFileWindow(noEditor, "editor1", {
      focusedId: null,
      editorIds: ["editor1"],
      anchorId: "files",
    });
    expect(collectWindowIds(root)).toEqual(["files", "editor1", "preview"]);

    const alone = placeFileWindow(null, "editor1", {
      focusedId: null,
      editorIds: ["editor1"],
      anchorId: null,
    });
    expect(alone).toMatchObject({ type: "leaf", windowId: "editor1" });
  });
});
