"use client";

import { useState } from "react";
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultStylePanel,
  DefaultToolbar,
  DefaultToolbarContent,
  Editor,
  TLComponents,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  TLUiOverrides,
  useEditor,
  useIsToolSelected,
  useTools,
  useValue,
} from "tldraw";
import "tldraw/tldraw.css";
import { tldrawAssetUrls } from "@/lib/tldraw-assets";
import { tldrawLicenseKey } from "@/lib/env";
import { getWindowManager } from "@/wm/window-manager";
import { TopBar } from "./top-bar";
import { WmOverlay } from "./wm-overlay";
import { WindowShapeUtil } from "./window-shape";
import { WindowTool } from "./window-tool";
import "./desktop.css";

const shapeUtils = [WindowShapeUtil];
const tools = [WindowTool];

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.window = {
      id: "window",
      icon: "tool-frame",
      label: "Window",
      kbd: "w",
      onSelect: () => editor.setCurrentTool("window"),
    };
    return tools;
  },
};

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isSelected = useIsToolSelected(tools["window"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools["window"]} isSelected={isSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools();
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <TldrawUiMenuGroup id="paperos" label="PaperOS">
          <TldrawUiMenuItem {...tools["window"]} />
        </TldrawUiMenuGroup>
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    );
  },
  // Windows have no tldraw styles; the panel would only cover the top-right tile.
  StylePanel: (props) => {
    const editor = useEditor();
    const onlyWindows = useValue(
      "only windows selected",
      () => {
        const shapes = editor.getSelectedShapes();
        return shapes.length > 0 && shapes.every((s) => s.type === "window");
      },
      [editor]
    );
    if (onlyWindows) return null;
    return <DefaultStylePanel {...props} />;
  },
  InFrontOfTheCanvas: WmOverlay,
};

/** The PaperOS desktop: a top bar and a full-bleed, persistent tldraw canvas. */
export function Desktop() {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <div className="pos-desktop">
      <TopBar editor={editor} />
      <div className="pos-canvas">
        <Tldraw
          persistenceKey="paperos-v2"
          shapeUtils={shapeUtils}
          tools={tools}
          overrides={uiOverrides}
          components={components}
          assetUrls={tldrawAssetUrls}
          licenseKey={tldrawLicenseKey}
          inferDarkMode
          onMount={(e) => {
            getWindowManager(e);
            setEditor(e);
          }}
        />
      </div>
    </div>
  );
}
