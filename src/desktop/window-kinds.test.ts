import { describe, expect, it } from "vitest";
import {
  getWindowKind,
  listWindowKinds,
  registerWindowKind,
} from "./window-kinds";

describe("window kinds registry", () => {
  it("ships note and about", () => {
    expect(getWindowKind("note")?.label).toBe("Note");
    expect(getWindowKind("about")?.defaultTitle).toBe("About PaperOS");
    expect(listWindowKinds().map((k) => k.id)).toEqual(
      expect.arrayContaining(["note", "about"])
    );
  });

  it("returns undefined for unknown kinds", () => {
    expect(getWindowKind("nope")).toBeUndefined();
  });

  it("accepts new kinds", () => {
    registerWindowKind({
      id: "test-kind",
      label: "Test",
      defaultTitle: "Test",
      Component: () => null,
    });
    expect(getWindowKind("test-kind")?.label).toBe("Test");
  });
});
