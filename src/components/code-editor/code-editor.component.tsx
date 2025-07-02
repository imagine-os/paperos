import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  Editor,
} from "tldraw";
import React, { useCallback, useEffect, useState } from "react";

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

export type ICodeEditorShape = TLBaseShape<
  "code-editor-shape",
  {
    w: number;
    h: number;
    fileName?: string;
    content?: string;
    showPreview?: boolean;
    previewWidth?: number;
    language?: string;
  }
>;

const CodeEditorComponent = ({
  shape,
  editor,
}: {
  shape: ICodeEditorShape;
  editor: Editor;
}) => {
  const [element, setElement] = useState<HTMLElement>();
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isResizing, setIsResizing] = useState(false);
  const room = useRoom();
  const provider = getYjsProviderForRoom(room);

  // Debug logging
  React.useEffect(() => {
    console.log("CodeEditorComponent shape:", shape);
    console.log("Shape id:", shape?.id);
    console.log("Shape props:", shape?.props);
  }, [shape]);

  const detectLanguage = (content: string): string => {
    const htmlPattern = /<\/?[a-z][\s\S]*>/i;
    return htmlPattern.test(content.trim()) ? "html" : "javascript";
  };

  const togglePreview = () => {
    if (!shape || !shape.id || !shape.type) {
      console.error("Shape, shape.id, or shape.type is undefined", { shape });
      return;
    }
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, showPreview: !shape.props.showPreview },
    });
  };

  const handleClose = () => {
    if (!shape || !shape.id) {
      console.error("Shape or shape.id is undefined in handleClose", { shape });
      return;
    }
    editor.deleteShape(shape.id);
  };

  const handleResize = (clientX: number) => {
    if (!shape || !shape.id || !shape.type) {
      console.error(
        "Shape, shape.id, or shape.type is undefined in handleResize",
        { shape }
      );
      return;
    }
    const containerWidth = shape.props.w;
    const newPreviewWidth = Math.max(
      150,
      Math.min(
        containerWidth - 150,
        containerWidth - clientX + shape.props.w / 2
      )
    );
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, previewWidth: newPreviewWidth },
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        handleResize(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const isHtml = detectLanguage(currentContent) === "html";
  const showPreview = shape?.props?.showPreview && isHtml;
  const previewWidth =
    shape?.props?.previewWidth || (shape?.props?.w || 530) * 0.5;

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

    // Initialize with content if provided, otherwise use ytext
    const initialContent = shape?.props?.content || ytext.toString();
    if (shape?.props?.content && ytext.toString() === "") {
      ytext.insert(0, shape.props.content);
    }
    setCurrentContent(initialContent);

    // Set up CodeMirror and extensions
    const languageExtension =
      detectLanguage(initialContent) === "html" ? html() : javascript();
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setCurrentContent(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        languageExtension,
        yCollab(ytext, provider.awareness, { undoManager }),
        updateListener,
      ],
    });

    // Attach CodeMirror to element
    const view = new EditorView({ state, parent: element });
    setEditorView(view);

    return () => {
      view?.destroy();
      setEditorView(null);
    };
  }, [element, provider, shape?.props?.content]);

  return (
    <HTMLContainer style={{ pointerEvents: "none" }}>
      <div
        style={{
          width: shape?.props?.w || 530,
          height: shape?.props?.h || 530,
          border: "1px solid #ccc",
          borderRadius: "4px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "8px",
            backgroundColor: "#f5f5f5",
            borderBottom: "1px solid #ccc",
            fontSize: "14px",
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ pointerEvents: "none", flexGrow: 1 }}>
            {shape?.props?.fileName || "Code Editor"}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", pointerEvents: "auto" }}>
            {isHtml && (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  togglePreview();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  backgroundColor: showPreview ? "#007acc" : "#ddd",
                  color: showPreview ? "white" : "#333",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  pointerEvents: "auto",
                  zIndex: 1000,
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.opacity = "1";
                }}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            )}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClose();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              style={{
                padding: "4px 8px",
                fontSize: "14px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                pointerEvents: "auto",
                zIndex: 1000,
                lineHeight: "1",
                minWidth: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = "#d32f2f";
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = "#f44336";
              }}
              title="Close Editor"
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
          <div
            ref={ref}
            style={{
              width: showPreview
                ? `${(shape?.props?.w || 530) - previewWidth - 6}px`
                : "100%",
              height: "100%",
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={() => {
              if (editorView) {
                editorView.focus();
              }
            }}
          />
          {showPreview && (
            <>
              <div
                style={{
                  width: "4px",
                  cursor: "col-resize",
                  backgroundColor: "#ddd",
                  borderLeft: "1px solid #ccc",
                  borderRight: "1px solid #ccc",
                  pointerEvents: "auto",
                }}
                onMouseDown={handleMouseDown}
              />
              <div style={{ width: `${previewWidth}px`, height: "100%", pointerEvents: "auto" }}>
                <iframe
                  srcDoc={currentContent}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "white",
                    pointerEvents: "auto",
                  }}
                  sandbox="allow-scripts"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </HTMLContainer>
  );
};

export class codeEditorShape extends BaseBoxShapeUtil<ICodeEditorShape> {
  static override type = "code-editor-shape" as const;
  static override props: RecordProps<ICodeEditorShape> = {
    w: T.number,
    h: T.number,
    fileName: T.optional(T.string),
    content: T.optional(T.string),
    showPreview: T.optional(T.boolean),
    previewWidth: T.optional(T.number),
    language: T.optional(T.string),
  };

  getDefaultProps(): ICodeEditorShape["props"] {
    return { w: 530, h: 530 };
  }

  component(shape: ICodeEditorShape) {
    return <CodeEditorComponent shape={shape} editor={this.editor} />;
  }

  indicator(shape: ICodeEditorShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
