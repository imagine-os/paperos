"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/** A top-bar dropdown. Closes on outside click, Escape, or when an item is picked. */
export function Dropdown({
  label,
  testId,
  children,
  disabled,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
        type="button"
        className="pos-button pos-dropdown__button"
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
          className="pos-menu"
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
