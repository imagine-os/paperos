/** Strips ANSI escape sequences (colors, cursor moves, OSC titles) so raw shell output reads as plain text. Pure. */
export function stripAnsi(text: string): string {
  const ESC = "\u001b";
  return text
    .replace(
      new RegExp(`${ESC}\\][^\\u0007${ESC}]*(\\u0007|${ESC}\\\\)`, "g"),
      ""
    )
    .replace(new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g"), "")
    .replace(new RegExp(`${ESC}[()#][0-9A-Za-z]`, "g"), "")
    .replace(new RegExp(`${ESC}[=>]`, "g"), "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/**
 * Appends raw stream data to a list of lines: the last line grows until a
 * newline arrives, so a prompt without a trailing newline stays on one row.
 */
export function appendStream(lines: string[], chunk: string): string[] {
  const text = stripAnsi(chunk);
  if (!text) return lines;
  const parts = text.split("\n");
  const out = lines.length ? [...lines] : [""];
  out[out.length - 1] += parts[0];
  for (let i = 1; i < parts.length; i++) out.push(parts[i]);
  return out;
}
