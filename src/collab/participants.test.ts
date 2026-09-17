import { describe, expect, it } from "vitest";
import {
  initials,
  lightColor,
  newUserName,
  participantsFromStates,
  participantsOnWindow,
  PARTICIPANT_COLORS,
  pickColor,
  type AwarenessState,
} from "./participants";
import { newIdentity, readIdentity, writeIdentity } from "./identity";

const user = (id: string, name: string) => ({
  id,
  name,
  color: pickColor(id),
});

describe("participants from awareness", () => {
  it("lists every tab with a user, local first, agents as extra rows", () => {
    const states = new Map<number, AwarenessState>([
      [
        3,
        { user: user("u3", "Zed"), focus: { window: "shape:a", file: null } },
      ],
      [1, { user: user("u1", "Amy"), agent: true }],
      [2, { presence: {} }], // no user yet
      [
        7,
        {
          user: user("u7", "Bob"),
          focus: { window: "shape:b", file: "prj:index.html" },
        },
      ],
    ]);
    const list = participantsFromStates(states, 7);
    expect(list.map((p) => [p.name, p.local, p.agent])).toEqual([
      ["Bob", true, false],
      ["Amy", false, false],
      ["Zed", false, false],
      ["Amy's agent", false, true],
    ]);
    expect(list[0]).toMatchObject({
      clientId: 7,
      id: "u7",
      window: "shape:b",
      file: "prj:index.html",
    });
    expect(list[3]).toMatchObject({ clientId: 1, id: "u1:agent" });
    expect(list[1].window).toBeNull();
  });

  it("finds who is on a window: focused on it or on its file", () => {
    const states = new Map<number, AwarenessState>([
      [
        1,
        {
          user: user("u1", "Amy"),
          focus: { window: "shape:x", file: "p:a.js" },
        },
      ],
      [
        2,
        {
          user: user("u2", "Bob"),
          focus: { window: "shape:y", file: "p:a.js" },
        },
      ],
      [
        3,
        { user: user("u3", "Cid"), focus: { window: "shape:z", file: null } },
      ],
      [
        4,
        {
          user: user("u4", "Me"),
          focus: { window: "shape:x", file: "p:a.js" },
        },
      ],
    ]);
    const list = participantsFromStates(states, 4);
    expect(
      participantsOnWindow(list, { id: "shape:x", file: "p:a.js" }).map(
        (p) => p.name
      )
    ).toEqual(["Amy", "Bob"]);
    expect(
      participantsOnWindow(list, { id: "shape:z", file: null }).map(
        (p) => p.name
      )
    ).toEqual(["Cid"]);
    expect(participantsOnWindow(list, { id: "shape:q", file: null })).toEqual(
      []
    );
  });

  it("colors, initials and names", () => {
    expect(PARTICIPANT_COLORS).toContain(pickColor("u1"));
    expect(pickColor("u1")).toBe(pickColor("u1"));
    expect(lightColor("#e0503a")).toBe("#e0503a40");
    expect(lightColor("red")).toBe("red");
    expect(initials("Quiet Otter")).toBe("QO");
    expect(initials("alice")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(newUserName(() => 0)).toBe("Quiet Otter");
  });
});

describe("identity", () => {
  it("creates once and reads back from storage", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const first = readIdentity(store);
    expect(first.id).toMatch(/^u_/);
    expect(first.name).toMatch(/^\w+ \w+$/);
    expect(readIdentity(store)).toEqual(first);
    writeIdentity({ ...first, name: "Ada" }, store);
    expect(readIdentity(store).name).toBe("Ada");
    // Garbage in storage is replaced.
    data.set("paperos-v2:collab-identity", "{nope");
    expect(readIdentity(store).id).not.toBe(first.id);
    expect(newIdentity(() => 0.5).color).toMatch(/^#/);
  });
});
