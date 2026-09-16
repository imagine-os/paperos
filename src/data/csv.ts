/** CSV in and out (RFC 4180 style: quotes, doubled quotes, CRLF or LF). */
import type { Row } from "./schema";

const cell = (v: unknown): string => {
  const s =
    v === undefined || v === null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Row[], columns: string[]): string {
  const lines = [columns.map(cell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

/** Parses CSV text into string cells; the first line is the header. */
export function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const src = text.replace(/^﻿/, "");
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    records.push(row);
  }
  const nonEmpty = records.filter((r) => r.some((c) => c !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return {
    headers,
    rows: nonEmpty.map((r) =>
      Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
    ),
  };
}
