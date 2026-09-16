import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  useEditor,
} from "tldraw";
import React, { useCallback, useState } from "react";

export type IProjectBrowserShape = TLBaseShape<
  "project-browser-shape",
  { w: number; h: number }
>;

interface FileItem {
  name: string;
  handle: FileSystemFileHandle;
  type: string;
}

export class projectBrowserShape extends BaseBoxShapeUtil<IProjectBrowserShape> {
  static override type = "project-browser-shape" as const;
  static override props: RecordProps<IProjectBrowserShape> = {
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): IProjectBrowserShape["props"] {
    return { w: 300, h: 400 };
  }

  component(shape: IProjectBrowserShape) {
    const editor = useEditor();
    const [directoryHandle, setDirectoryHandle] =
      useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const openFolder = useCallback(async () => {
      if (!("showDirectoryPicker" in window)) {
        alert("File System Access API not supported in this browser");
        return;
      }

      try {
        setIsLoading(true);
        const handle = await (window as any).showDirectoryPicker();
        setDirectoryHandle(handle);

        const fileList: FileItem[] = [];
        const supportedExtensions = [".js", ".jsx", ".ts", ".tsx", ".html"];

        for await (const entry of handle.values()) {
          if (entry.kind === "file") {
            const extension = "." + entry.name.split(".").pop()?.toLowerCase();
            if (supportedExtensions.includes(extension)) {
              fileList.push({
                name: entry.name,
                handle: entry,
                type: extension,
              });
            }
          }
        }

        setFiles(fileList);
      } catch (error) {
        console.error("Error opening folder:", error);
      } finally {
        setIsLoading(false);
      }
    }, []);

    const openFile = useCallback(
      async (fileItem: FileItem) => {
        try {
          const file = await fileItem.handle.getFile();
          const content = await file.text();

          // Create a new code editor shape with smart positioning
          const currentShape = editor.getShape<IProjectBrowserShape>(shape.id);
          if (currentShape) {
            // Get all existing code editor shapes
            const allShapes = editor.getCurrentPageShapes();
            const codeEditorShapes = allShapes.filter(s => s.type === 'code-editor-shape');
            
            // Calculate base position next to project browser
            const baseX = currentShape.x + currentShape.props.w + 20;
            const baseY = currentShape.y;
            
            // Find a non-overlapping position using cascade pattern
            const CASCADE_OFFSET = 30;
            let newX = baseX;
            let newY = baseY;
            
            // Check for overlaps and adjust position
            let attempts = 0;
            const maxAttempts = codeEditorShapes.length + 1;
            
            while (attempts < maxAttempts) {
              const hasOverlap = codeEditorShapes.some(shape => {
                const tolerance = 10;
                return Math.abs(shape.x - newX) < tolerance && 
                       Math.abs(shape.y - newY) < tolerance;
              });
              
              if (!hasOverlap) break;
              
              // Apply cascade offset
              newX += CASCADE_OFFSET;
              newY += CASCADE_OFFSET;
              attempts++;
            }

            editor.createShape({
              type: "code-editor-shape",
              x: newX,
              y: newY,
              props: {
                w: 530,
                h: 530,
                fileName: fileItem.name,
                content: content,
              },
            });
          }
        } catch (error) {
          console.error("Error reading file:", error);
        }
      },
      [editor, shape.id]
    );

    return (
      <HTMLContainer style={{ pointerEvents: "all" }}>
        <div
          style={{
            width: shape.props.w,
            height: shape.props.h,
            border: "1px solid #ccc",
            borderRadius: "4px",
            overflow: "hidden",
            backgroundColor: "white",
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
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Project Browser</span>
            <button
              onClick={openFolder}
              disabled={isLoading}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor: "#007acc",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isLoading ? "Loading..." : "Open Folder"}
            </button>
          </div>

          <div
            style={{
              height: "calc(100% - 40px)",
              overflowY: "auto",
              padding: "8px",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {!directoryHandle ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Select a folder to browse files
              </div>
            ) : files.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                No supported files found
              </div>
            ) : (
              <div>
                <div
                  style={{
                    marginBottom: "8px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  {directoryHandle.name} ({files.length} files)
                </div>
                {files.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <div style={{ fontSize: "13px", flex: 1 }}>
                      <span style={{ color: "#666", marginRight: "8px" }}>
                        {file.type}
                      </span>
                      {file.name}
                    </div>
                    <button
                      onClick={() => openFile(file)}
                      style={{
                        padding: "2px 6px",
                        fontSize: "11px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "2px",
                        cursor: "pointer",
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: IProjectBrowserShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
