"use client";

import { useEffect, useState } from "react";
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultStylePanel,
  DefaultToolbar,
  DefaultToolbarContent,
  Editor,
  TLComponents,
  Tldraw,
  TldrawUiMenuActionItem,
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
import { getProjectStore } from "@/ide/project";
import { initTheme, resolvedTheme } from "@/ide/theme";
import { useSignal } from "@/ide/use-signal";
import { getWindowManager } from "@/wm/window-manager";
import { CommandPalette } from "./command-palette";
import { registerIdeCommands } from "./ide-commands";
import {
  applyIdeWorkspace,
  isFirstRun,
  markInitialized,
} from "./ide-workspace";
import { importDroppedItems, isProjectDrop } from "./project-actions";
import { TopBar } from "./top-bar";
import { WM_ACTION_IDS, wmActions } from "./wm-actions";
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
  actions: wmActions,
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
          {WM_ACTION_IDS.map((id) => (
            <TldrawUiMenuActionItem key={id} actionId={id} />
          ))}
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
  const [dropping, setDropping] = useState(false);
  const theme = useSignal(resolvedTheme);

  useEffect(() => {
    initTheme();
    getProjectStore().init();
  }, []);

  // tldraw follows the app theme (system, or the forced choice).
  useEffect(() => {
    editor?.user.updateUserPreferences({ colorScheme: theme });
  }, [editor, theme]);

  useEffect(() => {
    if (!editor) return;
    const off = registerIdeCommands(editor);
    // First run: open the sample project in the IDE arrangement.
    if (isFirstRun()) {
      markInitialized();
      const hasWindows = editor
        .getCurrentPageShapes()
        .some((s) => s.type === "window");
      if (!hasWindows) void applyIdeWorkspace(editor);
    }
    return off;
  }, [editor]);

  // Ctrl+S outside an editor: never let the browser offer to save the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "s"
      )
        e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    if (!isProjectDrop(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!dropping) setDropping(true);
  };

  const onDrop = (e: React.DragEvent) => {
    setDropping(false);
    if (!isProjectDrop(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    void importDroppedItems(e.dataTransfer.items);
  };

  return (
    <div className="pos-desktop">
      <TopBar editor={editor} />
      <div
        className="pos-canvas"
        data-dropping={dropping}
        onDragOverCapture={onDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDropping(false);
        }}
        onDropCapture={onDrop}
      >
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
      <CommandPalette editor={editor} />
    </div>
  );
}
