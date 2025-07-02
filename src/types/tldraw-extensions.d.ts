import { ICodeEditorShape } from '@/components/code-eidtor/code-editor.component';
import { IMyInteractiveShape } from '@/components/custom-shapes/shape.component';

declare module 'tldraw' {
  interface TLShape {
    'code-editor-shape': ICodeEditorShape;
    'my-interactive-shape': IMyInteractiveShape;
  }
}