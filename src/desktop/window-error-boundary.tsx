"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "./kinds/empty-state";
import { describeError, reportProblem } from "./problems";

interface Props {
  /** Shown in the card and the problem report ("Data: users"). */
  title: string;
  kind: string;
  children: ReactNode;
}

interface State {
  error: unknown | null;
  /** Bumps on "Reload window" to remount the body. */
  generation: number;
}

/**
 * Catches a crash inside one window's body so the canvas and the other
 * windows keep working. The body is replaced by a card with the message,
 * "Reload window" (remount) and "Copy details"; the problem also goes to
 * the global toast.
 */
export class WindowErrorBoundary extends Component<Props, State> {
  state: State = { error: null, generation: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportProblem(
      `Window "${this.props.title}" crashed`,
      error,
      `${this.props.kind} window${info.componentStack ? info.componentStack.split("\n").slice(0, 4).join(" ") : ""}`
    );
  }

  reload = () => {
    this.setState((s) => ({ error: null, generation: s.generation + 1 }));
  };

  copy = async () => {
    const { details } = describeError(this.state.error);
    const text = `Window "${this.props.title}" (${this.props.kind}) crashed\n\n${details}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy the details", text);
    }
  };

  render() {
    if (this.state.error !== null) {
      const { message } = describeError(this.state.error);
      return (
        <EmptyState
          icon={"⚠"}
          tone="error"
          title="This window crashed"
          testId="window-crashed"
          actions={[
            {
              label: "Reload window",
              primary: true,
              testId: "window-reload",
              onClick: this.reload,
            },
            { label: "Copy details", onClick: this.copy },
          ]}
        >
          <p>{message}</p>
          <p>
            The rest of the canvas is fine. Reload the window to try again; if
            it keeps crashing, close it and open a new one.
          </p>
        </EmptyState>
      );
    }
    return (
      <div key={this.state.generation} className="pos-window__inner">
        {this.props.children}
      </div>
    );
  }
}
