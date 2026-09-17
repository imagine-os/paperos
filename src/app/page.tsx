import type { Metadata } from "next";
import Link from "next/link";
import { withBasePath } from "@/lib/env";
import "./landing.css";

export const metadata: Metadata = {
  title: "PaperOS - the canvas that builds software",
  description:
    "PaperOS is a zoomable canvas that works like an OS desktop: windows, a tiling window manager, an IDE, data, boards, a browser, a terminal, live rooms and an agent bridge. Local-first, runs in your browser.",
};

const GITHUB = "https://github.com/imagine-os/paperos";
const PLAN = `${GITHUB}/blob/main/docs/PLAN.md`;

/* Small stroke icons (24px grid, currentColor) */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const icons = {
  windows: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="8" height="16" rx="2" />
      <rect x="13" y="4" width="8" height="7" rx="2" />
      <rect x="13" y="13" width="8" height="7" rx="2" />
    </svg>
  ),
  boards: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="2.5" y="5" width="5.5" height="14" rx="1.5" />
      <rect x="9.5" y="5" width="5.5" height="14" rx="1.5" />
      <rect x="16.5" y="5" width="5" height="14" rx="1.5" />
      <path d="M8 12h1.5M15 12h1.5" />
    </svg>
  ),
  lineage: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="6" height="5" rx="1.5" />
      <rect x="3" y="15" width="6" height="5" rx="1.5" />
      <rect x="15" y="9.5" width="6" height="5" rx="1.5" />
      <path d="M9 6.5h2.5a2 2 0 0 1 2 2V12h1.5M9 17.5h2.5a2 2 0 0 0 2-2V12" />
    </svg>
  ),
  saas: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6M4 20h16" />
    </svg>
  ),
  browser: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M12 15h5" />
    </svg>
  ),
  rooms: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="9" r="3.5" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20a6 6 0 0 1 12 0M15 19.5a4.5 4.5 0 0 1 6 0" />
    </svg>
  ),
  agent: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0zM12 15v6" />
    </svg>
  ),
};

const INSIDE: Array<{
  icon: keyof typeof icons;
  title: string;
  body: React.ReactNode;
}> = [
  {
    icon: "windows",
    title: "Windows and tiling",
    body: (
      <>
        Every tool is a window on an infinite canvas. Columns, grid, bento and
        an i3-style split tree tile them (<code>Alt+1</code> to{" "}
        <code>Alt+5</code>); workspaces remember the arrangement; a keyboard map
        (<code>?</code>) lists every shortcut.
      </>
    ),
  },
  {
    icon: "boards",
    title: "Boards and tours",
    body: (
      <>
        A board is a project file of sections laid out left to right with arrows
        between windows. Play it and the camera walks the sections with
        captions; save your own canvas as a board.
      </>
    ),
  },
  {
    icon: "lineage",
    title: "Data, schema and lineage",
    body: (
      <>
        Tables are JSON files with a grid, a schema diagram and a connections
        view. Data lineage draws tables, the components that bind them and the
        pages they render on, with labeled arrows.
      </>
    ),
  },
  {
    icon: "saas",
    title: "Small Business SaaS sample",
    body: (
      <>
        Fifteen tables seeded for five tenants, twenty pages in four apps, a
        design system with theme presets and a showcase board with its own tour.
        One click from the Open menu.
      </>
    ),
  },
  {
    icon: "browser",
    title: "Browser window",
    body: (
      <>
        Tabs, an address bar and bookmarks saved in the project. Internal{" "}
        <code>paperos://</code> addresses show the preview, the docs and the
        prototype; the web loads in a sandboxed frame.
      </>
    ),
  },
  {
    icon: "terminal",
    title: "Terminal window",
    body: (
      <>
        A project shell with <code>ls</code>, <code>grep</code>, pipes and
        completion over the live files, plus PaperOS commands; a real shell on
        your machine through the bridge when you allow it.
      </>
    ),
  },
  {
    icon: "rooms",
    title: "Rooms",
    body: (
      <>
        Share opens a live room: the same windows and files for everyone,
        cursors and selections, names on editor carets. Peer to peer by default,
        or a one-file relay you run yourself. No account.
      </>
    ),
  },
  {
    icon: "agent",
    title: "Agent bridge",
    body: (
      <>
        A typed Canvas API (<code>window.paperos</code>) drives windows,
        layouts, files, data and boards. Scripts, plugins and a local MCP bridge
        let an agent work on the same canvas you see.
      </>
    ),
  },
];

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Open a project",
    body: "Start with the sample, drop in a folder or a ZIP, or import a GitHub repository. Files, data, pages and boards appear as windows.",
  },
  {
    title: "Arrange windows into a flow",
    body: "Tile the editor next to the preview, the data grid under the schema. Save the arrangement as a workspace, or lay a story out as a board and play it.",
  },
  {
    title: "Build with data, design and code",
    body: "Edit a table and the preview updates; change a component and the pages follow. Share a room, or hand the canvas to an agent over MCP.",
  },
];

/** The screenshots `npm run shots` writes to public/shots/, in carousel order. */
const SHOTS: Array<{ name: string; title: string; alt: string }> = [
  {
    name: "desktop-ide",
    title: "The desktop",
    alt: "The PaperOS desktop with Files, an editor, the live preview and a console tiled into the IDE workspace.",
  },
  {
    name: "board-build-product",
    title: "A board",
    alt: "The Build a product board: data tables, the schema diagram, design tokens, the page builder and three device previews laid out left to right with arrows.",
  },
  {
    name: "data-lineage",
    title: "Data lineage",
    alt: "The data lineage board: table cards on the left, component cards in the middle, page cards on the right, connected by labeled arrows.",
  },
  {
    name: "showcase-saas",
    title: "The SaaS sample",
    alt: "The Small Business SaaS showcase board with previews of the customer app, admin, site and growth pages.",
  },
  {
    name: "share-window",
    title: "Share",
    alt: "The Share window next to a note, a preview and an editor: name, transport, password and Create a room.",
  },
];

function ArrowIcon() {
  return (
    <svg className="land-arrow" viewBox="0 0 16 16" {...stroke}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2" />
    </svg>
  );
}

/** Five screenshots, one visible at a time; radios and labels do the switching (no JavaScript). */
function Shots() {
  return (
    <div className="land-shots" data-testid="landing-shots">
      {SHOTS.map((s, i) => (
        <input
          key={s.name}
          type="radio"
          name="shot"
          id={`shot-${i + 1}`}
          className="land-shots__radio"
          defaultChecked={i === 0}
          aria-label={`Screenshot ${i + 1} of ${SHOTS.length}: ${s.title}`}
        />
      ))}
      <div className="land-shots__frame">
        <div className="land-shots__track">
          {SHOTS.map((s, i) => (
            <figure key={s.name} className="land-shots__slide">
              <img
                src={withBasePath(`/shots/${s.name}.webp`)}
                srcSet={`${withBasePath(`/shots/${s.name}.webp`)} 1600w, ${withBasePath(`/shots/${s.name}@2x.webp`)} 3200w`}
                sizes="(min-width: 1200px) 1120px, 100vw"
                width={1600}
                height={1000}
                alt={s.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i === 0 ? "high" : "auto"}
              />
              <figcaption>
                <strong>{s.title}</strong>
                {s.alt}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="land-shots__nav" role="group" aria-label="Screenshots">
        {SHOTS.map((s, i) => (
          <label
            key={s.name}
            htmlFor={`shot-${i + 1}`}
            className="land-shots__dot"
          >
            <span>{s.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="land">
      <a className="land-skip" href="#main">
        Skip to content
      </a>

      <header className="land-header">
        <div className="land-wrap">
          <Link className="land-brand" href="/" aria-label="PaperOS home">
            <span className="land-logo" aria-hidden="true" />
            PaperOS
            <span className="land-badge">v2 preview</span>
          </Link>
          <nav className="land-nav" aria-label="Site">
            <div className="land-nav__links">
              <a href="#inside">What is inside</a>
              <a href="#how">How it works</a>
              <a href="#status">Status</a>
              <a href={GITHUB} rel="noopener">
                GitHub
              </a>
            </div>
            <Link className="land-btn land-btn--ghost" href="/legacy">
              2025 prototype
            </Link>
            <Link
              className="land-btn land-btn--primary"
              href="/app"
              data-testid="nav-demo"
            >
              Try the demo
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="land-hero" data-testid="landing-hero">
          <div className="land-wrap">
            <p className="land-eyebrow land-rise">
              <span className="land-eyebrow__dot" aria-hidden="true" />
              Live demo, no sign-up. Runs entirely in your browser.
            </p>
            <h1 className="land-rise">
              PaperOS: the canvas that{" "}
              <span className="land-grad">builds software</span>
            </h1>
            <p className="land-lede land-rise">
              A zoomable canvas that works like an OS desktop:{" "}
              <strong>windows</strong>, a tiling window manager, an IDE, data
              and pages, boards, a browser, a terminal, live rooms and an agent
              bridge.
            </p>
            <div className="land-cta land-rise">
              <Link
                className="land-btn land-btn--primary"
                href="/app"
                data-testid="cta-demo"
              >
                Try the demo
                <ArrowIcon />
              </Link>
              <Link
                className="land-btn"
                href="/app?board=build-product"
                data-testid="cta-board"
              >
                Open a board
              </Link>
              <a
                className="land-btn land-btn--ghost"
                href={GITHUB}
                rel="noopener"
                data-testid="cta-source"
              >
                <GitHubIcon />
                Source on GitHub
              </a>
            </div>
            <p className="land-cta__note land-rise">
              Works best in a desktop browser. A short tour starts on the first
              visit; press <code>?</code> for every shortcut and{" "}
              <code>Ctrl+K</code> for the command palette.
            </p>

            <Shots />

            <div className="land-links">
              <Link
                className="land-btn land-btn--ghost"
                href="/app?board=build-product"
              >
                Open the &quot;Build a product&quot; board
                <ArrowIcon />
              </Link>
              <Link
                className="land-btn land-btn--ghost"
                href="/app?board=collaborate"
              >
                Open the &quot;Collaborate&quot; board
                <ArrowIcon />
              </Link>
              <Link
                className="land-btn land-btn--ghost"
                href="/legacy"
                data-testid="cta-legacy"
              >
                See the 2025 prototype
              </Link>
            </div>
          </div>
        </section>

        <section
          className="land-section"
          id="inside"
          aria-labelledby="inside-title"
        >
          <div className="land-wrap">
            <div className="land-section__head">
              <span className="land-kicker">What is inside</span>
              <h2 id="inside-title">One canvas. Every tool is a window.</h2>
              <p>
                PaperOS has a single primitive, the window, and everything else
                is built from it. This is what ships in the demo today.
              </p>
            </div>
            <ul className="land-grid">
              {INSIDE.map((f) => (
                <li key={f.title} className="land-card land-tile">
                  <span className="land-tile__icon">{icons[f.icon]}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="land-section land-section--alt"
          id="how"
          aria-labelledby="how-title"
        >
          <div className="land-wrap">
            <div className="land-section__head">
              <span className="land-kicker">How it works</span>
              <h2 id="how-title">
                From an empty canvas to a running app in three moves.
              </h2>
            </div>
            <ol className="land-steps">
              {STEPS.map((s) => (
                <li key={s.title} className="land-step">
                  <span className="land-step__num" aria-hidden="true" />
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="land-section"
          id="status"
          aria-labelledby="status-title"
        >
          <div className="land-wrap">
            <div className="land-card land-status">
              <div className="land-status__intro">
                <span className="land-kicker">Status</span>
                <h2 id="status-title">A v2 preview, built in the open.</h2>
                <p>
                  Milestones M0 to M9 of the plan are done; the demo is that
                  code. State lives in your browser (localStorage and
                  IndexedDB): About &gt; Reset local data starts over. Every
                  milestone and architecture decision is written down in the
                  plan.
                </p>
                <a className="land-btn" href={PLAN} rel="noopener">
                  Read the plan
                  <ArrowIcon />
                </a>
              </div>
              <div>
                <h3>Working today</h3>
                <ul>
                  <li className="is-done">
                    Windows, tiling layouts, workspaces (M0, M1)
                  </li>
                  <li className="is-done">
                    IDE: files, editors, preview, console, palette (M2)
                  </li>
                  <li className="is-done">
                    Canvas API, Script window, plugins, MCP bridge (M3)
                  </li>
                  <li className="is-done">
                    Data: tables, schema, connections (M4)
                  </li>
                  <li className="is-done">
                    Design system, page builder, project map (M5)
                  </li>
                  <li className="is-done">
                    Boards, tours, data lineage, the SaaS sample (M6)
                  </li>
                  <li className="is-done">Browser and Terminal windows (M7)</li>
                  <li className="is-done">
                    Rooms: shared canvas, cursors, files (M8)
                  </li>
                  <li className="is-done">
                    Polish: tour, keyboard map, error recovery, a11y (M9)
                  </li>
                </ul>
              </div>
              <div>
                <h3>Not yet</h3>
                <ul>
                  <li className="is-now">
                    Themes beyond light and dark; workspace export and import
                  </li>
                  <li className="is-now">A plugin catalogue (GenMoji first)</li>
                  <li>Binary files in projects (images other than SVG)</li>
                  <li>
                    A full terminal emulator (the bridge shell strips ANSI)
                  </li>
                  <li>
                    TURN for rooms behind strict NATs (use the relay), relay
                    persistence
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="land-footer">
        <div className="land-wrap">
          <p>PaperOS v2 preview. Built on tldraw, CodeMirror and Yjs.</p>
          <nav aria-label="Footer">
            <ul>
              <li>
                <Link href="/app">Demo</Link>
              </li>
              <li>
                <Link href="/app?board=build-product">Open a board</Link>
              </li>
              <li>
                <Link href="/legacy">2025 prototype</Link>
              </li>
              <li>
                <a href={GITHUB} rel="noopener">
                  GitHub
                </a>
              </li>
              <li>
                <a href={PLAN} rel="noopener">
                  Plan
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB}/blob/main/docs/CANVAS_API.md`}
                  rel="noopener"
                >
                  Canvas API
                </a>
              </li>
              <li>
                <a href={`${GITHUB}/blob/main/docs/MCP.md`} rel="noopener">
                  MCP guide
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
