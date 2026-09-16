"use client";

import { useState } from "react";
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  Editor,
  TLComponents,
  Tldraw,
  TldrawUiMenuItem,
  TLUiOverrides,
  useIsToolSelected,
  useTools,
} from "tldraw";
import "tldraw/tldraw.css";
import { tldrawAssetUrls } from "@/lib/tldraw-assets";
import { tldrawLicenseKey } from "@/lib/env";
import { TopBar } from "./top-bar";
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
        <TldrawUiMenuItem {...tools["window"]} />
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    );
  },
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
            setEditor(e);
          }}
        />
      </div>
    </div>
  );
}
