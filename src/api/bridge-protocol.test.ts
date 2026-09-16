import { describe, expect, it } from "vitest";
import {
  type BridgeMessage,
  createPendingCalls,
  decodeMessage,
  encodeMessage,
  newCallId,
  type ResultMessage,
} from "./bridge-protocol";

describe("bridge protocol", () => {
  it("round-trips every message type", () => {
    const messages = [
      {
        type: "hello",
        version: 1,
        client: "paperos-tab",
        apiVersion: 1,
        tools: ["windows.list"],
      },
      { type: "welcome", version: 1, server: "paperos-mcp" },
      {
        type: "call",
        id: "c1",
        tool: "windows.create",
        args: { kind: "note" },
      },
      { type: "result", id: "c1", ok: true, result: { id: "shape:1" } },
      { type: "result", id: "c2", ok: false, error: "boom" },
      {
        type: "event",
        name: "window.created",
        time: 5,
        payload: { id: "shape:1" },
      },
    ] satisfies BridgeMessage[];
    for (const m of messages) {
      expect(decodeMessage(encodeMessage(m))).toEqual(m);
    }
  });

  it("rejects malformed input", () => {
    expect(decodeMessage("not json")).toBeNull();
    expect(decodeMessage("[]")).toBeNull();
    expect(decodeMessage({ type: "call", id: 1, tool: "x" })).toBeNull();
    expect(
      decodeMessage({ type: "call", id: "1", tool: "x", args: [] })
    ).toBeNull();
    expect(decodeMessage({ type: "result", id: "1", ok: false })).toBeNull();
    expect(
      decodeMessage({
        type: "hello",
        version: 1,
        client: "c",
        apiVersion: 1,
        tools: [1],
      })
    ).toBeNull();
    expect(decodeMessage({ type: "party" })).toBeNull();
    // Missing args default to {}.
    expect(
      decodeMessage({ type: "call", id: "1", tool: "windows.list" })
    ).toEqual({
      type: "call",
      id: "1",
      tool: "windows.list",
      args: {},
    });
  });

  it("matches results to pending calls and times out", async () => {
    const timers: { fn: () => void; ms: number }[] = [];
    const calls = createPendingCalls({
      timeoutMs: 50,
      setTimer: (fn, ms) => timers.push({ fn, ms }) - 1,
      clearTimer: () => {},
    });
    const a = calls.start("a", "windows.list");
    const b = calls.start("b", "windows.get");
    const c = calls.start("c", "layout.apply");
    expect(calls.size()).toBe(3);

    expect(
      calls.settle({ type: "result", id: "a", ok: true, result: [1] })
    ).toBe(true);
    await expect(a).resolves.toEqual([1]);
    expect(
      calls.settle({ type: "result", id: "b", ok: false, error: "nope" })
    ).toBe(true);
    await expect(b).rejects.toThrow("nope");
    expect(
      calls.settle({
        type: "result",
        id: "zzz",
        ok: true,
        result: 1,
      } as ResultMessage)
    ).toBe(false);

    timers[2].fn();
    await expect(c).rejects.toThrow(/did not answer within 50 ms/);
    expect(calls.size()).toBe(0);
  });

  it("rejects everything when the tab disconnects", async () => {
    const calls = createPendingCalls({
      setTimer: () => 0,
      clearTimer: () => {},
    });
    const p = calls.start("x", "files.read");
    calls.rejectAll("tab closed");
    await expect(p).rejects.toThrow("tab closed");
    expect(newCallId()).not.toBe(newCallId());
  });
});
