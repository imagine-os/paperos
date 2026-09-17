/**
 * The design system of a project in the browser: reads tokens, components,
 * pages and the guidelines from the live documents (unsaved edits count) and
 * writes them back through the same documents, so editors, the preview and
 * the Design / Page Builder windows share one source of truth.
 */
import { getDataStore } from "@/data/project-fs";
import type { DataSchema } from "@/data/schema";
import { readLiveText, writeLiveText } from "@/ide/docs";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import {
  componentFromPath,
  DESIGN_README_PATH,
  parseComponents,
  type ComponentDef,
} from "./components";
import { isPagePath, parsePage, type PageDef } from "./pages";
import {
  defaultTokens,
  parseTokens,
  TOKENS_PATH,
  type DesignTokens,
} from "./tokens";

export interface DesignModel {
  /** True when design/tokens.json exists. */
  hasTokens: boolean;
  tokens: DesignTokens;
  tokenErrors: string[];
  components: ComponentDef[];
  componentErrors: string[];
  pages: PageDef[];
  pageErrors: string[];
  /** design/README.md, or null. */
  readme: string | null;
  schema: DataSchema;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function loadDesign(
  projectId: string,
  store: ProjectStore = getProjectStore()
): Promise<DesignModel> {
  const session = await store.session(projectId);
  const paths =
    session?.files
      .get()
      .filter((f) => f.type === "file")
      .map((f) => f.path) ?? [];
  const read = (p: string) => readLiveText(projectId, p, store);

  const tokensText = await read(TOKENS_PATH);
  const parsedTokens = tokensText === null ? null : parseTokens(tokensText);

  const componentFiles: { path: string; text: string }[] = [];
  for (const p of paths.filter((x) => componentFromPath(x))) {
    const text = await read(p);
    if (text !== null) componentFiles.push({ path: p, text });
  }
  const comps = parseComponents(componentFiles);

  const pages: PageDef[] = [];
  const pageErrors: string[] = [];
  for (const p of paths.filter(isPagePath).sort()) {
    const text = await read(p);
    if (text === null) continue;
    const r = parsePage(text, p);
    pageErrors.push(...r.errors);
    if (r.page) pages.push(r.page);
  }

  const dataStore = getDataStore(projectId, store);
  const schema = await dataStore.schema();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of schema.tables) tables[t.name] = await dataStore.rows(t.name);

  return {
    hasTokens: tokensText !== null,
    tokens: parsedTokens?.tokens ?? defaultTokens(),
    tokenErrors: parsedTokens?.errors ?? [],
    components: comps.components,
    componentErrors: comps.errors,
    pages,
    pageErrors,
    readme: await read(DESIGN_README_PATH),
    schema,
    tables,
  };
}

/** Writes a design file through the shared document (editors and the preview follow). */
export function writeDesignFile(
  projectId: string,
  path: string,
  text: string,
  store: ProjectStore = getProjectStore()
): Promise<void> {
  return writeLiveText(projectId, path, text, store);
}
