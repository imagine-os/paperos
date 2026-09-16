import { describe, expect, it } from "vitest";
import { cascadePosition, CASCADE_STEP } from "./cascade";

describe("cascadePosition", () => {
  it("returns the wanted point when nothing is there", () => {
    expect(cascadePosition([], { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  it("nudges once when the spot is taken", () => {
    const p = cascadePosition([{ x: 100, y: 100 }], { x: 100, y: 100 });
    expect(p).toEqual({ x: 100 + CASCADE_STEP, y: 100 + CASCADE_STEP });
  });

  it("keeps nudging past a whole cascade", () => {
    const occupied = [0, 1, 2].map((i) => ({
      x: 100 + i * CASCADE_STEP,
      y: 100 + i * CASCADE_STEP,
    }));
    const p = cascadePosition(occupied, { x: 100, y: 100 });
    expect(p).toEqual({
      x: 100 + 3 * CASCADE_STEP,
      y: 100 + 3 * CASCADE_STEP,
    });
  });

  it("ignores points outside the tolerance", () => {
    const p = cascadePosition([{ x: 150, y: 100 }], { x: 100, y: 100 });
    expect(p).toEqual({ x: 100, y: 100 });
  });
});
