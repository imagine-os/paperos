"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { listCommands, searchCommands, type Command } from "@/ide/commands";
import { paletteOpen, togglePalette } from "@/ide/palette-state";
import { useSignal } from "@/ide/use-signal";

/** Ctrl+K palette over the command registry. Rendered above the canvas. */
export function CommandPalette({ editor }: { editor: Editor | null }) {
  const open = useSignal(paletteOpen);

  // Ctrl/Cmd+K anywhere (including inside editors), captured before anyone else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  if (!open || !editor) return null;
  return <PaletteDialog onClose={() => togglePalette(false)} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => listCommands(), []);
  const results = useMemo(
    () => searchCommands(query, all).slice(0, 60),
    [query, all]
  );

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    void cmd.run();
  };

  return (
    <div
      className="pos-palette-backdrop"
      data-testid="command-palette"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pos-palette" role="dialog" aria-label="Command palette">
        <input
          ref={input}
          className="pos-palette__input"
          placeholder="Type a command or file name..."
          aria-label="Search commands"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") run(results[index]);
          }}
        />
        <ul className="pos-palette__list" role="listbox">
          {results.length === 0 && (
            <li className="pos-palette__empty">No matching command.</li>
          )}
          {results.map((cmd, i) => (
            <li key={cmd.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                className="pos-palette__item"
                data-testid="palette-item"
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(cmd)}
              >
                <span className="pos-palette__group">{cmd.group}</span>
                <span className="pos-palette__title">{cmd.title}</span>
                {cmd.shortcut && (
                  <span className="pos-palette__kbd">{cmd.shortcut}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
