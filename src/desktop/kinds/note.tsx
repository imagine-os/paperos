"use client";

import { stopEventPropagation } from "tldraw";
import type { WindowKindProps } from "../window-kinds";

/** A plain editable text note. Content lives in the shape props. */
export function NoteWindow({ shape, update }: WindowKindProps) {
  return (
    <textarea
      className="pos-note"
      value={shape.props.content}
      placeholder="Type here..."
      spellCheck={false}
      onChange={(e) => update({ content: e.target.value })}
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
      aria-label={`${shape.props.title} content`}
    />
  );
}
