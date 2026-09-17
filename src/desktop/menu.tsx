"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/** A top-bar dropdown. Closes on outside click, Escape, or when an item is picked. */
export function Dropdown({
  label,
  testId,
  children,
  disabled,
  small,
  align = "left",
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
  disabled?: boolean;
  /** Compact button for use inside windows. */
  small?: boolean;
  /** Which edge of the button the menu aligns to. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  const items = () =>
    Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(
        "[role=menuitem]:not(:disabled),[role=menuitemradio]:not(:disabled)"
      ) ?? []
    );

  useEffect(() => {
    if (!open) return;
    // Keyboard: focus lands on the first item; arrows move; Escape closes
    // and returns focus to the button.
    const opened = document.activeElement;
    items()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        if (opened instanceof HTMLElement) opened.focus();
        return;
      }
      if (!ref.current?.contains(e.target as Node)) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "ArrowDown"
            ? list[(i + 1) % list.length]
            : list[(i - 1 + list.length) % list.length];
        next?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const list = items();
        (e.key === "Home" ? list[0] : list[list.length - 1])?.focus();
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="pos-dropdown" ref={ref}>
      <button
        ref={button}
        type="button"
        className={`pos-button pos-dropdown__button${small ? " pos-button--small" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <span aria-hidden="true"> ▾</span>
      </button>
      {open && (
        <div
          id={id}
          className={`pos-menu${align === "right" ? " pos-menu--right" : ""}`}
          role="menu"
          data-testid={testId ? `${testId}-menu` : undefined}
          onClick={(e) => {
            // Items close the menu; separators and headings do not.
            if (
              (e.target as HTMLElement).closest(
                "[role=menuitem],[role=menuitemradio]"
              )
            ) {
              close();
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  label,
  onSelect,
  checked,
  disabled,
  shortcut,
  danger,
  testId,
}: {
  label: string;
  onSelect: () => void;
  checked?: boolean;
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
  testId?: string;
}) {
  const radio = checked !== undefined;
  return (
    <button
      type="button"
      role={radio ? "menuitemradio" : "menuitem"}
      aria-checked={radio ? checked : undefined}
      className={`pos-menu__item${danger ? " pos-menu__item--danger" : ""}`}
      disabled={disabled}
      data-testid={testId}
      onClick={onSelect}
    >
      <span className="pos-menu__label">
        {radio && (
          <span className="pos-menu__check" aria-hidden="true">
            {checked ? "✓" : ""}
          </span>
        )}
        {label}
      </span>
      {shortcut && <span className="pos-menu__kbd">{shortcut}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="pos-menu__separator" role="separator" />;
}

export function MenuHeading({ children }: { children: React.ReactNode }) {
  return <div className="pos-menu__heading">{children}</div>;
}
