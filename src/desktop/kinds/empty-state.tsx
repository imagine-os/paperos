"use client";

import type { ReactNode } from "react";

export interface EmptyAction {
  label: string;
  onClick: () => unknown;
  primary?: boolean;
  testId?: string;
}

/**
 * A friendly empty or error state for a window body: a glyph, a title, a
 * sentence and one-click fixes. Used by the kinds when the project lacks
 * what they need (no tables, no pages, no HTML entry, no project).
 */
export function EmptyState({
  icon,
  title,
  children,
  actions = [],
  tone = "empty",
  testId,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  actions?: EmptyAction[];
  tone?: "empty" | "error";
  testId?: string;
}) {
  return (
    <div
      className="pos-empty"
      data-tone={tone}
      data-testid={testId}
      role={tone === "error" ? "alert" : undefined}
    >
      {icon && (
        <span className="pos-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <strong className="pos-empty__title">{title}</strong>
      {children && <div className="pos-empty__text">{children}</div>}
      {actions.length > 0 && (
        <div className="pos-empty__actions">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`pos-button pos-button--small${a.primary ? " pos-button--primary" : ""}`}
              data-testid={a.testId}
              onClick={() => void a.onClick()}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
