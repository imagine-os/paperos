import type { PluginModule } from "../types";

/** Example plugin: while a layout is active, every new window joins it. */
const autoTile: PluginModule = {
  name: "Auto-tile",
  description: "Adds every new window to the active layout.",
  activate(api) {
    api.on("window.created", (event) => {
      const id = event.payload.id;
      if (typeof id !== "string") return;
      // Wait a tick: openFile and friends may still be placing the window themselves.
      setTimeout(() => {
        const w = api.windows.get(id);
        if (!w || w.tiled) return;
        if (api.layout.getTree().root) api.layout.tile([id]);
      }, 0);
    });
    api.registerCommand({
      id: "auto-tile.tile-now",
      title: "Auto-tile: tile all windows now",
      group: "Layout",
      run: () => void api.layout.tile(),
    });
  },
};

export default autoTile;
