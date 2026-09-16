"use client";

// TEMPORARY: Running in offline mode to avoid Liveblocks storage validation errors
// import { Avatars } from "@/components/Avatars";
// import { useSelf } from "@liveblocks/react/suspense";
import {
  createTLStore,
  defaultShapeUtils,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultStylePanel,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  Tldraw,
  TldrawUiMenuItem,
  TLUiAssetUrlOverrides,
  TLUiOverrides,
  useIsToolSelected,
  useTools,
} from "tldraw";
import "tldraw/tldraw.css";
import { tldrawAssetUrls } from "@/lib/tldraw-assets";
import { ReactComponent } from "./ReactComponent";
// import { useStorageStore } from "./useStorageStore";
import { CodeEditorTool } from "./code-editor/code-editor.tool";
import { codeEditorShape } from "./code-editor/code-editor.component";
import { ProjectBrowserTool } from "./project-browser/project-browser.tool";
import { projectBrowserShape } from "./project-browser/project-browser.component";

const customShapeUtils = [codeEditorShape, projectBrowserShape];

// [1]
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    // Add CodeEditorTool to the UI
    tools.codeEditor = {
      id: "code-editor-tool",
      icon: "code",
      label: "Code Editor",
      kbd: "c",
      onSelect: () => {
        editor.setCurrentTool("code-editor-tool");
      },
    };

    // Add ProjectBrowserTool to the UI
    tools.projectBrowser = {
      id: "project-browser-tool",
      icon: "folder",
      label: "Project Browser",
      kbd: "p",
      onSelect: () => {
        editor.setCurrentTool("project-browser-tool");
      },
    };

    return tools;
  },
};

// [2]
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isCodeEditorSelected = useIsToolSelected(tools["codeEditor"]);
    const isProjectBrowserSelected = useIsToolSelected(tools["projectBrowser"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem
          {...tools["codeEditor"]}
          isSelected={isCodeEditorSelected}
        />
        <TldrawUiMenuItem
          {...tools["projectBrowser"]}
          isSelected={isProjectBrowserSelected}
        />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools();
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <DefaultKeyboardShortcutsDialogContent />
        {/* Ideally, we'd interleave this into the tools group */}
        <TldrawUiMenuItem {...tools["codeEditor"]} />
        <TldrawUiMenuItem {...tools["projectBrowser"]} />
      </DefaultKeyboardShortcutsDialog>
    );
  },
};

// [3]
export const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {},
};

export function StorageTldraw() {
  // TEMPORARY: Using local store instead of Liveblocks collaborative store
  // const id = useSelf((me) => me.id);
  // const info = useSelf((me) => me.info);

  const store = createTLStore({
    shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
  });

  const customTools = [CodeEditorTool, ProjectBrowserTool];

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Tldraw
        store={store}
        // embeds={embeds}
        tools={customTools}
        shapeUtils={customShapeUtils}
        overrides={uiOverrides}
        assetUrls={tldrawAssetUrls}
        components={{
          // TEMPORARY: Removed Avatars component for offline mode
          ...components,
          StylePanel: () => (
            <div style={{ display: "flex-column", marginTop: 4 }}>
              {/* <Avatars /> */}
              <DefaultStylePanel />
              <ReactComponent />
            </div>
          ),
        }}
        autoFocus
      />
    </div>
  );
}
