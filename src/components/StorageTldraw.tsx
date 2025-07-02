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
import { ReactComponent } from "./ReactComponent";
// import { useStorageStore } from "./useStorageStore";
import { CodeEditorTool } from "./code-eidtor/code-editor.tool";
import { codeEditorShape } from "./code-eidtor/code-editor.component";

const customShapeUtils = [codeEditorShape];

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
    
    return tools;
  },
};

// [2]
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isCodeEditorSelected = useIsToolSelected(tools["codeEditor"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem
          {...tools["codeEditor"]}
          isSelected={isCodeEditorSelected}
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
    shapeUtils: [...defaultShapeUtils, ...customShapeUtils] 
  });

  const customTools = [CodeEditorTool];

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <Tldraw
        store={store}
        // embeds={embeds}
        tools={customTools}
        shapeUtils={customShapeUtils}
        overrides={uiOverrides}
        assetUrls={customAssetUrls}
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
