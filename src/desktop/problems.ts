/**
 * Problems the desktop reports to the person: a crashed window, an
 * uncaught error, an unhandled rejection. `reportProblem` is the one entry
 * point (the window error boundary and the global listeners call it); the
 * toast in `problem-toast.tsx` shows the latest one with "Copy details".
 * Pure apart from the listeners, so the dedupe and formatting are tested.
 */
import { signal } from "@/ide/signal";

export interface Problem {
  id: number;
  title: string;
  message: string;
  /** Stack or extra context, for "Copy details". */
  details: string;
  at: number;
}

export const problems = signal<Problem[]>([]);

const DEDUPE_MS = 5000;
export const MAX_PROBLEMS = 3;
let seq = 0;

export function describeError(error: unknown): {
  message: string;
  details: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      details: error.stack ?? `${error.name}: ${error.message}`,
    };
  }
  if (typeof error === "string") return { message: error, details: error };
  try {
    const text = JSON.stringify(error);
    return { message: text, details: text };
  } catch {
    return { message: String(error), details: String(error) };
  }
}

/** Noise browsers and libraries emit that is not a PaperOS problem. */
export function isIgnorableError(message: string): boolean {
  return (
    message === "" ||
    message === "Script error." ||
    message.startsWith("ResizeObserver loop")
  );
}

export function reportProblem(
  title: string,
  error: unknown,
  context?: string,
  now = Date.now()
): Problem | null {
  const { message, details } = describeError(error);
  if (isIgnorableError(message)) return null;
  const list = problems.get();
  const dupe = list.find(
    (p) => p.message === message && now - p.at < DEDUPE_MS
  );
  if (dupe) return dupe;
  const problem: Problem = {
    id: ++seq,
    title,
    message,
    details: [
      `${title}: ${message}`,
      context ? `Where: ${context}` : "",
      typeof navigator !== "undefined" ? `Browser: ${navigator.userAgent}` : "",
      typeof location !== "undefined" ? `Page: ${location.href}` : "",
      "",
      details,
    ]
      .filter((l) => l !== "")
      .join("\n"),
    at: now,
  };
  problems.set([...list, problem].slice(-MAX_PROBLEMS));
  return problem;
}

export function dismissProblem(id: number): void {
  problems.set(problems.get().filter((p) => p.id !== id));
}

export function clearProblems(): void {
  problems.set([]);
}

/** Global listeners: uncaught errors and unhandled rejections become problems. */
export function installProblemListeners(): () => void {
  if (typeof window === "undefined") return () => {};
  const onError = (e: ErrorEvent) => {
    reportProblem("Something broke", e.error ?? e.message, e.filename);
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    reportProblem("Something broke", e.reason, "unhandled promise");
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
