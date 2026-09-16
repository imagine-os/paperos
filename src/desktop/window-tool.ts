import { StateNode } from "tldraw";
import { createWindow } from "./create-window";

/** Toolbar tool: click the canvas to open a window there. Shortcut: w. */
export class WindowTool extends StateNode {
  static override id = "window";

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onExit() {
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onPointerDown() {
    const { x, y } = this.editor.inputs.currentPagePoint;
    createWindow(this.editor, { at: { x, y } });
    this.editor.setCurrentTool("select");
  }
}
