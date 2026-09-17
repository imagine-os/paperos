import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProblems,
  describeError,
  dismissProblem,
  isIgnorableError,
  MAX_PROBLEMS,
  problems,
  reportProblem,
} from "./problems";

describe("problems", () => {
  beforeEach(() => clearProblems());

  it("describes errors, strings and objects", () => {
    const e = new TypeError("bad");
    expect(describeError(e).message).toBe("bad");
    expect(describeError(e).details).toContain("TypeError: bad");
    expect(describeError("oops")).toEqual({ message: "oops", details: "oops" });
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
  });

  it("reports, dedupes within five seconds, keeps the last three and dismisses", () => {
    const p1 = reportProblem("Something broke", new Error("x"), "here", 1000)!;
    expect(p1.details).toContain("Something broke: x");
    expect(p1.details).toContain("Where: here");
    expect(reportProblem("Something broke", new Error("x"), "", 3000)).toBe(p1);
    expect(problems.get()).toHaveLength(1);
    reportProblem("Something broke", new Error("x"), "", 9000);
    expect(problems.get()).toHaveLength(2);
    reportProblem("A", "y", "", 9001);
    reportProblem("B", "z", "", 9002);
    expect(problems.get()).toHaveLength(MAX_PROBLEMS);
    expect(problems.get()[0].message).toBe("x");
    dismissProblem(problems.get()[0].id);
    expect(problems.get()).toHaveLength(2);
  });

  it("ignores browser noise", () => {
    expect(isIgnorableError("Script error.")).toBe(true);
    expect(isIgnorableError("ResizeObserver loop completed")).toBe(true);
    expect(isIgnorableError("")).toBe(true);
    expect(isIgnorableError("Cannot read properties of null")).toBe(false);
    expect(reportProblem("t", "Script error.", "", 0)).toBeNull();
  });
});
