import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
} from "tldraw";
import React, { useCallback, useEffect, useState } from "react";

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

export type ICodeEditorShape = TLBaseShape<
  "code-editor-shape",
  { w: number; h: number }
>;

export class codeEditorShape extends BaseBoxShapeUtil<ICodeEditorShape> {
  static override type = "code-editor-shape" as const;
  static override props: RecordProps<ICodeEditorShape> = {
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): ICodeEditorShape["props"] {
    return { w: 530, h: 530 };
  }

  component(shape: ICodeEditorShape) {
    const [element, setElement] = useState<HTMLElement>();
    const [editorView, setEditorView] = useState<EditorView | null>(null);
    const room = useRoom();
    const provider = getYjsProviderForRoom(room);

    const ref = useCallback((node: HTMLElement | null) => {
      if (!node) return;
      setElement(node);
    }, []);

    // Set up Liveblocks Yjs provider and attach CodeMirror editor
    useEffect(() => {
      if (!element) {
        return;
      }

      // Create Yjs provider and document
      const ydoc = provider.getYDoc();
      const ytext = ydoc.getText("codemirror");
      const undoManager = new Y.UndoManager(ytext);
      // setYUndoManager(undoManager);

      // Attach user info to Yjs
      provider.awareness.setLocalStateField("user", {
        name: "nomad",
        color: "#000000",
        colorLight: "#00000080", // 6-digit hex code at 50% opacity
      });

      // Set up CodeMirror and extensions
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          javascript(),
          yCollab(ytext, provider.awareness, { undoManager }),
        ],
      });

      // Attach CodeMirror to element
      const view = new EditorView({ state, parent: element });
      setEditorView(view);

      return () => {
        view?.destroy();
        setEditorView(null);3
      };
    }, [element]);

    return (
      <HTMLContainer style={{ pointerEvents: "all" }}>
        <div
          style={{
            width: shape.props.w,
            height: shape.props.h,
            border: "1px solid #ccc",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px",
              backgroundColor: "#f5f5f5",
              borderBottom: "1px solid #ccc",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Code Editor
          </div>
          <div 
            ref={ref} 
            style={{ height: "calc(100% - 40px)" }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={() => {
              // Focus the editor when clicked
              if (editorView) {
                editorView.focus();
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: ICodeEditorShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
