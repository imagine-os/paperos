"use client";

import { Avatars } from "@/components/Avatars";
import { useSelf } from "@liveblocks/react/suspense";
import {
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
import { myInteractiveShape } from "./custom-shapes/shape.component";
import { StickerTool } from "./custom-shapes/shape.tool";
import { useStorageStore } from "./useStorageStore";

/**
 * IMPORTANT: LICENSE REQUIRED
 * To remove the watermark, you must first purchase a license
 * Learn more: https://tldraw.dev/community/license
 */

// There's a guide at the bottom of this file!

const customShapeUtils = [myInteractiveShape];

// [1]
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    // Create a tool item in the ui's context.
    tools.myComponent = {
      id: "myComponent",
      icon: "heart-icon",
      label: "myComponent",
      kbd: "s",
      onSelect: () => {
        editor.setCurrentTool("myComponent");
      },
    };
    return tools;
  },
};

// [2]
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isStickerSelected = useIsToolSelected(tools["myComponent"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem
          {...tools["myComponent"]}
          isSelected={isStickerSelected}
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
        <TldrawUiMenuItem {...tools["myComponent"]} />
      </DefaultKeyboardShortcutsDialog>
    );
  },
};

// [3]
export const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "heart-icon": "/heart-icon.svg",
  },
};

export function StorageTldraw() {
  // of just `useSelf()` to prevent re-renders on Presence changes
  const id = useSelf((me) => me.id);
  const info = useSelf((me) => me.info);

  const store = useStorageStore({
    user: { id, color: info.color, name: info.name },
  });

  const customTools = [StickerTool];

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <Tldraw
        // store={store}
        // embeds={embeds}
        tools={customTools}
        shapeUtils={customShapeUtils}
        overrides={uiOverrides}
        assetUrls={customAssetUrls}
        components={{
          // Render a live avatar stack at the top-right
          ...components,
          StylePanel: () => (
            <div
              style={{
                display: "flex-column",
                marginTop: 4,
              }}
            >
              <Avatars />
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
