"use client";

import { useEffect } from "react";
import { useSignal } from "@/ide/use-signal";
import {
  dismissProblem,
  installProblemListeners,
  problems,
  type Problem,
} from "./problems";

const AUTO_HIDE_MS = 15000;

/**
 * "Something broke" toasts: the latest problems, each with Copy details and
 * Dismiss. Installs the global error listeners while mounted.
 */
export function ProblemToast() {
  const list = useSignal(problems);
  useEffect(() => installProblemListeners(), []);
  useEffect(() => {
    if (!list.length) return;
    const t = setTimeout(
      () => dismissProblem(list[0].id),
      Math.max(1000, AUTO_HIDE_MS - (Date.now() - list[0].at))
    );
    return () => clearTimeout(t);
  }, [list]);
  if (!list.length) return null;
  return (
    <div className="pos-toasts" data-testid="problem-toasts">
      {list.map((p) => (
        <ProblemCard key={p.id} problem={p} />
      ))}
    </div>
  );
}

function ProblemCard({ problem }: { problem: Problem }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(problem.details);
    } catch {
      window.prompt("Copy the details", problem.details);
    }
  };
  return (
    <div
      className="pos-toast"
      role="alert"
      data-testid="problem-toast"
      data-problem-id={problem.id}
    >
      <div className="pos-toast__body">
        <strong>{problem.title}</strong>
        <span className="pos-toast__message" title={problem.message}>
          {problem.message}
        </span>
      </div>
      <div className="pos-toast__actions">
        <button
          type="button"
          className="pos-button pos-button--small"
          data-testid="problem-copy"
          onClick={() => void copy()}
        >
          Copy details
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          aria-label="Dismiss"
          title="Dismiss"
          data-testid="problem-dismiss"
          onClick={() => dismissProblem(problem.id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
