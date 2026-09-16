"use client";

import { useEffect, useRef } from "react";
import { stopEventPropagation } from "tldraw";
import type { CanvasApi } from "@/api/canvas-api";
import type { WindowKindProps } from "@/desktop/window-kinds";
import type { PluginWindowKindSpec } from "./types";

/**
 * Hosts a React-free plugin window kind: a div the plugin draws into with
 * `render(el, ctx)` (once per mount) or fills with `html(ctx)` (re-run when
 * the title or content change).
 */
export function createPluginWindowComponent(
  spec: PluginWindowKindSpec,
  api: CanvasApi
) {
  return function PluginWindow({ shape, update }: WindowKindProps) {
    const host = useRef<HTMLDivElement>(null);
    const latest = useRef(shape);
    latest.current = shape;
    const { title, content } = shape.props;

    useEffect(() => {
      const el = host.current;
      if (!el || !spec.render) return;
      const controller = new AbortController();
      const ctx = {
        get window() {
          const s = latest.current;
          return { id: s.id, title: s.props.title, content: s.props.content };
        },
        update,
        api,
        signal: controller.signal,
      };
      let off: void | (() => void);
      try {
        off = spec.render(el, ctx);
      } catch (e) {
        el.textContent = `Plugin error: ${e instanceof Error ? e.message : String(e)}`;
      }
      return () => {
        controller.abort();
        if (typeof off === "function") off();
        el.replaceChildren();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shape.id]);

    useEffect(() => {
      const el = host.current;
      if (!el || !spec.html || spec.render) return;
      const controller = new AbortController();
      try {
        el.innerHTML = spec.html({
          window: { id: shape.id, title, content },
          update,
          api,
          signal: controller.signal,
        });
      } catch (e) {
        el.textContent = `Plugin error: ${e instanceof Error ? e.message : String(e)}`;
      }
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shape.id, title, content]);

    return (
      <div
        ref={host}
        className="pos-plugin-window"
        data-testid="plugin-window"
        data-plugin-kind={spec.id}
        onPointerDown={stopEventPropagation}
        onWheel={stopEventPropagation}
      />
    );
  };
}
