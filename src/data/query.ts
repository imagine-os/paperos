/**
 * In-memory queries over a table's rows: a small filter grammar shared by
 * the Data window's filter box, the Canvas API and the preview runtime's
 * `data-filter` attribute, plus sorting and pagination.
 *
 * Filter grammar (tokens separated by spaces, all must match):
 *   word           any column contains "word" (case-insensitive)
 *   col:word       column contains "word"
 *   col=value      equal (numbers and booleans compare by value; `null` matches empty)
 *   col!=value     not equal
 *   col>v col>=v col<v col<=v   numeric or string comparison
 * Quote a value with "..." to keep spaces.
 */
import type { Row } from "./schema";

export interface SortSpec {
  column: string;
  dir: "asc" | "desc";
}

export interface QueryOptions {
  /** Filter text in the grammar above. */
  filter?: string;
  /** Column equals value, for every entry. */
  where?: Record<string, unknown>;
  /** `"col"`, `"-col"`, `"col desc"` or a SortSpec. */
  sort?: string | SortSpec | null;
  /** 1-based page (with pageSize). */
  page?: number;
  pageSize?: number;
  /** Alternative to page/pageSize. */
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
}

interface Term {
  column: string | null;
  op: ":" | "=" | "!=" | ">" | ">=" | "<" | "<=" | "~";
  value: string;
}

export function tokenize(filter: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filter))) tokens.push(m[1] !== undefined ? m[1] : m[2]);
  return tokens;
}

export function parseFilter(filter: string): Term[] {
  return tokenize(filter.trim())
    .map((tok): Term | null => {
      const m = /^([A-Za-z_][A-Za-z0-9_.]*)(!=|>=|<=|=|>|<|:)(.*)$/.exec(tok);
      if (!m) return tok ? { column: null, op: "~", value: tok } : null;
      const value = m[3].replace(/^"(.*)"$/, "$1");
      return { column: m[1], op: m[2] as Term["op"], value };
    })
    .filter((t): t is Term => t !== null);
}

const asText = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Loose equality for filters: numbers/booleans by value, strings case-insensitively. */
export function looseEquals(cell: unknown, value: string): boolean {
  if (value === "null" || value === "")
    return cell === null || cell === undefined || cell === "";
  if (typeof cell === "number") return Number(value) === cell;
  if (typeof cell === "boolean") return value.toLowerCase() === String(cell);
  return asText(cell).toLowerCase() === value.toLowerCase();
}

function compareTo(cell: unknown, value: string): number | null {
  if (cell === undefined || cell === null) return null;
  const n = Number(value);
  if (typeof cell === "number" && value.trim() !== "" && Number.isFinite(n))
    return cell - n;
  const a = asText(cell);
  return a < value ? -1 : a > value ? 1 : 0;
}

export function matchesTerm(row: Row, term: Term): boolean {
  if (term.column === null) {
    const q = term.value.toLowerCase();
    return Object.values(row).some((v) => asText(v).toLowerCase().includes(q));
  }
  const cell = row[term.column];
  switch (term.op) {
    case ":":
    case "~":
      return asText(cell).toLowerCase().includes(term.value.toLowerCase());
    case "=":
      return looseEquals(cell, term.value);
    case "!=":
      return !looseEquals(cell, term.value);
    default: {
      const c = compareTo(cell, term.value);
      if (c === null) return false;
      if (term.op === ">") return c > 0;
      if (term.op === ">=") return c >= 0;
      if (term.op === "<") return c < 0;
      return c <= 0;
    }
  }
}

export function matchesFilter(row: Row, filter: string | Term[]): boolean {
  const terms = typeof filter === "string" ? parseFilter(filter) : filter;
  return terms.every((t) => matchesTerm(row, t));
}

/** Null and undefined sort last; numbers numerically; the rest as text. */
export function compareValues(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean")
    return Number(a) - Number(b);
  return asText(a).localeCompare(asText(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function parseSort(
  sort: string | SortSpec | null | undefined
): SortSpec | null {
  if (!sort) return null;
  if (typeof sort !== "string") return sort.column ? sort : null;
  const s = sort.trim();
  if (!s) return null;
  if (s.startsWith("-")) return { column: s.slice(1), dir: "desc" };
  const m = /^(\S+)\s+(asc|desc)$/i.exec(s);
  if (m) return { column: m[1], dir: m[2].toLowerCase() as SortSpec["dir"] };
  return { column: s, dir: "asc" };
}

export function sortRows(
  rows: Row[],
  sort: string | SortSpec | null | undefined
): Row[] {
  const spec = parseSort(sort);
  if (!spec) return rows;
  const sign = spec.dir === "desc" ? -1 : 1;
  return [...rows].sort(
    (a, b) => sign * compareValues(a[spec.column], b[spec.column])
  );
}

export function queryRows(
  rows: Row[],
  options: QueryOptions = {}
): QueryResult {
  let list = rows;
  if (options.where) {
    for (const [k, v] of Object.entries(options.where))
      list = list.filter((r) => looseEquals(r[k], asText(v)));
  }
  if (options.filter?.trim()) {
    const terms = parseFilter(options.filter);
    list = list.filter((r) => matchesFilter(r, terms));
  }
  list = sortRows(list, options.sort);
  const total = list.length;
  let page = 1;
  let pageCount = 1;
  if (options.pageSize && options.pageSize > 0) {
    pageCount = Math.max(1, Math.ceil(total / options.pageSize));
    page = Math.min(Math.max(1, options.page ?? 1), pageCount);
    list = list.slice((page - 1) * options.pageSize, page * options.pageSize);
  } else {
    const offset = Math.max(0, options.offset ?? 0);
    list = list.slice(
      offset,
      options.limit !== undefined ? offset + options.limit : undefined
    );
  }
  return { rows: list, total, page, pageCount };
}
