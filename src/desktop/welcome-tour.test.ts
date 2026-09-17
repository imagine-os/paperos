import { describe, expect, it } from "vitest";
import { tourSteps } from "@/boards/model";
import { describeStep, startTour } from "@/boards/tour";
import { welcomeTour } from "./welcome-tour";

describe("welcome tour", () => {
  it("has eight steps: chrome targets, a board, the lineage and the SaaS sample at the end", () => {
    const tour = welcomeTour();
    const steps = tourSteps(tour);
    expect(steps).toHaveLength(8);
    expect(steps.slice(0, 5).every((s) => s.target)).toBe(true);
    expect(steps[1].target).toContain("open-menu");
    expect(steps[2].target).toContain("layout-menu");
    expect(steps[3].target).toContain("new-window-menu");
    expect(steps[4].target).toContain("share-button");
    expect(steps[5]).toMatchObject({
      board: "build-product",
      run: "board.open.build-product",
    });
    expect(steps[6]).toMatchObject({
      board: "data-lineage",
      run: "lineage.open",
    });
    expect(steps[7].action).toEqual({
      label: "Open the Small Business SaaS sample",
      command: "project.open-saas",
    });
    for (const s of steps) expect(s.caption.length).toBeGreaterThan(40);
    const state = startTour(tour)!;
    expect(state.total).toBe(8);
    expect(describeStep(tour, state).stepTitle).toBe("Everything is a window");
  });
});
