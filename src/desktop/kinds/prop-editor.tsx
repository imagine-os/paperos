"use client";

import { useEffect, useState } from "react";
import type { PropDef } from "@/design/components";
import type { DataSchema } from "@/data/schema";

/** One typed input per prop; `table` / `field` / `fields` props read the schema. */
export function PropEditor({
  defs,
  values,
  schema,
  onChange,
}: {
  defs: PropDef[];
  values: Record<string, unknown>;
  schema: DataSchema;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <div className="pos-props">
      {defs.map((p) => (
        <label key={p.name} className="pos-props__row" title={p.description}>
          <span className="pos-props__name">
            {p.name}
            <small>{p.type}</small>
          </span>
          <PropInput
            def={p}
            value={values[p.name]}
            values={values}
            schema={schema}
            onChange={(v) => onChange(p.name, v)}
          />
        </label>
      ))}
      {defs.length === 0 && (
        <div className="pos-connections__muted">
          This component has no props.
        </div>
      )}
    </div>
  );
}

function PropInput({
  def,
  value,
  values,
  schema,
  onChange,
}: {
  def: PropDef;
  value: unknown;
  values: Record<string, unknown>;
  schema: DataSchema;
  onChange: (value: unknown) => void;
}) {
  const tableName = String(values[def.of ?? "table"] ?? "");
  const table = schema.tables.find((t) => t.name === tableName);
  switch (def.type) {
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(e) => onChange(e.target.checked)}
          data-testid={`prop-${def.name}`}
        />
      );
    case "number":
      return (
        <input
          className="pos-input"
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
          data-testid={`prop-${def.name}`}
        />
      );
    case "select":
      return (
        <select
          className="pos-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        >
          {!(def.options ?? []).includes(String(value ?? "")) && (
            <option value={String(value ?? "")}>{String(value ?? "")}</option>
          )}
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "table":
      return (
        <select
          className="pos-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        >
          <option value="">(none)</option>
          {schema.tables.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      );
    case "field":
      return (
        <select
          className="pos-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        >
          <option value="">(auto)</option>
          {(table?.columns ?? []).map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
          {!table && value !== undefined && value !== "" && (
            <option value={String(value)}>{String(value)}</option>
          )}
        </select>
      );
    case "fields": {
      const list = Array.isArray(value) ? value.map(String) : [];
      if (!table)
        return (
          <span className="pos-connections__muted">pick a table first</span>
        );
      return (
        <div className="pos-props__checks" data-testid={`prop-${def.name}`}>
          {table.columns.map((c) => (
            <label key={c.name} className="pos-props__check">
              <input
                type="checkbox"
                checked={list.includes(c.name)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...list, c.name]
                      : list.filter((f) => f !== c.name)
                  )
                }
              />
              {c.name}
            </label>
          ))}
          <small className="pos-connections__muted">
            {list.length === 0 ? "all columns" : `${list.length} selected`}
          </small>
        </div>
      );
    }
    case "color":
      return (
        <input
          className="pos-input"
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        />
      );
    case "html":
      return (
        <textarea
          className="pos-input pos-props__textarea"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        />
      );
    case "list":
    case "json":
      return (
        <JsonInput
          value={value}
          onChange={onChange}
          testId={`prop-${def.name}`}
        />
      );
    default:
      return (
        <input
          className="pos-input"
          type="text"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`prop-${def.name}`}
        />
      );
  }
}

/** A textarea holding JSON; commits only when it parses. */
function JsonInput({
  value,
  onChange,
  testId,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  testId: string;
}) {
  const pretty = JSON.stringify(value ?? [], null, 1);
  const [draft, setDraft] = useState(pretty);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(pretty);
    setBad(false);
  }, [pretty]);
  return (
    <textarea
      className={`pos-input pos-props__textarea${bad ? " pos-input--error" : ""}`}
      value={draft}
      data-testid={testId}
      onChange={(e) => {
        setDraft(e.target.value);
        try {
          onChange(JSON.parse(e.target.value));
          setBad(false);
        } catch {
          setBad(true);
        }
      }}
    />
  );
}
