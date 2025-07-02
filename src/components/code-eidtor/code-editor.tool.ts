import { StateNode } from "tldraw";
import { ICodeEditorShape } from "./code-editor.component";

// Check out the custom tool example for a more detailed explanation of the tool class.

const OFFSET = 12;
export class CodeEditorTool extends StateNode {
  static override id = "code-editor-tool";

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onPointerDown() {
    const { currentPagePoint } = this.editor.inputs;
    this.editor.createShape<ICodeEditorShape>({
      type: "code-editor-shape",
      x: currentPagePoint.x - OFFSET,
      y: currentPagePoint.y - OFFSET,
      props: {
        w: 530,
        h: 300,
      },
    });
  }
}
