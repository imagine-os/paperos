import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
} from "tldraw";
import React from "react";

// There's a guide at the bottom of this file!

export type IMyInteractiveShape = TLBaseShape<
  "my-interactive-shape",
  {
    w: number;
    h: number;
    checked: boolean;
    text: string;
  }
>;

export class myInteractiveShape extends BaseBoxShapeUtil<IMyInteractiveShape> {
  static override type = "my-interactive-shape" as const;
  static override props: RecordProps<IMyInteractiveShape> = {
    w: T.number,
    h: T.number,
    checked: T.boolean,
    text: T.string,
  };

  getDefaultProps(): IMyInteractiveShape["props"] {
    return {
      w: 230,
      h: 230,
      checked: false,
      text: "",
    };
  }

  // [1]
  component(shape: IMyInteractiveShape) {
    // Local theme state for this shape instance
    const [darkMode, setDarkMode] = React.useState(false);
    // Spotlight state
    const [spotlight, setSpotlight] = React.useState<{
      x: number;
      y: number;
    } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Mouse move handler
    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setSpotlight({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };
    // Mouse leave handler
    const handleMouseLeave = () => setSpotlight(null);

    return (
      <HTMLContainer
        style={{
          padding: 16,
          height: shape.props.h,
          width: shape.props.w,
          pointerEvents: "all",
          backgroundColor: darkMode ? "#222" : "#efefef",
          color: darkMode ? "#fff" : "#222",
          overflow: "hidden",
          boxShadow: darkMode
            ? "0 8px 24px rgba(0,0,0,0.7), inset 0 0 16px rgb(255, 255, 255)"
            : "0 8px 16px rgba(0, 0, 0, 0.2), inset 0 0 10px rgba(0, 0, 0, 0.3)",
          borderRadius: "10px",
          backgroundImage: darkMode
            ? "radial-gradient(circle, #333, #222, #111)"
            : "radial-gradient(circle, #ffffff, #efefef, #cccccc)",
          animation: "portalEffect 3s infinite alternate",
          position: "relative",
        }}
      >
        <div
          ref={containerRef}
          style={{ position: "relative", width: "100%", height: "100%" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Spotlight overlay */}
          {spotlight && (
            <div
              style={{
                pointerEvents: "none",
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                zIndex: 10,
                background: `radial-gradient(circle 80px at ${spotlight.x}px ${spotlight.y}px, rgba(255,255,255,0.25), transparent 80%)`,
                transition: "background 0.1s",
              }}
            />
          )}
          {/* Theme toggle checkbox */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={() => setDarkMode((prev) => !prev)}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            />
            {darkMode ? "Dark Mode" : "Light Mode"}
          </label>

          <div dangerouslySetInnerHTML={{ __html: shape.props.text }}></div>

          <input
            type="checkbox"
            checked={shape.props.checked}
            onChange={() =>
              this.editor.updateShape<IMyInteractiveShape>({
                id: shape.id,
                type: "my-interactive-shape",
                props: { checked: !shape.props.checked },
              })
            }
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />
          <textarea
            placeholder="Enter a html..."
            readOnly={shape.props.checked}
            value={shape.props.text}
            onChange={(e) =>
              this.editor.updateShape<IMyInteractiveShape>({
                id: shape.id,
                type: "my-interactive-shape",
                props: { text: e.currentTarget.value },
              })
            }
            onPointerDown={(e) => {
              if (!shape.props.checked) {
                e.stopPropagation();
              }
            }}
            onTouchStart={(e) => {
              if (!shape.props.checked) {
                e.stopPropagation();
              }
            }}
            onTouchEnd={(e) => {
              if (!shape.props.checked) {
                e.stopPropagation();
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  // [5]
  indicator(shape: IMyInteractiveShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

/* 
This is a custom shape, for a more in-depth look at how to create a custom shape,
see our custom shape example.

[1]
This is where we describe how our shape will render

	[a] We need to set pointer-events to all so that we can interact with our shape. This CSS property is
	set to "none" off by default. We need to manually opt-in to accepting pointer events by setting it to
	'all' or 'auto'. 

	[b] We need to stop event propagation so that the editor doesn't select the shape
		when we click on the checkbox. The 'canvas container' forwards events that it receives
		on to the editor, so stopping propagation here prevents the event from reaching the canvas.
	
	[c] If the shape is not checked, we stop event propagation so that the editor doesn't
		select the shape when we click on the input. If the shape is checked then we allow that event to
		propagate to the canvas and then get sent to the editor, triggering clicks or drags as usual.

*/
