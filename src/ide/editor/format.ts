import { extname } from "../project/paths";

/** Prettier parser for a file, or null when the file type is not supported. */
export function formatterFor(path: string): string | null {
  switch (extname(path)) {
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "babel";
    case "ts":
    case "tsx":
    case "mts":
      return "typescript";
    case "css":
    case "scss":
    case "less":
      return extname(path);
    case "html":
    case "htm":
      return "html";
    case "json":
    case "jsonc":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    default:
      return null;
  }
}

/** Formats `text` with Prettier standalone (plugins load on demand). */
export async function formatSource(
  path: string,
  text: string
): Promise<string> {
  const parser = formatterFor(path);
  if (!parser)
    throw new Error(`No formatter for .${extname(path) || "?"} files`);
  const [prettier, babel, estree, postcss, html, markdown, typescript] =
    await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/html"),
      import("prettier/plugins/markdown"),
      import("prettier/plugins/typescript"),
    ]);
  return prettier.format(text, {
    parser,
    plugins: [
      babel.default,
      estree.default,
      postcss.default,
      html.default,
      markdown.default,
      typescript.default,
    ],
  });
}
