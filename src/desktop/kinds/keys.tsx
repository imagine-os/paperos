"use client";

import { useMemo, useState } from "react";
import {
  stopEventPropagation,
  useActions,
  useTools,
  useTranslation,
} from "tldraw";
import { listCommands } from "@/ide/commands";
import {
  buildKeymap,
  filterKeymap,
  keyCaps,
  type TldrawShortcut,
} from "../keymap";

/**
 * The keyboard map: every shortcut grouped (desktop, windows, layouts,
 * canvas, editors, terminal), searchable. Built at render time from the
 * command registry and tldraw's actions and tools, so it cannot drift from
 * what the keys do. Opened with `?` and from the palette.
 */
export function KeysWindow() {
  const actions = useActions();
  const tools = useTools();
  const msg = useTranslation();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const tldraw: TldrawShortcut[] = [];
    for (const a of Object.values(actions)) {
      if (!a.kbd) continue;
      const label =
        typeof a.label === "string"
          ? a.label
          : (a.label?.default ?? a.label?.menu ?? a.id);
      tldraw.push({ id: a.id, label: msg(label as never), kbd: a.kbd });
    }
    for (const t of Object.values(tools)) {
      if (!t.kbd) continue;
      const label = typeof t.label === "string" ? t.label : t.id;
      tldraw.push({
        id: t.id,
        label: `Tool: ${msg(label as never)}`,
        kbd: t.kbd,
      });
    }
    return buildKeymap(listCommands(), tldraw);
  }, [actions, tools, msg]);

  const shown = filterKeymap(groups, query);
  const total = groups.reduce((n, g) => n + g.bindings.length, 0);

  return (
    <div
      className="pos-keys"
      data-testid="keys-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <input
          className="pos-files__search pos-keys__search"
          type="search"
          placeholder={`Search ${total} shortcuts...`}
          aria-label="Search shortcuts"
          value={query}
          data-testid="keys-search"
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className="pos-keys__body">
        {shown.length === 0 && (
          <div className="pos-files__hint">
            No shortcut matches &quot;{query}&quot;.
          </div>
        )}
        {shown.map((g) => (
          <section
            key={g.group}
            className="pos-keys__group"
            data-testid={`keys-group-${g.group.toLowerCase()}`}
            aria-labelledby={`keys-${g.group}`}
          >
            <h3 id={`keys-${g.group}`} className="pos-data__heading">
              {g.group}
            </h3>
            <table className="pos-keys__table">
              <tbody>
                {g.bindings.map((b) => (
                  <tr key={`${b.group}-${b.keys}`} data-source={b.source}>
                    <td className="pos-keys__label">{b.label}</td>
                    <td className="pos-keys__keys">
                      {keyCaps(b.keys).map((k, i) => (
                        <kbd key={i}>{k}</kbd>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <div className="pos-files__footer">
        Alt is PaperOS&apos;s modifier; tldraw&apos;s own keys work as usual on
        the canvas. Press ? anywhere to open this window.
      </div>
    </div>
  );
}
