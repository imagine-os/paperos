import type { FileMap } from "./types";

export const SAMPLE_NAME = "Sample site";

/** The tiny site every fresh install starts with. */
export function sampleProjectFiles(): FileMap {
  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Hello, PaperOS</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Hello, PaperOS</h1>
      <p>Edit <code>index.html</code>, <code>styles.css</code> or <code>app.js</code>
      and watch the preview update.</p>
      <button id="count">Clicked 0 times</button>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
    "styles.css": `:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #f4f4f8;
  color: #18181b;
}

main {
  padding: 32px;
  border-radius: 16px;
  background: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

h1 {
  margin-top: 0;
  color: #2563eb;
}

button {
  font: inherit;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #c9c9d1;
  background: #2563eb;
  color: white;
  cursor: pointer;
}
`,
    "app.js": `const button = document.querySelector("#count");
let clicks = 0;

button.addEventListener("click", () => {
  clicks += 1;
  button.textContent = \`Clicked \${clicks} time\${clicks === 1 ? "" : "s"}\`;
  console.log("clicked", clicks);
});

console.log("Hello from app.js");
`,
    "README.md": `# Sample site

A tiny HTML/CSS/JS site that ships with PaperOS so the IDE is never empty.

- **Files** shows the project tree. Click a file to open it in an editor.
- **Editor** is CodeMirror 6; press \`Ctrl+S\` to save.
- **Preview** renders \`index.html\` with the styles and scripts inlined and
  refreshes as you type.
- **Console** shows what the preview logs, and runs snippets in it.

Open your own code with **Open** in the top bar: a folder (Chromium), a ZIP,
or a public GitHub repository URL.
`,
  };
}
