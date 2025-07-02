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
    
    // Get all existing code editor shapes for smart positioning
    const allShapes = this.editor.getCurrentPageShapes();
    const codeEditorShapes = allShapes.filter(s => s.type === 'code-editor-shape');
    
    let newX = currentPagePoint.x - OFFSET;
    let newY = currentPagePoint.y - OFFSET;
    
    // Check if position conflicts with existing editors
    const CASCADE_OFFSET = 30;
    let attempts = 0;
    const maxAttempts = codeEditorShapes.length + 1;
    
    while (attempts < maxAttempts) {
      const hasOverlap = codeEditorShapes.some(shape => {
        const tolerance = 20;
        return Math.abs(shape.x - newX) < tolerance && 
               Math.abs(shape.y - newY) < tolerance;
      });
      
      if (!hasOverlap) break;
      
      // Apply cascade offset
      newX += CASCADE_OFFSET;
      newY += CASCADE_OFFSET;
      attempts++;
    }
    
    this.editor.createShape<ICodeEditorShape>({
      type: "code-editor-shape",
      x: newX,
      y: newY,
      props: {
        w: 530,
        h: 300,
      },
    });
  }
}
