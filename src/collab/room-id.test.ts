import { describe, expect, it } from "vitest";
import {
  hashText,
  isRoomId,
  newRoomId,
  normalizeRoomId,
  parseRoomLink,
  roomKey,
  roomLink,
  ROOM_ID_RE,
} from "./room-id";

describe("room ids", () => {
  it("generates readable adjective-noun-digits ids", () => {
    for (let i = 0; i < 50; i++) expect(newRoomId()).toMatch(ROOM_ID_RE);
    const seeded = () => {
      let n = 0;
      const seq = [0.1, 0.9, 0.5];
      return () => seq[n++ % seq.length];
    };
    const id = newRoomId(seeded());
    expect(id).toBe(newRoomId(seeded()));
    expect(id).toMatch(/-100$/);
    expect(isRoomId(id)).toBe(true);
    expect(newRoomId(() => 0)).toBe("amber-ant-000");
    expect(newRoomId(() => 0.999999)).toBe("zesty-trout-999");
    expect(isRoomId("Amber Fox")).toBe(false);
    expect(isRoomId(42)).toBe(false);
  });

  it("normalizes pasted ids", () => {
    expect(normalizeRoomId("  Amber-Fox-417 ")).toBe("amber-fox-417");
    expect(normalizeRoomId("my room")).toBe("my-room");
    expect(normalizeRoomId("!!!")).toBeNull();
    expect(normalizeRoomId("x".repeat(65))).toBeNull();
  });

  it("parses links, query strings and bare ids", () => {
    expect(parseRoomLink("amber-fox-417")).toEqual({ id: "amber-fox-417" });
    expect(
      parseRoomLink(
        "https://imagine-os.github.io/paperos/app?room=amber-fox-417"
      )
    ).toEqual({ id: "amber-fox-417" });
    expect(
      parseRoomLink("?room=amber-fox-417&sync=ws://localhost:1234#x")
    ).toEqual({ id: "amber-fox-417", sync: "ws://localhost:1234" });
    // A sync param that is not a websocket URL is dropped.
    expect(parseRoomLink("?room=a-b-1&sync=http://x")).toEqual({ id: "a-b-1" });
    expect(parseRoomLink("?other=1")).toBeNull();
    expect(parseRoomLink("")).toBeNull();
  });

  it("builds links that parse back", () => {
    const link = roomLink("https://host/paperos/", {
      id: "amber-fox-417",
      sync: "wss://sync.example",
    });
    expect(link).toBe(
      "https://host/paperos/app?room=amber-fox-417&sync=wss%3A%2F%2Fsync.example"
    );
    expect(parseRoomLink(link)).toEqual({
      id: "amber-fox-417",
      sync: "wss://sync.example",
    });
    expect(roomLink("http://localhost:3000", { id: "x-y-1" })).toBe(
      "http://localhost:3000/app?room=x-y-1"
    );
  });

  it("derives the transport room name from id and password", () => {
    expect(roomKey("amber-fox-417")).toBe("paperos-amber-fox-417");
    const locked = roomKey("amber-fox-417", "secret");
    expect(locked).toMatch(/^paperos-amber-fox-417-[0-9a-f]{8}$/);
    expect(roomKey("amber-fox-417", "secret")).toBe(locked);
    expect(roomKey("amber-fox-417", "other")).not.toBe(locked);
    expect(hashText("a")).toBe(hashText("a"));
    expect(hashText("a")).not.toBe(hashText("b"));
  });
});
