/**
 * The hero scene: a stylized PaperOS desktop drawn as one inline SVG so it
 * scales without layout shift and needs no images. Colors come from the
 * landing tokens (CSS variables), so it follows light and dark. The windows
 * fade in and the connectors draw themselves (see landing.css, `.hv-*`);
 * prefers-reduced-motion shows the finished scene at once.
 */

const WIN = {
  files: { x: 20, y: 60, w: 250, h: 644 },
  editor: { x: 284, y: 60, w: 540, h: 380 },
  data: { x: 284, y: 454, w: 540, h: 250 },
  preview: { x: 838, y: 60, w: 342, h: 330 },
  console: { x: 838, y: 404, w: 342, h: 300 },
} as const;

type Rect = { x: number; y: number; w: number; h: number };

function Window({
  r,
  title,
  focused,
  children,
}: {
  r: Rect;
  title: string;
  focused?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <g className="hv-win">
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={10}
        fill="var(--land-surface)"
        stroke={focused ? "var(--land-accent)" : "var(--land-line-strong)"}
        strokeWidth={focused ? 1.5 : 1}
      />
      <line
        x1={r.x + 1}
        y1={r.y + 32}
        x2={r.x + r.w - 1}
        y2={r.y + 32}
        stroke="var(--land-line)"
      />
      <text x={r.x + 12} y={r.y + 21} fontSize={13} className="hv-text">
        {title}
      </text>
      <g fill="var(--land-line-strong)">
        <circle cx={r.x + r.w - 44} cy={r.y + 16} r={3} />
        <circle cx={r.x + r.w - 30} cy={r.y + 16} r={3} />
        <circle cx={r.x + r.w - 16} cy={r.y + 16} r={3} />
      </g>
      {children}
    </g>
  );
}

const FILES: Array<[string, number, boolean?]> = [
  ["src/", 0],
  ["app.js", 1],
  ["store.css", 1],
  ["components/", 0],
  ["card.json", 1],
  ["menu.json", 1],
  ["pages/", 0],
  ["index.json", 1],
  ["data/", 0],
  ["schema.json", 1],
  ["products.json", 1, true],
];

const CODE: Array<Array<[string, string?]>> = [
  [
    ["import", "a"],
    [" { paperos } ", ""],
    ["from", "a"],
    [' "paperos";', "c"],
  ],
  [],
  [
    ["const", "a"],
    [" products = ", ""],
    ["await", "a"],
    [" paperos.data", ""],
    [".list(", ""],
    ['"products"', "c"],
    [");", ""],
  ],
  [],
  [
    ["paperos.windows.", ""],
    ["create", "b"],
    ["({ kind: ", ""],
    ['"preview"', "c"],
    [", title: ", ""],
    ['"Store"', "c"],
    [" });", ""],
  ],
  [
    ["paperos.layout.", ""],
    ["apply", "b"],
    ["(", ""],
    ['"bento-1-2"', "c"],
    [");", ""],
  ],
  [],
  [
    ["export default", "a"],
    [" products.", ""],
    ["map", "b"],
    ["((p) => card(p));", ""],
  ],
];

const ROWS: Array<[string, string, string]> = [
  ["Notebook A5", "12.00", "40"],
  ["Fountain pen", "38.00", "12"],
  ["Ink, sepia", "9.50", "88"],
  ["Desk pad", "24.00", "7"],
];

export function LandingVisual() {
  const { files, editor, data, preview, console: con } = WIN;
  return (
    <svg
      viewBox="0 0 1200 720"
      role="img"
      aria-label="A PaperOS desktop: Files, Editor, Data, Preview and Console windows tiled on a dotted canvas, with connectors from the code and the data table into the preview and an agent chip driving the layout."
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="hv-dots"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="var(--land-dot)" />
        </pattern>
        <marker
          id="hv-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M 1 1 L 9 5 L 1 9"
            fill="none"
            stroke="var(--land-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <linearGradient id="hv-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--land-accent-3)" />
          <stop offset="0.5" stopColor="var(--land-accent)" />
          <stop offset="1" stopColor="var(--land-accent-2)" />
        </linearGradient>
      </defs>

      {/* canvas */}
      <rect width="1200" height="720" fill="var(--land-bg-2)" />
      <rect width="1200" height="720" fill="url(#hv-dots)" />

      {/* top bar */}
      <rect width="1200" height="44" fill="var(--land-surface)" />
      <line x1="0" y1="44" x2="1200" y2="44" stroke="var(--land-line)" />
      <rect
        x="16"
        y="12"
        width="20"
        height="20"
        rx="6"
        fill="url(#hv-accent)"
      />
      <rect
        x="21.5"
        y="17.5"
        width="9"
        height="9"
        rx="2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <text x="44" y="27" fontSize="14" className="hv-text">
        PaperOS
      </text>
      <rect
        x="116"
        y="13"
        width="72"
        height="18"
        rx="9"
        fill="none"
        stroke="var(--land-line-strong)"
      />
      <text
        x="152"
        y="26"
        fontSize="10"
        textAnchor="middle"
        className="hv-text hv-text--muted"
        letterSpacing="0.4"
      >
        V2 PREVIEW
      </text>
      <text x="230" y="27" fontSize="12" className="hv-text hv-text--muted">
        Layout ▾
      </text>
      <text x="306" y="27" fontSize="12" className="hv-text hv-text--muted">
        Workspaces ▾
      </text>
      <text x="410" y="27" fontSize="12" className="hv-text hv-text--muted">
        New window ▾
      </text>
      <circle
        cx="1040"
        cy="22"
        r="4"
        fill="var(--land-ok)"
        className="hv-pulse"
      />
      <text x="1052" y="27" fontSize="12" className="hv-text hv-text--muted">
        Agent bridge: connected
      </text>

      {/* Files */}
      <Window r={files} title="Files">
        {FILES.map(([name, depth, active], i) => {
          const y = files.y + 58 + i * 26;
          return (
            <g key={name}>
              {active && (
                <rect
                  x={files.x + 8}
                  y={y - 16}
                  width={files.w - 16}
                  height={24}
                  rx={6}
                  fill="var(--land-surface-2)"
                />
              )}
              {depth === 0 ? (
                <path
                  d={`M ${files.x + 18} ${y - 7} l 5 4 l -5 4 z`}
                  fill="var(--land-muted)"
                />
              ) : (
                <rect
                  x={files.x + 36}
                  y={y - 9}
                  width={8}
                  height={10}
                  rx={1.5}
                  fill="none"
                  stroke="var(--land-muted)"
                  strokeWidth={1.2}
                />
              )}
              <text
                x={files.x + 30 + depth * 22}
                y={y}
                fontSize={12.5}
                className={active ? "hv-text" : "hv-text hv-text--muted"}
                fontWeight={active ? 600 : 500}
              >
                {name}
              </text>
            </g>
          );
        })}
      </Window>

      {/* Editor */}
      <Window r={editor} title="Editor · src/app.js">
        <rect
          x={editor.x + 1}
          y={editor.y + 33}
          width={editor.w - 2}
          height={editor.h - 34}
          fill="var(--land-surface)"
        />
        <rect
          x={editor.x + 1}
          y={editor.y + 54 + 7 * 24 - 15}
          width={editor.w - 2}
          height={22}
          fill="var(--land-surface-2)"
        />
        {CODE.map((tokens, i) => {
          const y = editor.y + 54 + i * 24;
          return (
            <g key={i}>
              <text
                x={editor.x + 28}
                y={y}
                fontSize={12}
                textAnchor="end"
                className="hv-mono hv-mono--muted"
              >
                {i + 1}
              </text>
              <text x={editor.x + 44} y={y} fontSize={12.5} className="hv-mono">
                {tokens.map(([t, k], j) => (
                  <tspan key={j} className={k ? `hv-mono--${k}` : undefined}>
                    {t}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <rect
          x={editor.x + 44 + 8 * 7.55}
          y={editor.y + 54 + 7 * 24 - 12}
          width={1.5}
          height={16}
          fill="var(--land-accent)"
          className="hv-cursor"
        />
        {/* status line */}
        <line
          x1={editor.x + 1}
          y1={editor.y + editor.h - 28}
          x2={editor.x + editor.w - 1}
          y2={editor.y + editor.h - 28}
          stroke="var(--land-line)"
        />
        <text
          x={editor.x + 12}
          y={editor.y + editor.h - 10}
          fontSize={11}
          className="hv-mono hv-mono--muted"
        >
          JavaScript · saved · Prettier
        </text>
        <text
          x={editor.x + editor.w - 12}
          y={editor.y + editor.h - 10}
          fontSize={11}
          textAnchor="end"
          className="hv-mono hv-mono--muted"
        >
          Ln 8, Col 9
        </text>
      </Window>

      {/* Data */}
      <Window r={data} title="Data · products">
        <g fontSize={12} className="hv-mono">
          <text
            x={data.x + 16}
            y={data.y + 58}
            className="hv-text hv-text--muted"
            fontSize={11}
            letterSpacing="0.4"
          >
            NAME
          </text>
          <text
            x={data.x + 300}
            y={data.y + 58}
            className="hv-text hv-text--muted"
            fontSize={11}
            letterSpacing="0.4"
          >
            PRICE
          </text>
          <text
            x={data.x + 420}
            y={data.y + 58}
            className="hv-text hv-text--muted"
            fontSize={11}
            letterSpacing="0.4"
          >
            STOCK
          </text>
          <line
            x1={data.x + 1}
            y1={data.y + 68}
            x2={data.x + data.w - 1}
            y2={data.y + 68}
            stroke="var(--land-line)"
          />
          {ROWS.map(([name, price, stock], i) => {
            const y = data.y + 96 + i * 34;
            return (
              <g key={name}>
                {i === 1 && (
                  <rect
                    x={data.x + 1}
                    y={y - 21}
                    width={data.w - 2}
                    height={32}
                    fill="color-mix(in srgb, var(--land-accent) 8%, transparent)"
                  />
                )}
                <text x={data.x + 16} y={y} className="hv-mono">
                  {name}
                </text>
                <text x={data.x + 300} y={y} className="hv-mono hv-mono--b">
                  {price}
                </text>
                <text
                  x={data.x + 420}
                  y={y}
                  className={
                    Number(stock) < 10 ? "hv-mono hv-mono--a" : "hv-mono"
                  }
                >
                  {stock}
                </text>
                <line
                  x1={data.x + 1}
                  y1={y + 11}
                  x2={data.x + data.w - 1}
                  y2={y + 11}
                  stroke="var(--land-line)"
                />
              </g>
            );
          })}
        </g>
        <text
          x={data.x + 12}
          y={data.y + data.h - 10}
          fontSize={11}
          className="hv-mono hv-mono--muted"
        >
          4 rows · data/products.json · used by pages/index.json,
          components/card.json
        </text>
      </Window>

      {/* Preview */}
      <Window r={preview} title="Preview · Store" focused>
        <rect
          x={preview.x + 14}
          y={preview.y + 46}
          width={preview.w - 28}
          height={preview.h - 60}
          rx={8}
          fill="var(--land-bg)"
          stroke="var(--land-line)"
        />
        <rect
          x={preview.x + 14}
          y={preview.y + 46}
          width={preview.w - 28}
          height={30}
          rx={8}
          fill="var(--land-surface)"
        />
        <line
          x1={preview.x + 14}
          y1={preview.y + 76}
          x2={preview.x + preview.w - 14}
          y2={preview.y + 76}
          stroke="var(--land-line)"
        />
        <text
          x={preview.x + 28}
          y={preview.y + 66}
          fontSize={12}
          className="hv-text"
        >
          Paper Goods
        </text>
        <rect
          x={preview.x + preview.w - 84}
          y={preview.y + 53}
          width={56}
          height={16}
          rx={8}
          fill="url(#hv-accent)"
        />
        <text
          x={preview.x + 28}
          y={preview.y + 108}
          fontSize={16}
          className="hv-text"
          fontWeight={700}
        >
          Everything for the desk
        </text>
        <text
          x={preview.x + 28}
          y={preview.y + 126}
          fontSize={11}
          className="hv-text hv-text--muted"
        >
          Rendered from data/products.json
        </text>
        {ROWS.map(([name, price], i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = preview.x + 28 + col * 150;
          const y = preview.y + 144 + row * 62;
          return (
            <g key={name}>
              <rect
                x={x}
                y={y}
                width={136}
                height={52}
                rx={6}
                fill="var(--land-surface)"
                stroke="var(--land-line)"
              />
              <rect
                x={x + 8}
                y={y + 8}
                width={36}
                height={36}
                rx={5}
                fill={`color-mix(in srgb, var(--land-accent) ${14 + i * 10}%, var(--land-surface-2))`}
              />
              <text x={x + 52} y={y + 22} fontSize={11} className="hv-text">
                {name}
              </text>
              <text
                x={x + 52}
                y={y + 38}
                fontSize={11}
                className="hv-mono hv-mono--b"
              >
                ${price}
              </text>
            </g>
          );
        })}
      </Window>

      {/* Console */}
      <Window r={con} title="Console">
        <g fontSize={12} className="hv-mono">
          <text x={con.x + 16} y={con.y + 60}>
            <tspan className="hv-mono--muted">›</tspan> paperos.layout.apply(
            <tspan className="hv-mono--c">&quot;bento-1-2&quot;</tspan>)
          </text>
          <text x={con.x + 16} y={con.y + 84}>
            <tspan className="hv-mono--ok">✓</tspan> 5 windows tiled
          </text>
          <text x={con.x + 16} y={con.y + 108}>
            <tspan className="hv-mono--muted">›</tspan> paperos.data.list(
            <tspan className="hv-mono--c">&quot;products&quot;</tspan>)
          </text>
          <text x={con.x + 16} y={con.y + 132}>
            <tspan className="hv-mono--ok">←</tspan> 4 rows
          </text>
          <text x={con.x + 16} y={con.y + 156}>
            <tspan className="hv-mono--muted">›</tspan> paperos.files.write(
            <tspan className="hv-mono--c">&quot;src/app.js&quot;</tspan>)
          </text>
          <text x={con.x + 16} y={con.y + 180}>
            <tspan className="hv-mono--ok">✓</tspan> saved · preview reloaded
          </text>
          <text x={con.x + 16} y={con.y + 204} className="hv-mono--muted">
            agent bridge: connected (MCP)
          </text>
        </g>
        <rect
          x={con.x + 16}
          y={con.y + 218}
          width={7}
          height={14}
          fill="var(--land-accent)"
          className="hv-cursor"
        />
      </Window>

      {/* connectors: code -> preview, data -> preview */}
      <path
        d="M 590 236 C 720 236, 720 156, 830 156"
        className="hv-link"
        markerEnd="url(#hv-arrow)"
      />
      <circle cx="590" cy="236" r="3.5" fill="var(--land-accent)" />
      <path
        d="M 650 600 C 760 600, 760 262, 830 262"
        className="hv-link hv-link--2"
        markerEnd="url(#hv-arrow)"
      />
      <circle cx="650" cy="600" r="3.5" fill="var(--land-accent)" />

      {/* agent chip */}
      <g className="hv-chip">
        <rect
          x="890"
          y="646"
          width="274"
          height="44"
          rx="22"
          fill="var(--land-surface)"
          stroke="var(--land-line-strong)"
          filter="drop-shadow(0 8px 20px rgba(0,0,0,0.18))"
        />
        <rect
          x="900"
          y="656"
          width="24"
          height="24"
          rx="12"
          fill="url(#hv-accent)"
        />
        <path
          d="M 907 668 l 4 4 l 8 -8"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="934" y="663" fontSize="11" className="hv-text hv-text--muted">
          Agent · via MCP
        </text>
        <text x="934" y="679" fontSize="12" className="hv-mono">
          layout_apply(
          <tspan className="hv-mono--c">&quot;bento-1-2&quot;</tspan>)
        </text>
      </g>
    </svg>
  );
}
