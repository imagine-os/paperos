"use client";

import { useEffect, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { useSignal } from "@/ide/use-signal";
import { getPluginManager } from "@/plugins/install";
import { describeSource, type PluginEntry } from "@/plugins/types";
import type { WindowKindProps } from "../window-kinds";

/** Plugin manager: list, enable/disable, load from URL, project plugins, permissions note. */
export function PluginsWindow({ editor }: WindowKindProps) {
  const manager = getPluginManager();
  const entries = useSignal(manager?.entries ?? EMPTY);
  const [busy, setBusy] = useState<string | null>(null);

  // The manager appears shortly after mount on a fresh page.
  const [, force] = useState(0);
  useEffect(() => {
    if (manager) return;
    const t = setInterval(() => {
      if (getPluginManager()) force((n) => n + 1);
    }, 200);
    return () => clearInterval(t);
  }, [manager]);

  const toggle = async (p: PluginEntry) => {
    if (!manager) return;
    setBusy(p.id);
    await manager.toggle(p.id);
    setBusy(null);
  };

  const addUrl = async () => {
    if (!manager) return;
    const url = window.prompt(
      "URL of an ES module exporting activate(api).\nIt will run in this page with full access to it.",
      "https://"
    );
    if (!url || url === "https://") return;
    try {
      await manager.addUrl(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const groups: [string, PluginEntry[]][] = [
    ["Built-in", entries.filter((p) => p.source.type === "builtin")],
    [
      "From this project (plugins/*.js)",
      entries.filter((p) => p.source.type === "project"),
    ],
    ["From URL", entries.filter((p) => p.source.type === "url")],
  ];

  return (
    <div
      className="pos-plugins"
      data-testid="plugins-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <span className="pos-toolbar__muted">
          {entries.filter((p) => p.status === "active").length} of{" "}
          {entries.length} active
        </span>
        <span className="pos-toolbar__status" />
        <button
          type="button"
          className="pos-button pos-button--small"
          data-testid="plugins-add-url"
          onClick={() => void addUrl()}
        >
          Load from URL...
        </button>
      </div>
      <div className="pos-plugins__list">
        {groups.map(([label, list]) => (
          <section key={label} className="pos-plugins__group">
            <h3 className="pos-plugins__heading">{label}</h3>
            {list.length === 0 && (
              <div className="pos-plugins__empty">
                {label.startsWith("From this")
                  ? "Add a plugins/hello.js file to the project; it shows up here."
                  : "None yet."}
              </div>
            )}
            {list.map((p) => (
              <div
                key={p.id}
                className="pos-plugins__row"
                data-testid="plugin-row"
                data-plugin={p.id}
                data-status={p.status}
              >
                <label className="pos-plugins__toggle">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    disabled={busy === p.id}
                    data-testid={`plugin-toggle-${p.source.type === "builtin" ? p.source.id : p.id}`}
                    onChange={() => void toggle(p)}
                  />
                  <span className="pos-plugins__name">{p.name}</span>
                  <span
                    className={`pos-plugins__status pos-plugins__status--${p.status}`}
                  >
                    {p.status}
                  </span>
                </label>
                {p.description && (
                  <div className="pos-plugins__desc">{p.description}</div>
                )}
                <div className="pos-plugins__meta">
                  <span title={describeSource(p.source)}>
                    {describeSource(p.source)}
                  </span>
                  {p.kinds.length > 0 && (
                    <span>kinds: {p.kinds.join(", ")}</span>
                  )}
                  {p.commands.length > 0 && (
                    <span>commands: {p.commands.length}</span>
                  )}
                  {p.status === "active" && p.kinds.length > 0 && (
                    <button
                      type="button"
                      className="pos-button pos-button--small"
                      onClick={() =>
                        void import("../create-window").then(
                          ({ createWindow }) =>
                            createWindow(editor, { kind: p.kinds[0] })
                        )
                      }
                    >
                      Open {p.kinds[0]}
                    </button>
                  )}
                  {p.source.type !== "builtin" && p.enabled && (
                    <button
                      type="button"
                      className="pos-button pos-button--small"
                      onClick={() => void manager?.reload(p.id)}
                    >
                      Reload
                    </button>
                  )}
                  {p.source.type === "url" && (
                    <button
                      type="button"
                      className="pos-button pos-button--small"
                      onClick={() => manager?.remove(p.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {p.error && (
                  <div className="pos-plugins__error" role="alert">
                    {p.error}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="pos-plugins__note">
        <strong>Permissions:</strong> plugins are ES modules that run inside
        this page with the same access as the app itself (your canvas, your
        project files in this browser, the network). There is no sandbox. Only
        enable plugins you trust. Enabled plugins are remembered in this
        browser.
      </div>
    </div>
  );
}

const EMPTY = {
  get: () => [] as PluginEntry[],
  set() {},
  update() {},
  subscribe: () => () => {},
};
