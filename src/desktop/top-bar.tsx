"use client";

import Link from "next/link";
import { Fragment, useSyncExternalStore } from "react";
import { useValue, type Editor } from "tldraw";
import { PRESETS } from "@/wm/presets";
import type { LayoutPreset } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { createWindow } from "./create-window";
import { Dropdown, MenuHeading, MenuItem, MenuSeparator } from "./menu";
import { getWorkspaceStore } from "./workspaces";

const PRESET_SHORTCUTS: Partial<Record<LayoutPreset, string>> = {
  free: "Alt+1",
  columns: "Alt+2",
  grid: "Alt+3",
  "bento-1-2": "Alt+4",
  "split-tree": "Alt+5",
};

export function TopBar({ editor }: { editor: Editor | null }) {
  return (
    <header className="pos-topbar" data-testid="topbar">
      <div className="pos-topbar__brand">
        <span className="pos-topbar__name">PaperOS</span>
        <span className="pos-topbar__badge">v2 preview</span>
      </div>
      <div className="pos-topbar__actions">
        {editor ? (
          <>
            <LayoutMenu editor={editor} />
            <WorkspacesMenu editor={editor} />
          </>
        ) : (
          <>
            <Dropdown label="Layout" disabled>
              {null}
            </Dropdown>
            <Dropdown label="Workspaces" disabled>
              {null}
            </Dropdown>
          </>
        )}
        <button
          type="button"
          className="pos-button pos-button--primary"
          disabled={!editor}
          onClick={() => editor && createWindow(editor, { kind: "note" })}
        >
          New window
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
