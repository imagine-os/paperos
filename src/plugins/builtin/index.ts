import type { PluginModule } from "../types";
import autoTile from "./auto-tile";
import clock from "./clock";

export const BUILTIN_PLUGINS: Record<string, PluginModule> = {
  clock,
  "auto-tile": autoTile,
};
