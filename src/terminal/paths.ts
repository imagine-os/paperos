/**
 * Path arithmetic for the project shell. Project paths are relative and
 * normalized ("" is the root, "src/app.js" a file); the shell shows them
 * with a leading slash. Pure.
 */

/** Resolves `arg` against `cwd` (both project paths); "" is the root. */
export function resolveShellPath(cwd: string, arg: string): string {
  const abs = arg.startsWith("/") ? arg : `${cwd ? cwd + "/" : ""}${arg}`;
  const out: string[] = [];
  for (const part of abs.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** `/src/app.js` style display of a project path. */
export function displayPath(path: string): string {
  return `/${path}`;
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function nameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** Is `path` directly inside `dir` ("" = root)? */
export function isChildOf(path: string, dir: string): boolean {
  if (!path) return false;
  return parentOf(path) === dir;
}

/** Is `path` inside `dir` at any depth ("" = root matches everything)? */
export function isUnder(path: string, dir: string): boolean {
  if (!dir) return path !== "";
  return path.startsWith(`${dir}/`);
}

/** Shell glob (`*`, `?`) on one path segment or a whole path, as a RegExp. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split("")
    .map((ch) => {
      if (ch === "*") return "[^/]*";
      if (ch === "?") return "[^/]";
      return /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    })
    .join("");
  return new RegExp(`^${escaped}$`);
}

export function hasGlob(s: string): boolean {
  return /[*?]/.test(s);
}
