import type { Metadata } from "next";
import Link from "next/link";
import { LandingVisual } from "./landing-visual";
import "./landing.css";

export const metadata: Metadata = {
  title: "PaperOS - the canvas that builds software",
  description:
    "PaperOS is a zoomable canvas that works like an OS desktop: windows, a tiling window manager, an IDE, data, a design system and pages, all programmable and agent-ready. Local-first, runs in your browser.",
};

const GITHUB = "https://github.com/imagine-os/paperos";
const PLAN = `${GITHUB}/blob/main/docs/PLAN.md`;

/* Small stroke icons (24px grid, currentColor) */
const icons = {
  windows: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="8" height="16" rx="2" />
      <rect x="13" y="4" width="8" height="7" rx="2" />
      <rect x="13" y="13" width="8" height="7" rx="2" />
    </svg>
  ),
  code: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18M9 12l-2 2 2 2M15 12l2 2-2 2" />
    </svg>
  ),
  data: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
      <path d="M11 7h4a2 2 0 0 1 2 2v5M7 10v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  pages: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H14l5 5v9.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M14 4v5h5M8 13h8M8 16.5h5" />
    </svg>
  ),
  plug: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0zM12 15v6" />
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  ),
};

const FEATURES: Array<{
  icon: keyof typeof icons;
  title: string;
  body: React.ReactNode;
}> = [
  {
    icon: "windows",
    title: "Windows & tiling",
    body: (
      <>
        Every tool is a window on an infinite, zoomable canvas. A tiling engine
        snaps them into columns, grids, bento layouts or an i3-style split tree,
        and workspaces remember the arrangement.
      </>
    ),
  },
  {
    icon: "code",
    title: "An IDE in windows",
    body: (
      <>
        File tree, CodeMirror editors, live preview and a console are windows
        you arrange like any other. Open a folder, a ZIP or a GitHub repo; every
        file is a Yjs document, so collaboration is a provider away.
      </>
    ),
  },
  {
    icon: "data",
    title: "Data with connections",
    body: (
      <>
        Tables are JSON files in the project. A Data grid, a Schema diagram and
        a Connections view show which pages and components use each table, and
        the preview renders straight from the data.
      </>
    ),
  },
  {
    icon: "pages",
    title: "Design system & pages",
    body: (
      <>
        Tokens, components and pages live beside the code. Compose pages from
        data-bound components and see them in the preview, on the same canvas as
        the tables they read from.
      </>
    ),
  },
  {
    icon: "plug",
    title: "Programmable: Script, plugins, MCP",
    body: (
      <>
        A typed Canvas API (<code>window.paperos</code>) drives windows,
        layouts, files and data. Write scripts, load plugins, or connect an
        agent over a local MCP bridge and watch it work.
      </>
    ),
  },
  {
    icon: "lock",
    title: "Local-first & private",
    body: (
      <>
        Everything runs in the browser and survives a refresh. No accounts, keys
        or servers; the MCP bridge is a small CLI on your machine and nothing
        leaves it.
      </>
    ),
  },
];

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Open a project",
    body: "Start with the sample, drop in a folder or a ZIP, or import a GitHub repository. Files, data and pages appear as windows.",
  },
  {
    title: "Arrange windows into a flow",
    body: "Tile the editor next to the preview, the data grid under the schema. Save the arrangement as a workspace and switch with one key.",
  },
  {
    title: "Build with data, design and code",
    body: "Edit a table and the preview updates; change a component and the pages follow. Then hand the canvas to an agent over MCP and let it drive.",
  },
];

const AUDIENCE: Array<{ title: string; body: string }> = [
  {
    title: "Founders",
    body: "Sketch the product, the data model and the first pages in one place, and keep them in a plain Git repository you own.",
  },
  {
    title: "Small teams",
    body: "One canvas for design, data and code means fewer hand-offs. Workspaces capture how each person likes to work.",
  },
  {
    title: "Agents",
    body: "Every action is an API call and an MCP tool. Agents see the same windows you do and their moves are visible and pausable.",
  },
];

function ArrowIcon() {
  return (
    <svg
      className="land-arrow"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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
              <a href="#features">Features</a>
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
              Open the demo
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
              <strong>windows</strong>, a tiling window manager, an IDE, data, a
              design system and pages, all programmable and agent-ready.
            </p>
            <div className="land-cta land-rise">
              <Link
                className="land-btn land-btn--primary"
                href="/app"
                data-testid="cta-demo"
              >
                Open the demo
                <ArrowIcon />
              </Link>
              <Link
                className="land-btn"
                href="/legacy"
                data-testid="cta-legacy"
              >
                See the 2025 prototype
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
              Works best in a desktop browser. Press <code>Alt+1</code>..
              <code>Alt+5</code> for layouts, <code>Ctrl+K</code> for the
              command palette.
            </p>

            <div className="land-visual">
              <div className="land-visual__frame">
                <LandingVisual />
                <div className="land-visual__glare" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section
          className="land-section"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="land-wrap">
            <div className="land-section__head">
              <span className="land-kicker">What is inside</span>
              <h2 id="features-title">One canvas. Every tool is a window.</h2>
              <p>
                PaperOS has a single primitive, the window, and everything else
                is built from it. That is what makes the whole desktop
                arrangeable, saveable and scriptable.
              </p>
            </div>
            <ul className="land-grid">
              {FEATURES.map((f) => (
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
          id="built-for"
          aria-labelledby="audience-title"
        >
          <div className="land-wrap">
            <div className="land-section__head">
              <span className="land-kicker">Built for</span>
              <h2 id="audience-title">
                People who ship small things fast, and the agents that help
                them.
              </h2>
            </div>
            <ul className="land-audience">
              {AUDIENCE.map((a) => (
                <li key={a.title}>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </li>
              ))}
            </ul>
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
                  PaperOS v2 is a rebuild in progress. The demo is what exists
                  today; it is stable enough to try and rough in places. State
                  lives in your browser (localStorage and IndexedDB), so a
                  cleared site storage is a fresh start. The roadmap and every
                  architecture decision are in the plan.
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
                    Windows, tiling layouts, workspaces
                  </li>
                  <li className="is-done">
                    IDE: files, editors, preview, console, palette
                  </li>
                  <li className="is-done">
                    Canvas API, Script window, plugins
                  </li>
                  <li className="is-done">Local MCP bridge for agents</li>
                  <li className="is-done">Data: tables, schema, connections</li>
                  <li className="is-done">
                    Design system, page builder, project map
                  </li>
                </ul>
              </div>
              <div>
                <h3>Next</h3>
                <ul>
                  <li className="is-now">Full-stack sample project</li>
                  <li>Real-time collaboration</li>
                  <li>Polish and a plugin catalogue</li>
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
