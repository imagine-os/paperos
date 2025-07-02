import { ICodeEditorShape } from '@/components/code-eidtor/code-editor.component';

declare module 'tldraw' {
  interface TLShape {
    'code-editor-shape': ICodeEditorShape;
  }
}