"use client";

import "tldraw/tldraw.css";
import {
  Tldraw,
  DefaultStylePanel,
  DefaultStylePanelContent,
  CustomEmbedDefinition,
  DEFAULT_EMBED_DEFINITIONS,
  DefaultEmbedDefinitionType,
} from "tldraw";
import { useStorageStore } from "./useStorageStore";
import { useSelf } from "@liveblocks/react/suspense";
import { Avatars } from "@/components/Avatars";
import { Badge } from "@/components/Badge";

/**
 * IMPORTANT: LICENSE REQUIRED
 * To remove the watermark, you must first purchase a license
 * Learn more: https://tldraw.dev/community/license
 */

// There's a guide at the bottom of this file!

// [1]
const defaultEmbedTypesToKeep: DefaultEmbedDefinitionType[] = [
  "tldraw",
  "youtube",
];
const defaultEmbedsToKeep = DEFAULT_EMBED_DEFINITIONS.filter((embed) =>
  defaultEmbedTypesToKeep.includes(embed.type)
);

// [2]
const customEmbed: CustomEmbedDefinition = {
  type: "jsfiddle",
  title: "JSFiddle",
  hostnames: ["jsfiddle.net"],
  minWidth: 300,
  minHeight: 300,
  width: 720,
  height: 500,
  doesResize: true,
  toEmbedUrl: (url) => {
    const urlObj = new URL(url);
    const matches = urlObj.pathname.match(
      /\/([^/]+)\/([^/]+)\/(\d+)\/embedded/
    );
    if (matches) {
      return `https://jsfiddle.net/${matches[1]}/${matches[2]}/embedded/`;
    }
    return;
  },
  fromEmbedUrl: (url) => {
    const urlObj = new URL(url);
    const matches = urlObj.pathname.match(
      /\/([^/]+)\/([^/]+)\/(\d+)\/embedded/
    );
    if (matches) {
      return `https://jsfiddle.net/${matches[1]}/${matches[2]}/`;
    }
    return;
  },
  icon: "https://jsfiddle.net/img/favicon.png",
};

// [3]
const embeds = [...defaultEmbedsToKeep, customEmbed];

export function StorageTldraw() {
  // Getting authenticated user info. Doing this using selectors instead
  // of just `useSelf()` to prevent re-renders on Presence changes
  const id = useSelf((me) => me.id);
  const info = useSelf((me) => me.info);

  const store = useStorageStore({
    user: { id, color: info.color, name: info.name },
  });

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <Tldraw
        components={{
          // Render a live avatar stack at the top-right
          StylePanel: () => (
            <div
              style={{
                display: "flex-column",
                marginTop: 4,
              }}
            >
              <Badge />
            </div>
          ),
        }}
        autoFocus
      />
    </div>
  );
}
