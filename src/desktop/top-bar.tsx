"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { useValue, type Editor } from "tldraw";
import { getBridgeClient } from "@/api/bridge-client";
import { togglePalette } from "@/ide/palette-state";
import { resolvedTheme, toggleTheme } from "@/ide/theme";
import { useSignal } from "@/ide/use-signal";
import { PRESETS } from "@/wm/presets";
import type { LayoutPreset } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { createWindow } from "./create-window";
import { applyPresetWorkspace, PRESET_WORKSPACES } from "./preset-workspaces";
import { Dropdown, MenuHeading, MenuItem, MenuSeparator } from "./menu";
import {
  canOpenFolder,
  importGithubProject,
  importZipProject,
  openFolderProject,
  openSampleProject,
} from "./project-actions";
import { listWindowKinds, windowKindsChanged } from "./window-kinds";
import { getWorkspaceStore } from "./workspaces";

const PRESET_SHORTCUTS: Partial<Record<LayoutPreset, string>> = {
  free: "Alt+1",
  columns: "Alt+2",
  grid: "Alt+3",
  "bento-1-2": "Alt+4",
  "split-tree": "Alt+5",
};

export function TopBar({ editor }: { editor: Editor | null }) {
  const theme = useSignal(resolvedTheme);
  return (
    <header className="pos-topbar" data-testid="topbar">
      <div className="pos-topbar__brand">
        <span className="pos-topbar__name">PaperOS</span>
        <span className="pos-topbar__badge">v2 preview</span>
      </div>
      <div className="pos-topbar__actions">
        <OpenMenu />
        {editor ? (
          <>
            <LayoutMenu editor={editor} />
            <WorkspacesMenu editor={editor} />
            <NewWindowMenu editor={editor} />
          </>
        ) : (
          <>
            <Dropdown label="Layout" disabled>
              {null}
            </Dropdown>
            <Dropdown label="Workspaces" disabled>
              {null}
            </Dropdown>
            <Dropdown label="New window" disabled>
              {null}
            </Dropdown>
          </>
        )}
        <button
          type="button"
          className="pos-button pos-topbar__palette"
          disabled={!editor}
          title="Command palette (Ctrl+K)"
          data-testid="palette-button"
          onClick={() => togglePalette()}
        >
          Commands <span className="pos-menu__kbd">Ctrl+K</span>
        </button>
        <BridgeToggle editor={editor} />
        <button
          type="button"
          className="pos-button pos-topbar__icon-button"
          title={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          aria-label="Toggle theme"
          data-testid="theme-toggle"
          onClick={() => toggleTheme()}
        >
          {theme === "dark" ? "\u2600" : "\u263D"}
        </button>
        <button
          type="button"
          className="pos-button pos-topbar__about"
          disabled={!editor}
          onClick={() => editor && createWindow(editor, { kind: "about" })}
        >
          About
        </button>
        <Link className="pos-topbar__link" href="/legacy">
          Legacy prototype
        </Link>
      </div>
    </header>
  );
}

const BRIDGE_LABEL = {
  off: "Agent bridge: off",
  waiting: "Agent bridge: listening",
  connected: "Agent bridge: connected",
} as const;

/** Turns the connection to the local MCP bridge on and off; the dot shows its state. */
function BridgeToggle({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0);
  const client = getBridgeClient();
  useEffect(() => {
    if (client || !editor) return;
    const t = setInterval(() => getBridgeClient() && force((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [client, editor]);
  const status = useSignal(client?.status ?? OFF_STATUS);
  return (
    <button
      type="button"
      className="pos-button pos-topbar__bridge"
      disabled={!client}
      data-testid="bridge-toggle"
      data-status={status}
      title={
        status === "off"
          ? "Connect this tab to the local MCP bridge (npm run mcp) so agents can drive the canvas"
          : status === "waiting"
            ? `Waiting for the bridge at ${client?.url}. Start it with npm run mcp. Click to turn off.`
            : "An MCP bridge is connected. Click to disconnect."
      }
      onClick={() => client?.toggle()}
    >
      <span
        className={`pos-bridge-dot pos-bridge-dot--${status}`}
        aria-hidden="true"
      />
      {BRIDGE_LABEL[status]}
    </button>
  );
}

const OFF_STATUS = {
  get: () => "off" as const,
  set() {},
  update() {},
  subscribe: () => () => {},
};

function OpenMenu() {
  return (
    <Dropdown label="Open" testId="open-menu">
      <MenuItem
        label="Open folder..."
        disabled={!canOpenFolder()}
        testId="open-folder"
        onSelect={() => void openFolderProject()}
      />
      <MenuItem
        label="Open sample project"
        testId="open-sample"
        onSelect={() => void openSampleProject()}
      />
      <MenuItem
        label="Import ZIP..."
        testId="open-zip"
        onSelect={() => void importZipProject()}
      />
      <MenuItem
        label="Import GitHub repo URL..."
        testId="open-github"
        onSelect={() => void importGithubProject()}
      />
    </Dropdown>
  );
}

function NewWindowMenu({ editor }: { editor: Editor }) {
  useSignal(windowKindsChanged);
  return (
    <Dropdown label="New window" testId="new-window-menu">
      {listWindowKinds()
        .filter((k) => !k.hidden)
        .map((k) => (
          <MenuItem
            key={k.id}
            label={`${k.icon ?? ""} ${k.label}`.trim()}
            testId={`new-window-${k.id}`}
            shortcut={k.id === "note" ? "Alt+N" : undefined}
            onSelect={() => createWindow(editor, { kind: k.id })}
          />
        ))}
    </Dropdown>
  );
}

function LayoutMenu({ editor }: { editor: Editor }) {
  const wm = getWindowManager(editor);
  const preset = useValue(wm.preset);
  const hasLayout = useValue("has layout", () => wm.root.get() !== null, [wm]);

  return (
    <Dropdown label="Layout" testId="layout-menu">
      {PRESETS.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && PRESETS[i - 1].group !== p.group && <MenuSeparator />}
          <MenuItem
            label={p.label}
            checked={preset === p.id}
            shortcut={PRESET_SHORTCUTS[p.id]}
            testId={`layout-${p.id}`}
            onSelect={() => wm.applyPreset(p.id)}
          />
        </Fragment>
      ))}
      <MenuSeparator />
      <MenuItem
        label="Tile all"
        testId="layout-tile-all"
        onSelect={() => wm.tileAll()}
      />
      <MenuItem
        label="Untile all"
        disabled={!hasLayout}
        onSelect={() => wm.untileAll()}
      />
      <MenuItem
        label="Show layout"
        disabled={!hasLayout}
        onSelect={() => wm.showRegion()}
      />
      <MenuItem
        label="Focus mode"
        shortcut="Alt+F"
        onSelect={() => wm.focusMode()}
      />
    </Dropdown>
  );
}

function WorkspacesMenu({ editor }: { editor: Editor }) {
  const wm = getWindowManager(editor);
  const store = getWorkspaceStore();
  const workspaces = useSyncExternalStore(
    store.subscribe,
    () => store.list(),
    () => store.list()
  );
  const activeId = useValue(wm.activeWorkspaceId);
  const active = workspaces.find((w) => w.id === activeId);

  const switchTo = (id: string) => {
    // Never saved yet: build the preset arrangement (creates the windows).
    if (applyPresetWorkspace(editor, id)) return;
    const ws = store.get(id);
    if (!ws) return;
    store.setActive(id);
    wm.applyWorkspace(ws);
  };

  const saveAs = () => {
    const name = window.prompt("Workspace name", "Workspace");
    if (name === null) return;
    const ws = store.create(name, wm.snapshot());
    wm.activeWorkspaceId.set(ws.id);
  };

  const update = () => {
    if (!active) return;
    store.save(active.id, wm.snapshot());
  };

  const rename = () => {
    if (!active) return;
    const name = window.prompt("Rename workspace", active.name);
    if (name) store.rename(active.id, name);
  };

  const duplicate = () => {
    if (!active) return;
    const copy = store.duplicate(active.id);
    if (copy) {
      store.setActive(copy.id);
      wm.activeWorkspaceId.set(copy.id);
    }
  };

  const remove = () => {
    if (!active) return;
    if (!window.confirm(`Delete workspace "${active.name}"?`)) return;
    store.remove(active.id);
    wm.activeWorkspaceId.set(null);
  };

  return (
    <Dropdown
      label={active ? `Workspaces: ${active.name}` : "Workspaces"}
      testId="workspaces-menu"
    >
      <MenuHeading>Switch to</MenuHeading>
      {workspaces.map((w) => (
        <MenuItem
          key={w.id}
          label={w.name}
          checked={w.id === activeId}
          testId={`workspace-${w.id}`}
          onSelect={() => switchTo(w.id)}
        />
      ))}
      {Object.entries(PRESET_WORKSPACES)
        .filter(([id]) => !store.get(id))
        .map(([id, p]) => (
          <MenuItem
            key={id}
            label={p.name}
            testId={`workspace-${id}`}
            onSelect={() => switchTo(id)}
          />
        ))}
      <MenuSeparator />
      <MenuItem
        label="Save current as..."
        testId="workspace-save-as"
        onSelect={saveAs}
      />
      <MenuItem
        label={active ? `Update "${active.name}"` : "Update"}
        disabled={!active}
        onSelect={update}
      />
      <MenuItem label="Rename..." disabled={!active} onSelect={rename} />
      <MenuItem label="Duplicate" disabled={!active} onSelect={duplicate} />
      <MenuItem label="Delete" disabled={!active} danger onSelect={remove} />
    </Dropdown>
  );
}
