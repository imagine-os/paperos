import { describe, expect, it } from "vitest";
import { checkPresetContrast, contrastRatio, parseColor } from "./contrast";
import { THEME_PRESETS } from "./presets";

describe("contrast", () => {
  it("parses colors and computes WCAG ratios", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("rgba(0, 0, 0, 0.5)")).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0.5,
    });
    expect(parseColor("nope")).toBeNull();
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 3);
    expect(contrastRatio("#767676", "#ffffff")!).toBeGreaterThan(4.5);
    // Alpha text is composited over the background first.
    expect(contrastRatio("rgba(0,0,0,0.5)", "#ffffff")!).toBeLessThan(
      contrastRatio("#000000", "#ffffff")!
    );
  });

  it("every theme preset's text and button pairs meet AA in both schemes", () => {
    const report: string[] = [];
    for (const p of THEME_PRESETS) {
      const { failures } = checkPresetContrast(p.tokens());
      for (const f of failures)
        report.push(
          `${p.id} ${f.scheme}: ${f.label} = ${f.ratio} (min ${f.min})`
        );
    }
    expect(report).toEqual([]);
  });
});
