import { describe, expect, it } from "vitest";
import { zoomBand } from "./zoom-band";

describe("zoomBand", () => {
  it("maps zoom to near / mid / far", () => {
    expect(zoomBand(1)).toBe("near");
    expect(zoomBand(0.5)).toBe("near");
    expect(zoomBand(0.2)).toBe("mid");
    expect(zoomBand(0.05)).toBe("far");
  });

  it("holds the current band a little past the threshold", () => {
    expect(zoomBand(0.11, "far")).toBe("far");
    expect(zoomBand(0.13, "near")).toBe("mid");
    expect(zoomBand(0.32, "mid")).toBe("mid");
    expect(zoomBand(0.4, "mid")).toBe("near");
    expect(zoomBand(0.11, "near")).toBe("mid");
  });
});
