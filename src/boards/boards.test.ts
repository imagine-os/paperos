import { describe, expect, it } from "vitest";
import { DEFAULT_BOARD_LAYOUT, layoutBoard, overlaps } from "./layout";
import {
  boardFromPath,
  boardPath,
  parseBoard,
  serializeBoard,
  tourSteps,
  validateBoard,
  type BoardDef,
} from "./model";
import { describeStep, moveTour, startTour, tourKeyAction } from "./tour";

const sample = (): BoardDef => ({
  name: "demo",
  title: "Demo",
  sections: [
    {
      id: "data",
      title: "1. Data",
      grid: "grid",
      cell: { w: 500, h: 300 },
      windows: [
        { id: "roles", kind: "data", content: { table: "roles" } },
        { id: "users", kind: "data", content: { table: "users" } },
        { id: "items", kind: "data", content: { table: "menu_items" } },
        { id: "pages", kind: "data", content: { table: "pages" } },
      ],
    },
    {
      id: "schema",
      title: "2. Schema",
      grid: "single",
      windows: [{ id: "erd", kind: "schema", size: { w: 700, h: 500 } }],
    },
    {
      id: "design",
      title: "3a. Design",
      grid: "stack",
      column: 2,
      windows: [
        { id: "tokens", kind: "design", size: { w: 600, h: 400 } },
        { id: "gallery", kind: "design", size: { w: 600, h: 400 } },
      ],
    },
    {
      id: "builder",
      title: "3b. Page Builder",
      grid: "single",
      column: 2,
      windows: [{ id: "pb", kind: "pages", size: { w: 900, h: 600 } }],
    },
    {
      id: "preview",
      title: "4. Preview",
      grid: "row",
      windows: [
        { id: "phone", kind: "preview", size: { w: 390, h: 780 } },
        { id: "tablet", kind: "preview", size: { w: 820, h: 700 } },
      ],
    },
    {
      id: "free",
      title: "5. Free",
      grid: "free",
      windows: [
        {
          id: "n1",
          kind: "note",
          at: { x: 0, y: 0 },
          size: { w: 300, h: 200 },
        },
        {
          id: "n2",
          kind: "note",
          at: { x: 340, y: 120 },
          size: { w: 300, h: 200 },
        },
      ],
    },
  ],
  arrows: [
    { from: "data", to: "schema", label: "tables" },
    { from: "erd", to: "tokens", label: "columns" },
    { from: "pb", to: "phone" },
  ],
  steps: [
    { section: "data", title: "Start with data", caption: "Four tables." },
    { section: "schema", caption: "One diagram." },
    { section: "preview", caption: "Two devices." },
  ],
});

describe("board files", () => {
  it("round-trips through parse and serialize", () => {
    const text = serializeBoard(sample());
    const { board, errors } = parseBoard(text, boardPath("demo"));
    expect(errors).toEqual([]);
    expect(board).toEqual(sample());
    expect(boardFromPath("boards/demo.json")).toBe("demo");
    expect(boardFromPath("boards/x/demo.json")).toBeNull();
    expect(boardFromPath("pages/demo.json")).toBeNull();
  });

  it("takes the name from the path, defaults grids and reports problems", () => {
    const { board, errors } = parseBoard(
      JSON.stringify({
        title: "T",
        sections: [
          {
            title: "A",
            grid: "diagonal",
            windows: [{ kind: "note" }, { id: "a", kind: "note" }, { id: "b" }],
          },
          { id: "a", windows: [] },
        ],
        arrows: [{ from: "nope", to: "a" }, { from: "a" }],
        steps: [{ section: "zzz", caption: "?" }, { caption: "no section" }],
      }),
      "boards/from-path.json"
    );
    expect(board?.name).toBe("from-path");
    expect(board?.sections[0].grid).toBe("columns");
    expect(board?.sections[0].windows).toHaveLength(2);
    expect(board?.sections[0].windows[0].id).toBe("section-1-1");
    expect(errors).toEqual([
      'boards/from-path.json.section-1: unknown grid "diagonal"',
      'boards/from-path.json.section-1.windows[2]: missing "kind"',
      'boards/from-path.json: duplicate id "a"',
      'boards/from-path.json.arrows[0]: unknown "from" nope',
      'boards/from-path.json.arrows[1]: needs "from" and "to"',
      'boards/from-path.json.steps[0]: unknown section "zzz"',
      'boards/from-path.json.steps[1]: needs "section"',
    ]);
    expect(validateBoard(board!)).toEqual([
      'section "a" has no windows',
      'duplicate id "a"',
    ]);
    expect(parseBoard("{", "b").errors[0]).toMatch(/not valid JSON/);
    expect(parseBoard("[]").board).toBeNull();
  });

  it("falls back to one tour step per section", () => {
    const b = sample();
    b.steps = [];
    b.sections[0].notes = "n";
    expect(tourSteps(b).map((s) => s.section)).toEqual(
      b.sections.map((s) => s.id)
    );
    expect(tourSteps(b)[0].caption).toBe("n");
  });
});

describe("layoutBoard", () => {
  it("places sections left to right, stacks shared columns, and never overlaps", () => {
    const l = layoutBoard(sample(), { origin: { x: 100, y: 50 } });
    expect(l.sections.map((s) => s.id)).toEqual([
      "data",
      "schema",
      "design",
      "builder",
      "preview",
      "free",
    ]);
    const by = Object.fromEntries(l.sections.map((s) => [s.id, s]));
    // Columns run left to right with the section gap between them.
    expect(by.schema.x).toBeGreaterThanOrEqual(
      by.data.x + by.data.w + DEFAULT_BOARD_LAYOUT.sectionGap - 1
    );
    expect(by.design.x).toBeGreaterThan(by.schema.x + by.schema.w);
    // Design and builder share column 2: same left band, builder below design.
    expect(by.builder.y).toBeGreaterThanOrEqual(by.design.y + by.design.h);
    expect(
      Math.abs(
        by.builder.x + by.builder.w / 2 - (by.design.x + by.design.w / 2)
      )
    ).toBeLessThan(1);
    expect(by.preview.x).toBeGreaterThan(by.builder.x + by.builder.w);
    // Every window sits inside its frame, under the title band.
    for (const w of l.windows) {
      const s = by[w.section];
      expect(w.x).toBeGreaterThanOrEqual(s.x + DEFAULT_BOARD_LAYOUT.padding);
      expect(w.y).toBeGreaterThanOrEqual(
        s.y + DEFAULT_BOARD_LAYOUT.padding + DEFAULT_BOARD_LAYOUT.header
      );
      expect(w.x + w.w).toBeLessThanOrEqual(
        s.x + s.w - DEFAULT_BOARD_LAYOUT.padding + 0.5
      );
      expect(w.y + w.h).toBeLessThanOrEqual(
        s.y + s.h - DEFAULT_BOARD_LAYOUT.padding + 0.5
      );
    }
    for (const a of l.windows)
      for (const b of l.windows)
        if (a !== b) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
    for (const a of l.sections)
      for (const b of l.sections)
        if (a !== b) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
    expect(l.windows).toHaveLength(12);
    expect(l.bounds.x).toBe(100);
    expect(l.bounds.w).toBeGreaterThan(3000);
  });

  it("arranges each grid as promised", () => {
    const l = layoutBoard(sample());
    const win = (id: string) => l.windows.find((w) => w.id === id)!;
    // grid of four 500x300 cells: two columns, two rows.
    expect(win("roles").y).toBe(win("users").y);
    expect(win("items").y).toBeGreaterThan(win("roles").y);
    expect(win("items").x).toBe(win("roles").x);
    expect(Math.round(win("roles").w)).toBe(500);
    // single keeps its size; row keeps own sizes side by side; stack keeps sizes vertically.
    expect([win("erd").w, win("erd").h]).toEqual([700, 500]);
    expect(win("phone").w).toBe(390);
    expect(win("tablet").x).toBe(
      win("phone").x + 390 + DEFAULT_BOARD_LAYOUT.gap
    );
    expect(win("gallery").y).toBe(
      win("tokens").y + 400 + DEFAULT_BOARD_LAYOUT.gap
    );
    // free honors `at`.
    expect(win("n2").x - win("n1").x).toBe(340);
    expect(win("n2").y - win("n1").y).toBe(120);
  });

  it("uses the board's own gap and bento shapes", () => {
    const b = sample();
    b.gap = 20;
    b.sections = [
      {
        id: "b",
        title: "Bento",
        grid: "bento-1-2",
        windows: [
          { id: "x", kind: "note" },
          { id: "y", kind: "note" },
          { id: "z", kind: "note" },
        ],
      },
      {
        id: "c",
        title: "C",
        grid: "single",
        windows: [{ id: "q", kind: "note" }],
      },
    ];
    const l = layoutBoard(b);
    expect(l.sections[1].x - (l.sections[0].x + l.sections[0].w)).toBe(20);
    const x = l.windows.find((w) => w.id === "x")!;
    const y = l.windows.find((w) => w.id === "y")!;
    const z = l.windows.find((w) => w.id === "z")!;
    expect(x.h).toBeGreaterThan(y.h);
    expect(z.y).toBeGreaterThan(y.y);
    expect(overlaps(x, y)).toBe(false);
  });
});

describe("tour", () => {
  it("starts, steps, clamps at the start and stops past the end", () => {
    const b = sample();
    const s0 = startTour(b)!;
    expect(s0).toEqual({ board: "demo", title: "Demo", step: 0, total: 3 });
    expect(moveTour(s0, -1)).toEqual({ ...s0, step: 0 });
    const s1 = moveTour(s0, 1)!;
    expect(describeStep(b, s1)).toMatchObject({
      section: "schema",
      stepTitle: "2. Schema",
      caption: "One diagram.",
      first: false,
      last: false,
    });
    const s2 = moveTour(s1, 1)!;
    expect(describeStep(b, s2).last).toBe(true);
    expect(moveTour(s2, 1)).toBeNull();
    expect(startTour(b, 99)?.step).toBe(2);
    expect(describeStep(b, s0).stepTitle).toBe("Start with data");
    expect(startTour({ ...b, sections: [], steps: [] })).toBeNull();
  });

  it("maps keys to actions", () => {
    expect(tourKeyAction("ArrowRight")).toBe("next");
    expect(tourKeyAction(" ")).toBe("next");
    expect(tourKeyAction("ArrowLeft")).toBe("prev");
    expect(tourKeyAction("Escape")).toBe("stop");
    expect(tourKeyAction("a")).toBeNull();
  });
});

describe("sample boards", () => {
  it("ship valid, openable boards", async () => {
    const { sampleBoardFiles } = await import("@/ide/project/sample-boards");
    const files = sampleBoardFiles();
    expect(Object.keys(files).sort()).toEqual([
      "boards/agent-driven.json",
      "boards/build-product.json",
      "boards/ship-feature.json",
    ]);
    for (const [path, text] of Object.entries(files)) {
      const { board, errors } = parseBoard(text, path);
      expect(errors, path).toEqual([]);
      expect(validateBoard(board!), path).toEqual([]);
      const l = layoutBoard(board!);
      for (const a of l.windows)
        for (const b of l.windows)
          if (a !== b) expect(overlaps(a, b), `${path}: ${a.id} / ${b.id}`).toBe(false);
      // Left to right: every column starts right of the previous one.
      const xs = l.sections.map((s) => s.column);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });
});
