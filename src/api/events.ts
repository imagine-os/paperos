import { EVENT_NAMES, type EventName } from "./schema";

/** One delivered event. `payload` is plain JSON. */
export interface CanvasEvent {
  seq: number;
  name: EventName;
  time: number;
  payload: Record<string, unknown>;
}

export type EventListener = (event: CanvasEvent) => void;

export interface EventBus {
  emit(name: EventName, payload: Record<string, unknown>): void;
  /** Subscribe to one event, or to everything with "*". */
  on(name: EventName | "*", listener: EventListener): () => void;
  /** Events after `since` (a seq), oldest first, plus the newest seq as cursor. */
  poll(since?: number): { events: CanvasEvent[]; cursor: number };
  names(): EventName[];
}

export const EVENT_BUFFER = 200;

export function isEventName(name: string): name is EventName {
  return (EVENT_NAMES as readonly string[]).includes(name);
}

/** A tiny event bus with a ring buffer so pollers (the MCP bridge) miss nothing recent. */
export function createEventBus(now: () => number = Date.now): EventBus {
  const listeners = new Map<string, Set<EventListener>>();
  const buffer: CanvasEvent[] = [];
  let seq = 0;

  return {
    emit(name, payload) {
      const event: CanvasEvent = { seq: ++seq, name, time: now(), payload };
      buffer.push(event);
      if (buffer.length > EVENT_BUFFER)
        buffer.splice(0, buffer.length - EVENT_BUFFER);
      for (const key of [name, "*"]) {
        listeners.get(key)?.forEach((l) => {
          try {
            l(event);
          } catch (e) {
            console.error(`[paperos] event listener for ${name} failed`, e);
          }
        });
      }
    },
    on(name, listener) {
      if (name !== "*" && !isEventName(name)) {
        throw new Error(
          `Unknown event "${name}". Known: ${EVENT_NAMES.join(", ")}`
        );
      }
      let set = listeners.get(name);
      if (!set) listeners.set(name, (set = new Set()));
      set.add(listener);
      return () => void set!.delete(listener);
    },
    poll(since = 0) {
      return {
        events: buffer.filter((e) => e.seq > since),
        cursor: seq,
      };
    },
    names: () => [...EVENT_NAMES],
  };
}
