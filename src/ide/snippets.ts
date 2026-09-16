/** Ready-made scripts for the Script window's Snippets menu. */
export interface Snippet {
  id: string;
  title: string;
  code: string;
}

export const SNIPPETS: Snippet[] = [
  {
    id: "grid",
    title: "Tile everything in a grid",
    code: `// Tile every window in a grid and zoom to fit.
const state = paperos.layout.apply("grid");
paperos.canvas.zoomTo();
return state.tiled.length + " windows tiled";
`,
  },
  {
    id: "open-js",
    title: "Open every .js file",
    code: `// Open each JavaScript file of the active project in an editor.
const files = await paperos.files.list();
const js = files.filter((f) => f.type === "file" && f.path.endsWith(".js"));
for (const f of js) paperos.files.open(f.path);
return js.map((f) => f.path);
`,
  },
  {
    id: "notes",
    title: "Create a note per file",
    code: `// One note window per file, then arrange them in columns.
const files = await paperos.files.list();
const ids = [];
for (const f of files.filter((f) => f.type === "file")) {
  const { text } = await paperos.files.read(f.path);
  const w = paperos.windows.create({
    kind: "note",
    title: f.path,
    content: text.slice(0, 400),
  });
  ids.push(w.id);
}
paperos.layout.tile(ids);
return ids;
`,
  },
  {
    id: "screenshot",
    title: "Take a screenshot",
    code: `// Render the windows to a PNG (frames and titles) and show it below.
const shot = await paperos.canvas.screenshot({ scale: 0.5 });
console.log(shot.width + " x " + shot.height + " px");
return shot.dataUrl;
`,
  },
  {
    id: "events",
    title: "Subscribe to events",
    code: `// Log every event for 30 seconds. Create, move or close windows meanwhile.
const off = paperos.events.on("*", (e) => {
  console.log(e.name, JSON.stringify(e.payload));
});
setTimeout(off, 30_000);
return "listening for 30 s: " + paperos.events.list().join(", ");
`,
  },
];

export const DEFAULT_SCRIPT = `// The Canvas API is \`paperos\`; console output shows below. Ctrl+Enter runs.
// Scripts run in this page with its privileges: only run code you trust.
const windows = paperos.windows.list();
console.log(windows.length + " windows");
return windows.map((w) => w.kind + ": " + w.title);
`;
