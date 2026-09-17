"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { stopEventPropagation } from "tldraw";
import { getBridgeClient } from "@/api/bridge-client";
import { signal } from "@/ide/signal";
import {
  addressTitle,
  DOC_FILES,
  HOME_ADDRESS,
  normalizeAddress,
  parseAddress,
  type BrowserTarget,
} from "@/browser/address";
import {
  addBookmark,
  BOOKMARKS_PATH,
  isBookmarked,
  parseBookmarks,
  removeBookmark,
  serializeBookmarks,
  type Bookmark,
} from "@/browser/bookmarks";
import { docDocument, loadDoc, resolveDocLink } from "@/browser/docs";
import {
  EMBED_TIMEOUT_MS,
  isBlockedHost,
  judgeEmbed,
  REFUSED_MESSAGE,
} from "@/browser/embed";
import {
  activateTab,
  activeTab,
  canGoBack,
  canGoForward,
  closeTab,
  currentAddress,
  goBack,
  goForward,
  navigate,
  openTab,
  parseState,
  reload,
  serializeState,
  setTabTitle,
  tabTitle,
  type BrowserState,
} from "@/browser/tabs";
import { isPreviewMessage, pushConsole } from "@/ide/console-store";
import { docsChanged, readLiveText, writeLiveText } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import { bundle, pickEntry, splitEntry } from "@/ide/preview/bundle";
import { previewReload } from "@/ide/preview/preview-state";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { pagePath } from "@/design/pages";
import { withBasePath } from "@/lib/env";
import type { WindowKindProps } from "../window-kinds";
import { Dropdown, MenuHeading, MenuItem, MenuSeparator } from "../menu";

const OFF = signal<"off" | "waiting" | "connected">("off");
const PREVIEW_DEBOUNCE_MS = 300;

/**
 * A web browser as a window: tabs, an address bar with back / forward /
 * reload / home, bookmarks kept in the project (`browser/bookmarks.json`),
 * first-class internal targets (the project preview, the docs, `/legacy`,
 * the landing) and http(s) pages in a sandboxed iframe. Sites that refuse
 * to be framed get a card with a way out. Tab state lives in the window's
 * `content` (see `src/browser/tabs.ts`).
 */
export function BrowserWindow({ shape, editor, update }: WindowKindProps) {
  const state = useMemo(
    () => parseState(shape.props.content),
    [shape.props.content]
  );
  const commit = useCallback(
    (next: BrowserState) => {
      if (next !== state) update({ content: serializeState(next) });
    },
    [state, update]
  );
  const tab = activeTab(state);
  const address = currentAddress(tab);
  const target = parseAddress(address);
  const [draft, setDraft] = useState<string | null>(null);
  const [forced, setForced] = useState<Record<string, true>>({});

  const store = getProjectStore();
  const projects = useSignal(store.state);
  const project = projects.activeId;
  const { bookmarks, save: saveBookmarks } = useBookmarks(project);

  const commitDraft = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text && text !== address && normalizeAddress(text) !== "about:blank")
      commit(navigate(state, text));
  };

  const externalUrl = externalHref(target);
  const openExternal = () => {
    if (externalUrl) window.open(externalUrl, "_blank", "noopener");
  };

  const bookmarked = isBookmarked(bookmarks, address);
  const toggleBookmark = () => {
    if (target.type === "blank") return;
    void saveBookmarks(
      bookmarked
        ? removeBookmark(bookmarks, address)
        : addBookmark(bookmarks, {
            title: tabTitle(tab),
            url: address,
          })
    );
  };

  const setTitle = useCallback(
    (title: string) => {
      const next = setTabTitle(state, tab.id, title);
      if (next !== state) update({ content: serializeState(next) });
    },
    [state, tab.id, update]
  );

  let body: ReactNode;
  const frameKey = `${tab.id}:${address}:${state.reload}`;
  switch (target.type) {
    case "blank":
      body = (
        <BlankPage
          bookmarks={bookmarks}
          onOpen={(url) => commit(navigate(state, url))}
        />
      );
      break;
    case "preview":
      body = (
        <ProjectFrame
          key={frameKey}
          entry={target.entry}
          onNavigate={(url) => commit(navigate(state, url))}
          onTitle={setTitle}
        />
      );
      break;
    case "docs":
      body = (
        <DocFrame
          key={frameKey}
          doc={target.doc}
          onNavigate={(url) => commit(navigate(state, url))}
        />
      );
      break;
    case "home":
    case "legacy":
      body = (
        <iframe
          key={frameKey}
          className="pos-browser__frame"
          title={target.type === "home" ? "PaperOS" : "Legacy prototype"}
          src={withBasePath(target.type === "home" ? "/" : "/legacy")}
          onWheel={stopEventPropagation}
        />
      );
      break;
    case "http":
      body = (
        <ExternalFrame
          key={frameKey}
          url={target.url}
          force={forced[target.url] === true}
          onForce={() => setForced((f) => ({ ...f, [target.url]: true }))}
          onOpenExternal={openExternal}
        />
      );
      break;
  }

  return (
    <div
      className="pos-browser"
      data-testid="browser-window"
      data-target={target.type}
      onPointerDown={stopEventPropagation}
    >
      <div className="pos-browser__tabs" role="tablist">
        {state.tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === state.active}
            className={`pos-browser__tab${t.id === state.active ? " pos-browser__tab--active" : ""}`}
            data-testid="browser-tab"
            onClick={() => commit(activateTab(state, t.id))}
          >
            <span className="pos-browser__tab-title">{tabTitle(t)}</span>
            <button
              type="button"
              className="pos-browser__tab-close"
              aria-label={`Close tab ${tabTitle(t)}`}
              onClick={(e) => {
                e.stopPropagation();
                commit(closeTab(state, t.id));
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="pos-browser__tab-add"
          aria-label="New tab"
          title="New tab"
          data-testid="browser-new-tab"
          onClick={() => commit(openTab(state))}
        >
          +
        </button>
      </div>
      <div className="pos-toolbar pos-toolbar--dense pos-browser__nav">
        <button
          type="button"
          className="pos-button pos-button--small"
          aria-label="Back"
          title="Back"
          disabled={!canGoBack(tab)}
          onClick={() => commit(goBack(state))}
        >
          ←
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          aria-label="Forward"
          title="Forward"
          disabled={!canGoForward(tab)}
          onClick={() => commit(goForward(state))}
        >
          →
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          aria-label="Reload"
          title="Reload"
          onClick={() => commit(reload(state))}
        >
          ↻
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          aria-label="Home"
          title="PaperOS home"
          onClick={() => commit(navigate(state, HOME_ADDRESS))}
        >
          ⌂
        </button>
        <input
          className="pos-browser__url"
          aria-label="Address"
          data-testid="browser-address"
          list={`browser-urls-${shape.id}`}
          spellCheck={false}
          value={draft ?? (target.type === "blank" ? "" : address)}
          placeholder="Address: https://…, paperos://preview/index.html, paperos://docs"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setDraft(target.type === "blank" ? "" : address);
            e.target.select();
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              commitDraft();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <datalist id={`browser-urls-${shape.id}`}>
          {bookmarks.map((b) => (
            <option key={b.url} value={b.url}>
              {b.title}
            </option>
          ))}
          <option value="paperos://preview/" />
          <option value="paperos://docs/README.md" />
          <option value="paperos://legacy" />
          <option value="paperos://home" />
        </datalist>
        <button
          type="button"
          className={`pos-button pos-button--small${bookmarked ? " pos-button--primary" : ""}`}
          aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
          aria-pressed={bookmarked}
          title={
            project
              ? bookmarked
                ? "Remove bookmark"
                : "Bookmark this page (browser/bookmarks.json)"
              : "Open a project to keep bookmarks"
          }
          data-testid="browser-bookmark"
          disabled={!project || target.type === "blank"}
          onClick={toggleBookmark}
        >
          {bookmarked ? "★" : "☆"}
        </button>
        <Dropdown label="Go" small testId="browser-go">
          <MenuItem
            label="▶ Project preview"
            onSelect={() => commit(navigate(state, "paperos://preview/"))}
          />
          <MenuItem
            label="⌂ PaperOS landing"
            onSelect={() => commit(navigate(state, HOME_ADDRESS))}
          />
          <MenuItem
            label="Legacy prototype"
            onSelect={() => commit(navigate(state, "paperos://legacy"))}
          />
          <MenuSeparator />
          <MenuHeading>Docs</MenuHeading>
          {DOC_FILES.map((d) => (
            <MenuItem
              key={d}
              label={d}
              testId={`browser-doc-${d.replace(/[^a-z0-9]/gi, "-")}`}
              onSelect={() => commit(navigate(state, `paperos://docs/${d}`))}
            />
          ))}
          <MenuSeparator />
          <MenuHeading>Bookmarks</MenuHeading>
          {bookmarks.length === 0 && (
            <MenuItem label="No bookmarks yet" disabled onSelect={() => {}} />
          )}
          {bookmarks.map((b) => (
            <MenuItem
              key={b.url}
              label={b.title}
              onSelect={() => commit(navigate(state, b.url))}
            />
          ))}
          {project && (
            <>
              <MenuSeparator />
              <MenuItem
                label="Edit bookmarks.json"
                onSelect={() => {
                  void saveBookmarks(bookmarks).then(() =>
                    openFile(editor, { project, path: BOOKMARKS_PATH })
                  );
                }}
              />
            </>
          )}
        </Dropdown>
        <button
          type="button"
          className="pos-button pos-button--small"
          title="Open this page in a new browser tab (outside PaperOS)"
          data-testid="browser-open-external"
          disabled={!externalUrl}
          onClick={openExternal}
        >
          Open in new tab ↗
        </button>
      </div>
      <div className="pos-browser__body">{body}</div>
    </div>
  );
}

/** What "Open in new tab" opens for a target; null when there is nothing outside the canvas to open. */
export function externalHref(target: BrowserTarget): string | null {
  switch (target.type) {
    case "http":
      return target.url;
    case "home":
      return withBasePath("/");
    case "legacy":
      return withBasePath("/legacy");
    default:
      return null;
  }
}

// ----- bookmarks --------------------------------------------------------------

function useBookmarks(project: string | null) {
  const store = getProjectStore();
  const changes = useSignal(store.changes);
  const tick = useSignal(docsChanged);
  const [text, setText] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!project) {
      setText(null);
      return;
    }
    let cancelled = false;
    void readLiveText(project, BOOKMARKS_PATH, store).then((t) => {
      if (!cancelled) setText(t);
    });
    return () => {
      cancelled = true;
    };
  }, [project, store, changes, tick]);

  const bookmarks = useMemo(() => parseBookmarks(text), [text]);
  const save = useCallback(
    async (list: Bookmark[]) => {
      if (!project) return;
      const next = serializeBookmarks(list);
      await writeLiveText(project, BOOKMARKS_PATH, next);
      setText(next);
    },
    [project]
  );
  return { bookmarks, save };
}

// ----- blank tab --------------------------------------------------------------

function BlankPage({
  bookmarks,
  onOpen,
}: {
  bookmarks: Bookmark[];
  onOpen: (url: string) => void;
}) {
  return (
    <div className="pos-browser__blank" data-testid="browser-blank">
      <p className="pos-browser__blank-hint">
        Type an address above, or pick a bookmark.
      </p>
      <div className="pos-browser__tiles">
        {bookmarks.map((b) => (
          <button
            key={b.url}
            type="button"
            className="pos-browser__tile"
            onClick={() => onOpen(b.url)}
          >
            <span className="pos-browser__tile-title">{b.title}</span>
            <span className="pos-browser__tile-url">{b.url}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ----- project preview ----------------------------------------------------------

/** The project preview inside the browser: same bundler as the Preview window, rebuilt from live buffers. */
function ProjectFrame({
  entry,
  onNavigate,
  onTitle,
}: {
  entry: string;
  onNavigate: (url: string) => void;
  onTitle: (title: string) => void;
}) {
  const store = getProjectStore();
  const state = useSignal(store.state);
  const changes = useSignal(store.changes);
  const docTick = useSignal(docsChanged);
  const reloadTick = useSignal(previewReload);
  const project = state.activeId;
  const iframe = useRef<HTMLIFrameElement>(null);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [srcdoc, setSrcdoc] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const parsed = splitEntry(entry);
  const queryText = entry.includes("?") ? entry.slice(entry.indexOf("?")) : "";

  useEffect(() => {
    void store.init();
    if (!project) {
      setPaths([]);
      return;
    }
    let off = () => {};
    let cancelled = false;
    void store.session(project).then((s) => {
      if (!s || cancelled) return;
      const sync = () =>
        setPaths(
          s.files
            .get()
            .filter((f) => f.type === "file")
            .map((f) => f.path)
        );
      sync();
      off = s.files.subscribe(sync);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store, project]);

  const resolved =
    paths === null
      ? null
      : parsed.path && paths.includes(parsed.path)
        ? parsed.path
        : pickEntry(paths);

  useEffect(() => {
    if (resolved) onTitle(`Preview: ${resolved}`);
  }, [resolved, onTitle]);

  useEffect(() => {
    if (!project || !resolved || !paths) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const out = await bundle(
        resolved,
        (p) => readLiveText(project, p, store),
        { list: () => paths, context: parsed.query }
      );
      if (cancelled) return;
      setSrcdoc(out.html);
      setMissing(out.missing);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    resolved,
    paths,
    store,
    changes,
    docTick,
    reloadTick,
    queryText,
  ]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      if (!isPreviewMessage(e.data)) return;
      if (e.data.type === "console" && e.data.level)
        pushConsole(e.data.level, (e.data.args ?? []).join(" "));
      if (e.data.type === "navigate" && e.data.page) {
        const next = pagePath(e.data.page);
        if (paths?.includes(next))
          onNavigate(`paperos://preview/${next}${queryText}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [paths, onNavigate, queryText]);

  if (paths === null) return <div className="pos-files__hint">Loading…</div>;
  if (!project)
    return (
      <div className="pos-browser__card">
        <strong>No project is open.</strong>
        <p>Open a project to preview it here.</p>
      </div>
    );
  if (!resolved)
    return (
      <div className="pos-browser__card">
        <strong>Nothing to preview.</strong>
        <p>
          {parsed.path
            ? `${parsed.path} is not in this project.`
            : "Add an index.html to the project."}
        </p>
      </div>
    );
  return (
    <>
      {missing.length > 0 && (
        <div className="pos-preview__warn" role="status">
          Missing: {missing.join(", ")}
        </div>
      )}
      <iframe
        ref={iframe}
        className="pos-browser__frame"
        title={`Preview of ${resolved}`}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        srcDoc={srcdoc}
        onWheel={stopEventPropagation}
      />
    </>
  );
}

// ----- docs -----------------------------------------------------------------------

function DocFrame({
  doc,
  onNavigate,
}: {
  doc: string;
  onNavigate: (url: string) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const text = await loadDoc(doc);
      if (cancelled) return;
      if (text === null) {
        setError(`No such document: ${doc}. Try ${DOC_FILES.join(", ")}.`);
        return;
      }
      const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import("marked"),
        import("dompurify"),
      ]);
      const raw = await marked.parse(text, { gfm: true, breaks: false });
      const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
      const dom = new DOMParser().parseFromString(clean, "text/html");
      for (const a of Array.from(dom.querySelectorAll("a[href]"))) {
        const href = a.getAttribute("href") ?? "";
        const hit = resolveDocLink(doc, href);
        if (hit) a.setAttribute("href", `paperos://docs/${hit}`);
      }
      if (!cancelled) {
        setError(null);
        setHtml(docDocument(doc, dom.body.innerHTML));
      }
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Links inside the document open in this tab.
  const onLoad = () => {
    const win = iframe.current?.contentWindow;
    const d = win?.document;
    if (!d) return;
    d.addEventListener("click", (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      e.preventDefault();
      onNavigate(href);
    });
  };

  if (error)
    return (
      <div className="pos-browser__card" data-testid="browser-doc-error">
        <strong>Document not found</strong>
        <p>{error}</p>
      </div>
    );
  if (html === null) return <div className="pos-files__hint">Loading…</div>;
  return (
    <iframe
      ref={iframe}
      className="pos-browser__frame"
      title={doc}
      sandbox="allow-same-origin"
      srcDoc={html}
      onLoad={onLoad}
      onWheel={stopEventPropagation}
      data-testid="browser-doc-frame"
    />
  );
}

// ----- external pages -----------------------------------------------------------

function ExternalFrame({
  url,
  force,
  onForce,
  onOpenExternal,
}: {
  url: string;
  force: boolean;
  onForce: () => void;
  onOpenExternal: () => void;
}) {
  const startedAt = useMemo(() => Date.now(), []);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setTimedOut(true), EMBED_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded]);
  const verdict = judgeEmbed({
    url,
    startedAt,
    now: timedOut ? startedAt + EMBED_TIMEOUT_MS : startedAt,
    loaded,
    force,
  });
  const listed = isBlockedHost(url);

  if (verdict === "refused")
    return (
      <RefusedCard
        url={url}
        canForce={listed && !force}
        onForce={onForce}
        onOpenExternal={onOpenExternal}
      />
    );
  return (
    <>
      {verdict === "loading" && (
        <div className="pos-browser__loading" role="status">
          Loading {addressTitle(url)}…
        </div>
      )}
      <iframe
        className="pos-browser__frame"
        title={url}
        src={url}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        onLoad={() => setLoaded(true)}
        onWheel={stopEventPropagation}
      />
    </>
  );
}

function RefusedCard({
  url,
  canForce,
  onForce,
  onOpenExternal,
}: {
  url: string;
  canForce: boolean;
  onForce: () => void;
  onOpenExternal: () => void;
}) {
  const client = getBridgeClient();
  const status = useSignal(client?.status ?? OFF);
  const [shot, setShot] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viaBridge = async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const r = (await client.request("browser.screenshot", { url })) as {
        dataUrl: string;
        width: number;
        height: number;
      };
      setShot(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-browser__card" data-testid="browser-refused">
      <strong>{REFUSED_MESSAGE}</strong>
      <p className="pos-browser__card-url">{url}</p>
      <div className="pos-browser__card-actions">
        <button
          type="button"
          className="pos-button pos-button--small pos-button--primary"
          onClick={onOpenExternal}
        >
          Open in new tab ↗
        </button>
        {canForce && (
          <button
            type="button"
            className="pos-button pos-button--small"
            title="Load it in the frame anyway (the site may still show a blank page)"
            onClick={onForce}
          >
            Try anyway
          </button>
        )}
        <button
          type="button"
          className="pos-button pos-button--small"
          disabled={status !== "connected" || busy}
          title={
            status === "connected"
              ? "Ask the local agent bridge to open the page in a real browser (Playwright) and show a screenshot"
              : "Turn on the Agent bridge in the top bar and start the CLI to browse here"
          }
          onClick={() => void viaBridge()}
        >
          {busy ? "Fetching…" : "Screenshot via bridge"}
        </button>
      </div>
      {status !== "connected" && (
        <p className="pos-browser__card-hint">
          Agent bridge: {status === "waiting" ? "waiting for the CLI" : "off"}.
          See docs/MCP.md for `browser_fetch` and `browser_screenshot`.
        </p>
      )}
      {error && <p className="pos-browser__card-error">{error}</p>}
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="pos-browser__shot"
          src={shot.dataUrl}
          alt={`Screenshot of ${url}`}
          width={shot.width}
          height={shot.height}
        />
      )}
    </div>
  );
}
