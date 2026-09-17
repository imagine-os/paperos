/**
 * Tab state of one Browser window, kept as JSON in the window's `content`
 * prop (decision 14) so tabs survive reloads, workspaces and boards. Every
 * operation returns a new state. Pure.
 */
import { addressTitle, normalizeAddress, BLANK_ADDRESS } from "./address";

export interface BrowserTab {
  id: string;
  /** Visited addresses, oldest first; `index` points at the current one. */
  history: string[];
  index: number;
  /** Page title when known (internal targets set it); else derived from the address. */
  title?: string;
}

export interface BrowserState {
  tabs: BrowserTab[];
  active: string;
  /** Bumped by reload(); the window rebuilds the active frame when it changes. */
  reload: number;
}

export const MAX_HISTORY = 50;

let counter = 0;

export function newTabId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter.toString(36)}`;
}

export function currentAddress(tab: BrowserTab): string {
  return tab.history[tab.index] ?? BLANK_ADDRESS;
}

export function tabTitle(tab: BrowserTab): string {
  return tab.title || addressTitle(currentAddress(tab));
}

export function activeTab(state: BrowserState): BrowserTab {
  return state.tabs.find((t) => t.id === state.active) ?? state.tabs[0];
}

export function createState(address = BLANK_ADDRESS): BrowserState {
  const tab: BrowserTab = {
    id: newTabId(),
    history: [normalizeAddress(address)],
    index: 0,
  };
  return { tabs: [tab], active: tab.id, reload: 0 };
}

/**
 * Reads a window's `content`. Accepts the JSON state, `{"tabs":[{"address"}]}`
 * board specs, a bare address string, or nothing (one blank tab).
 */
export function parseState(content: string): BrowserState {
  if (!content) return createState();
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return createState(content);
  }
  if (typeof raw === "string") return createState(raw);
  if (typeof raw !== "object" || raw === null) return createState();
  const r = raw as {
    tabs?: unknown;
    active?: unknown;
    reload?: unknown;
    url?: unknown;
    address?: unknown;
  };
  if (!Array.isArray(r.tabs) || r.tabs.length === 0) {
    const single = typeof r.url === "string" ? r.url : r.address;
    return createState(typeof single === "string" ? single : undefined);
  }
  const tabs: BrowserTab[] = [];
  for (const t of r.tabs) {
    if (typeof t !== "object" || t === null) continue;
    const o = t as {
      id?: unknown;
      history?: unknown;
      index?: unknown;
      title?: unknown;
      address?: unknown;
      url?: unknown;
    };
    let history: string[] = Array.isArray(o.history)
      ? o.history.filter((h): h is string => typeof h === "string")
      : [];
    if (history.length === 0) {
      const a = typeof o.address === "string" ? o.address : o.url;
      history = [normalizeAddress(typeof a === "string" ? a : "")];
    }
    const index =
      typeof o.index === "number" && o.index >= 0 && o.index < history.length
        ? Math.trunc(o.index)
        : history.length - 1;
    tabs.push({
      id: typeof o.id === "string" && o.id ? o.id : newTabId(),
      history,
      index,
      ...(typeof o.title === "string" && o.title ? { title: o.title } : {}),
    });
  }
  if (tabs.length === 0) return createState();
  const active =
    typeof r.active === "string" && tabs.some((t) => t.id === r.active)
      ? r.active
      : tabs[0].id;
  return {
    tabs,
    active,
    reload: typeof r.reload === "number" ? r.reload : 0,
  };
}

export function serializeState(state: BrowserState): string {
  return JSON.stringify(state);
}

function replaceTab(
  state: BrowserState,
  id: string,
  fn: (tab: BrowserTab) => BrowserTab
): BrowserState {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === id ? fn(t) : t)),
  };
}

/** Goes to an address in a tab (the active one by default), dropping any forward history. */
export function navigate(
  state: BrowserState,
  address: string,
  tabId = state.active
): BrowserState {
  const next = normalizeAddress(address);
  return replaceTab(state, tabId, (tab) => {
    if (currentAddress(tab) === next) return { ...tab, title: undefined };
    const history = [...tab.history.slice(0, tab.index + 1), next].slice(
      -MAX_HISTORY
    );
    return { id: tab.id, history, index: history.length - 1 };
  });
}

export function canGoBack(tab: BrowserTab): boolean {
  return tab.index > 0;
}

export function canGoForward(tab: BrowserTab): boolean {
  return tab.index < tab.history.length - 1;
}

export function goBack(
  state: BrowserState,
  tabId = state.active
): BrowserState {
  return replaceTab(state, tabId, (tab) =>
    canGoBack(tab)
      ? { id: tab.id, history: tab.history, index: tab.index - 1 }
      : tab
  );
}

export function goForward(
  state: BrowserState,
  tabId = state.active
): BrowserState {
  return replaceTab(state, tabId, (tab) =>
    canGoForward(tab)
      ? { id: tab.id, history: tab.history, index: tab.index + 1 }
      : tab
  );
}

export function reload(state: BrowserState): BrowserState {
  return { ...state, reload: state.reload + 1 };
}

export function openTab(
  state: BrowserState,
  address = BLANK_ADDRESS,
  options: { activate?: boolean } = {}
): BrowserState {
  const tab: BrowserTab = {
    id: newTabId(),
    history: [normalizeAddress(address)],
    index: 0,
  };
  return {
    ...state,
    tabs: [...state.tabs, tab],
    active: options.activate === false ? state.active : tab.id,
  };
}

/** Closes a tab; the last tab is replaced by a blank one so a window always has a tab. */
export function closeTab(state: BrowserState, tabId: string): BrowserState {
  const i = state.tabs.findIndex((t) => t.id === tabId);
  if (i === -1) return state;
  const tabs = state.tabs.filter((t) => t.id !== tabId);
  if (tabs.length === 0) return { ...createState(), reload: state.reload };
  const active =
    state.active === tabId
      ? tabs[Math.min(i, tabs.length - 1)].id
      : state.active;
  return { ...state, tabs, active };
}

export function activateTab(state: BrowserState, tabId: string): BrowserState {
  return state.tabs.some((t) => t.id === tabId)
    ? { ...state, active: tabId }
    : state;
}

export function setTabTitle(
  state: BrowserState,
  tabId: string,
  title: string
): BrowserState {
  return replaceTab(state, tabId, (tab) =>
    tab.title === title ? tab : { ...tab, title }
  );
}

/** Plain records for the Canvas API. */
export function describeTabs(state: BrowserState): {
  id: string;
  url: string;
  title: string;
  active: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}[] {
  return state.tabs.map((t) => ({
    id: t.id,
    url: currentAddress(t),
    title: tabTitle(t),
    active: t.id === state.active,
    canGoBack: canGoBack(t),
    canGoForward: canGoForward(t),
  }));
}
