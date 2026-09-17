import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIGNALING,
  describeTransport,
  parseUrlList,
  selectTransport,
} from "./config";

describe("transport selection", () => {
  it("defaults to peer-to-peer with the public signaling server", () => {
    expect(selectTransport({})).toEqual({
      kind: "webrtc",
      signaling: DEFAULT_SIGNALING,
    });
  });

  it("prefers an explicit choice, then the stored one, then the environment", () => {
    expect(
      selectTransport({
        explicit: { kind: "websocket", url: "ws://a:1" },
        stored: { kind: "webrtc" },
        env: { syncUrl: "ws://env:1" },
      })
    ).toEqual({ kind: "websocket", url: "ws://a:1" });
    // A URL alone means "that sync server".
    expect(selectTransport({ explicit: { url: "wss://b" } })).toEqual({
      kind: "websocket",
      url: "wss://b",
    });
    expect(
      selectTransport({
        stored: { kind: "websocket", syncUrl: "ws://stored:2" },
        env: { syncUrl: "ws://env:1" },
      })
    ).toEqual({ kind: "websocket", url: "ws://stored:2" });
    expect(selectTransport({ env: { syncUrl: "ws://env:1" } })).toEqual({
      kind: "websocket",
      url: "ws://env:1",
    });
    // Explicit websocket without a URL falls back to stored/env URLs.
    expect(
      selectTransport({
        explicit: { kind: "websocket" },
        env: { syncUrl: "ws://env:1" },
      })
    ).toEqual({ kind: "websocket", url: "ws://env:1" });
  });

  it("collects signaling servers for webrtc", () => {
    expect(
      selectTransport({
        explicit: { kind: "webrtc", url: "wss://mine" },
        stored: { signaling: "wss://stored" },
        env: { signaling: "wss://env1, wss://env2" },
      })
    ).toEqual({
      kind: "webrtc",
      signaling: ["wss://mine", "wss://stored", "wss://env1", "wss://env2"],
    });
    expect(parseUrlList("http://no, wss://yes  ws://also")).toEqual([
      "wss://yes",
      "ws://also",
    ]);
  });

  it("refuses a sync server without a URL", () => {
    expect(() => selectTransport({ explicit: { kind: "websocket" } })).toThrow(
      /No sync server URL/
    );
  });

  it("describes transports", () => {
    expect(describeTransport({ kind: "webrtc", signaling: ["wss://s"] })).toBe(
      "WebRTC via wss://s"
    );
    expect(describeTransport({ kind: "websocket", url: "ws://x" })).toBe(
      "Sync server ws://x"
    );
  });
});
