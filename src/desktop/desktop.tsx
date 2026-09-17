"use client";

import { useEffect, useRef, useState } from "react";
import {
  react,
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
import { installBridgeClient } from "@/api/bridge-client";
import { installCanvasApi } from "@/api/install";
import { installPlugins } from "@/plugins/install";
import { getCollabSession } from "@/collab/session";
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
import { ProblemToast } from "./problem-toast";
import { StartHere } from "./start-here";
import { zoomBand, type ZoomBand } from "./zoom-band";
import { TourOverlay } from "./tour-overlay";
import { openKindWindow } from "./kinds/data-common";
import { startWelcomeTour, urlHasIntent, welcomeSeen } from "./welcome-tour";
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
  InFrontOfTheCanvas: () => <WmOverlay />,
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
    const installed = installCanvasApi(editor);
    const offPlugins = installPlugins(installed.api, installed.events);
    const bridge = installBridgeClient(installed.api);
    // A `?room=` link joins that room (the room supplies canvas and project).
    const collab = getCollabSession();
    const joining = collab.install(editor, {
      confirmJoin: (id) =>
        isFirstRun() ||
        window.confirm(
          `Join room "${id}"?\n\nIts canvas and project replace what you see here. Your own project stays in the Open menu.`
        ),
    });
    // First run: open the sample project in the IDE arrangement, then the
    // welcome tour (once per browser; links with a room or board skip it).
    const tourWanted = !joining && !welcomeSeen() && !urlHasIntent();
    if (isFirstRun()) {
      markInitialized();
      const hasWindows = editor
        .getCurrentPageShapes()
        .some((s) => s.type === "window");
      if (!hasWindows && !joining)
        void applyIdeWorkspace(editor).then(() => {
          if (tourWanted) void startWelcomeTour(editor);
        });
      else if (tourWanted) void startWelcomeTour(editor);
    } else if (tourWanted) {
      void startWelcomeTour(editor);
    }
    return () => {
      collab.uninstall(editor);
      bridge.stop();
      offPlugins();
      installed.dispose();
      off();
    };
  }, [editor]);

  // Zoom band on the canvas container: CSS hides arrows and their labels
  // when the camera is far out (see desktop.css), one attribute write per
  // band change.
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    let band: ZoomBand = "near";
    let frame: number | null = null;
    canvasRef.current?.setAttribute("data-zoom", band);
    const off = react("zoom band", () => {
      const zoom = editor.getZoomLevel();
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = zoomBand(editor.getZoomLevel(), band);
        if (next !== band) {
          band = next;
          canvasRef.current?.setAttribute("data-zoom", band);
        }
      });
      void zoom;
    });
    return () => {
      off();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [editor]);

  // Ctrl+S outside an editor: never let the browser offer to save the page
  // (bubble phase, so CodeMirror's own Ctrl+S runs first).
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

  // `?` outside a text field opens the keyboard map.
  useEffect(() => {
    if (!editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      openKindWindow(editor, "keys", "", { reuse: true });
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor]);

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
        ref={canvasRef}
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
      <StartHere editor={editor} />
      <TourOverlay editor={editor} />
      <CommandPalette editor={editor} />
      <ProblemToast />
    </div>
  );
}

/** True when a key press belongs to a text field or an editor, not the desktop. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable ||
    t.closest(".cm-editor, .pos-terminal, [contenteditable]") !== null
  );
}
