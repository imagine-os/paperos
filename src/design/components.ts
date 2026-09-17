/**
 * Component definitions: `design/components/<name>.json`.
 *
 *   {
 *     "name": "Card", "description": "...", "category": "Layout", "icon": "▭",
 *     "props": [{ "name": "title", "type": "string", "default": "Title" }, ...],
 *     "slots": ["children"],
 *     "template": "<div class=\"ds-card\"><h3>{title}</h3>{@children}</div>",
 *     "variants": [{ "name": "outlined", "props": { "variant": "outlined" } }],
 *     "bindings": [{ "table": "products", "fields": ["name"], "mode": "read" }]
 *   }
 *
 * Prop types drive the inspector in the Design and Page Builder windows:
 * `table` offers the schema's tables, `field` / `fields` the columns of the
 * table named by `of` (default `table`), `select` its `options`, `html`
 * raw markup, `list` an array (JSON), `json` anything. Templates are
 * rendered by `render.ts`.
 */

export const COMPONENTS_DIR = "design/components/";
export const DESIGN_README_PATH = "design/README.md";

export const PROP_TYPES = [
  "string",
  "number",
  "boolean",
  "select",
  "color",
  "icon",
  "html",
  "table",
  "field",
  "fields",
  "list",
  "json",
] as const;

export type PropType = (typeof PROP_TYPES)[number];

export interface PropDef {
  name: string;
  type: PropType;
  default?: unknown;
  description?: string;
  /** For `select`: the choices. */
  options?: string[];
  /** For `field` / `fields`: the prop holding the table name (default `table`). */
  of?: string;
  required?: boolean;
}

export interface ComponentVariant {
  name: string;
  description?: string;
  props: Record<string, unknown>;
}

export interface ComponentBinding {
  table: string;
  fields?: string[];
  mode?: "read" | "write";
}

export interface ComponentDef {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  props: PropDef[];
  slots: string[];
  template: string;
  variants: ComponentVariant[];
  bindings?: ComponentBinding[];
}

const NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function isComponentName(name: unknown): name is string {
  return typeof name === "string" && NAME_RE.test(name);
}

export function componentPath(name: string): string {
  return `${COMPONENTS_DIR}${name}.json`;
}

/** `design/components/Card.json` -> `Card`; null for anything else. */
export function componentFromPath(path: string): string | null {
  const m = /^design\/components\/([A-Za-z][A-Za-z0-9_-]*)\.json$/.exec(path);
  return m ? m[1] : null;
}

export function isDesignPath(path: string): boolean {
  return path.startsWith("design/");
}

/** Parses one component file. Tolerant: missing lists default to empty, bad entries are reported. */
export function parseComponent(
  text: string,
  path?: string
): { component: ComponentDef | null; errors: string[] } {
  const errors: string[] = [];
  const where = path ?? "component";
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      component: null,
      errors: [
        `${where}: not valid JSON (${e instanceof Error ? e.message : String(e)})`,
      ],
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { component: null, errors: [`${where}: must be an object`] };
  const r = raw as Record<string, unknown>;
  const fallbackName = path ? componentFromPath(path) : null;
  const name = isComponentName(r.name) ? r.name : fallbackName;
  if (!name) {
    errors.push(`${where}: missing or invalid "name"`);
    return { component: null, errors };
  }
  if (typeof r.template !== "string")
    errors.push(`${where}: missing "template"`);

  const props: PropDef[] = [];
  if (Array.isArray(r.props)) {
    for (const p of r.props) {
      if (typeof p !== "object" || p === null) continue;
      const q = p as Record<string, unknown>;
      if (
        typeof q.name !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(q.name)
      ) {
        errors.push(`${where}: invalid prop name ${JSON.stringify(q.name)}`);
        continue;
      }
      const type = (PROP_TYPES as readonly string[]).includes(String(q.type))
        ? (q.type as PropType)
        : "string";
      if (q.type !== undefined && type !== q.type)
        errors.push(
          `${where}.${q.name}: unknown prop type "${String(q.type)}"`
        );
      const def: PropDef = { name: q.name, type };
      if (q.default !== undefined) def.default = q.default;
      if (typeof q.description === "string") def.description = q.description;
      if (Array.isArray(q.options))
        def.options = q.options.map((o) => String(o));
      if (typeof q.of === "string") def.of = q.of;
      if (q.required === true) def.required = true;
      props.push(def);
    }
  } else if (typeof r.props === "object" && r.props !== null) {
    // {name: default} shorthand
    for (const [k, v] of Object.entries(r.props as Record<string, unknown>))
      props.push({
        name: k,
        type:
          typeof v === "number"
            ? "number"
            : typeof v === "boolean"
              ? "boolean"
              : Array.isArray(v)
                ? "list"
                : "string",
        default: v,
      });
  }

  const slots = Array.isArray(r.slots)
    ? r.slots.filter((s): s is string => typeof s === "string")
    : [];
  const variants: ComponentVariant[] = [];
  if (Array.isArray(r.variants)) {
    for (const v of r.variants) {
      if (typeof v !== "object" || v === null) continue;
      const q = v as Record<string, unknown>;
      if (typeof q.name !== "string") continue;
      variants.push({
        name: q.name,
        ...(typeof q.description === "string"
          ? { description: q.description }
          : {}),
        props:
          typeof q.props === "object" && q.props !== null
            ? (q.props as Record<string, unknown>)
            : {},
      });
    }
  }
  const component: ComponentDef = {
    name,
    props,
    slots,
    template: typeof r.template === "string" ? r.template : "",
    variants,
  };
  if (typeof r.description === "string") component.description = r.description;
  if (typeof r.category === "string") component.category = r.category;
  if (typeof r.icon === "string") component.icon = r.icon;
  if (Array.isArray(r.bindings)) {
    component.bindings = r.bindings
      .filter(
        (b): b is Record<string, unknown> =>
          typeof b === "object" &&
          b !== null &&
          typeof (b as Record<string, unknown>).table === "string"
      )
      .map((b) => ({
        table: b.table as string,
        ...(Array.isArray(b.fields)
          ? {
              fields: b.fields.filter(
                (f): f is string => typeof f === "string"
              ),
            }
          : {}),
        ...(b.mode === "write" ? { mode: "write" as const } : {}),
      }));
  }
  return { component, errors };
}

export function serializeComponent(c: ComponentDef): string {
  return JSON.stringify(c, null, 2) + "\n";
}

/** Default value of every prop (the inspector starts from these). */
export function defaultProps(c: ComponentDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of c.props) if (p.default !== undefined) out[p.name] = p.default;
  return out;
}

/** Parses every `design/components/*.json` of a file list, sorted by name. */
export function parseComponents(files: { path: string; text: string }[]): {
  components: ComponentDef[];
  errors: string[];
} {
  const components: ComponentDef[] = [];
  const errors: string[] = [];
  for (const f of files) {
    if (!componentFromPath(f.path)) continue;
    const r = parseComponent(f.text, f.path);
    errors.push(...r.errors);
    if (r.component) {
      if (components.some((c) => c.name === r.component!.name))
        errors.push(`${f.path}: duplicate component "${r.component.name}"`);
      else components.push(r.component);
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  return { components, errors };
}
