import { describe, expect, it } from "vitest";
import { erdLayers, layoutErd } from "./erd";
import { parseSchema } from "./schema";

const schema = parseSchema(
  JSON.stringify({
    tables: [
      { name: "roles", columns: ["name"] },
      {
        name: "users",
        columns: [{ name: "role_id", type: "ref", ref: "roles" }],
      },
      {
        name: "menu_items",
        columns: [
          { name: "parent_id", type: "ref", ref: "menu_items" },
          { name: "required_role", type: "ref", ref: "roles" },
        ],
      },
      {
        name: "audit",
        columns: [{ name: "user_id", type: "ref", ref: "users" }],
      },
      { name: "a", columns: [{ name: "b_id", type: "ref", ref: "b" }] },
      { name: "b", columns: [{ name: "a_id", type: "ref", ref: "a" }] },
    ],
  })
).schema;

describe("erd layout", () => {
  it("layers tables right of what they refer to and survives cycles", () => {
    const layers = erdLayers(schema);
    expect(layers.get("roles")).toBe(0);
    expect(layers.get("users")).toBe(1);
    expect(layers.get("menu_items")).toBe(1);
    expect(layers.get("audit")).toBe(2);
    // A cycle is broken at the first table visited: the two end up in adjacent layers.
    expect(Math.abs(layers.get("a")! - layers.get("b")!)).toBe(1);
  });

  it("places boxes without overlap and draws one edge per ref column", () => {
    const l = layoutErd(schema);
    expect(l.nodes).toHaveLength(6);
    for (const n of l.nodes)
      for (const m of l.nodes) {
        if (n === m) continue;
        const overlap =
          n.x < m.x + m.w &&
          m.x < n.x + n.w &&
          n.y < m.y + m.h &&
          m.y < n.y + n.h;
        expect(overlap, `${n.name} overlaps ${m.name}`).toBe(false);
        expect(n.x + n.w).toBeLessThanOrEqual(l.width);
        expect(n.y + n.h).toBeLessThanOrEqual(l.height);
      }
    expect(
      l.edges
        .map((e) => `${e.from}.${e.column}->${e.to}${e.self ? " (self)" : ""}`)
        .sort()
    ).toEqual([
      "a.b_id->b",
      "audit.user_id->users",
      "b.a_id->a",
      "menu_items.parent_id->menu_items (self)",
      "menu_items.required_role->roles",
      "users.role_id->roles",
    ]);
    const users = l.nodes.find((n) => n.name === "users")!;
    const roles = l.nodes.find((n) => n.name === "roles")!;
    expect(users.x).toBeGreaterThan(roles.x + roles.w);
    const edge = l.edges.find((e) => e.from === "users")!;
    expect(edge.points[0]).toEqual({
      x: users.x,
      y: users.y + users.columns[1].y,
    });
    expect(edge.points.at(-1)!.x).toBe(roles.x + roles.w);
    expect(users.columns[0].key).toBe(true);
  });

  it("handles an empty schema", () => {
    const l = layoutErd({ tables: [] });
    expect(l.nodes).toEqual([]);
    expect(l.width).toBeGreaterThan(0);
  });
});
