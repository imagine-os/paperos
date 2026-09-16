import { StateNode, TLEventHandlers } from "tldraw";

export class ProjectBrowserTool extends StateNode {
  static override id = "project-browser-tool";
  static override initial = "idle";
  static override children = () => [Idle];

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onExit() {
    this.editor.setCursor({ type: "default", rotation: 0 });
  }
}

export class Idle extends StateNode {
  static override id = "idle";

  override onPointerDown: TLEventHandlers["onPointerDown"] = (info) => {
    if (info.target === "canvas") {
      const { currentPagePoint } = this.editor.inputs;
      
      this.editor.createShape({
        type: "project-browser-shape",
        x: currentPagePoint.x,
        y: currentPagePoint.y,
        props: {
          w: 300,
          h: 400,
        },
      });

      this.editor.setCurrentTool("select");
    }
  };
}