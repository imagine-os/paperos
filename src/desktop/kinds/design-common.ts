"use client";

import { starterDesignFiles } from "@/design/starter";
import { writeDesignFile } from "@/design/project-design";

import { useEffect, useState } from "react";
import type { Editor, TLShapeId } from "tldraw";
import { loadDesign, type DesignModel } from "@/design/project-design";
import { docsChanged } from "@/ide/docs";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { openKindWindow, useActiveData, useAsyncValue } from "./data-common";

const SCAN_DELAY_MS = 200;

/** The active project's design system, reloaded (debounced) when any file changes. */
export function useDesign(): {
  project: string | null;
  design: DesignModel | null;
  loading: boolean;
  error: string | null;
} {
  const { project, tick } = useActiveData();
  const projects = getProjectStore();
  const docTick = useSignal(docsChanged);
  const fileTick = useSignal(projects.changes);
  const [scanTick, setScanTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScanTick((n) => n + 1), SCAN_DELAY_MS);
    return () => clearTimeout(t);
  }, [tick, docTick, fileTick, project]);
  const result = useAsyncValue(
    async (): Promise<DesignModel | null> =>
      project ? loadDesign(project, projects) : null,
    [project, scanTick],
    null
  );
  return {
    project,
    design: result.value,
    loading: result.loading,
    error: result.error,
  };
}

/** What a Design window keeps in `content`. */
export interface DesignWindowContent {
  tab?: "tokens" | "components" | "guidelines";
  component?: string;
  theme?: "light" | "dark";
}

/** What a Page Builder window keeps in `content`. */
export interface PagesWindowContent {
  page?: string;
  block?: string;
  device?: "mobile" | "tablet" | "desktop";
  /** The "Data sources" overlay in the device preview. */
  sources?: boolean;
}

export function openDesignWindow(
  editor: Editor,
  content: DesignWindowContent = {}
): TLShapeId {
  return openKindWindow(editor, "design", content);
}

export function openPagesWindow(
  editor: Editor,
  content: PagesWindowContent = {}
): TLShapeId {
  return openKindWindow(editor, "pages", content, {
    title: content.page ? `Page: ${content.page}` : "Page Builder",
  });
}

/** Message the gallery / page preview iframes post to their window. */
export interface DesignMessage {
  source: "paperos-design";
  type: "select" | "block" | "hover-table";
  name?: string;
  variant?: string;
  id?: string;
  /** hover-table: the table under the pointer, or null when it left. */
  table?: string | null;
}

export function isDesignMessage(data: unknown): data is DesignMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as DesignMessage).source === "paperos-design"
  );
}

/** One-click fix for a project without a design system: tokens, the starter library and the guide. */
export async function createStarterDesign(project: string): Promise<void> {
  for (const [path, text] of Object.entries(starterDesignFiles()))
    await writeDesignFile(project, path, text);
}
