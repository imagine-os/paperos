import { describe, expect, it } from "vitest";
import { createEventBus, EVENT_BUFFER } from "./events";

describe("event bus", () => {
  it("delivers to specific and wildcard listeners and buffers", () => {
    const bus = createEventBus(() => 5);
    const got: string[] = [];
    bus.on("*", (e) => got.push(`*${e.name}`));
    bus.on("file.changed", (e) => got.push(`f${e.seq}`));
    bus.emit("window.created", { id: "a" });
    bus.emit("file.changed", { path: "x" });
    expect(got).toEqual(["*window.created", "f2", "*file.changed"]);
    expect(bus.poll().events[1]).toEqual({
      seq: 2,
      name: "file.changed",
      time: 5,
      payload: { path: "x" },
    });
    expect(bus.poll(1).events.map((e) => e.seq)).toEqual([2]);
  });

  it("keeps only the last EVENT_BUFFER events and survives throwing listeners", () => {
    const bus = createEventBus();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => void errors.push(a);
    bus.on("command.run", () => {
      throw new Error("boom");
    });
    for (let i = 0; i < EVENT_BUFFER + 10; i++) bus.emit("command.run", { i });
    console.error = original;
    const { events, cursor } = bus.poll();
    expect(events).toHaveLength(EVENT_BUFFER);
    expect(events[0].seq).toBe(11);
    expect(cursor).toBe(EVENT_BUFFER + 10);
    expect(errors).toHaveLength(EVENT_BUFFER + 10);
  });
});
