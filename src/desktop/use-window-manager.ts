"use client";

import { useEditor } from "tldraw";
import { getWindowManager, type WindowManager } from "@/wm/window-manager";

/** The window manager of the surrounding tldraw editor. */
export function useWindowManager(): WindowManager {
  return getWindowManager(useEditor());
}
