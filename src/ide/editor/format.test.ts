import { describe, expect, it } from "vitest";
import { formatSource, formatterFor } from "./format";

describe("formatter", () => {
  it("maps extensions to parsers", () => {
    expect(formatterFor("a.js")).toBe("babel");
    expect(formatterFor("a.tsx")).toBe("typescript");
    expect(formatterFor("a.css")).toBe("css");
    expect(formatterFor("index.html")).toBe("html");
    expect(formatterFor("README.md")).toBe("markdown");
    expect(formatterFor("x.py")).toBeNull();
  });

  it("formats javascript and css", async () => {
    expect(await formatSource("a.js", "const a={b:1}")).toBe(
      "const a = { b: 1 };\n"
    );
    expect(await formatSource("a.css", "a{color:red}")).toBe(
      "a {\n  color: red;\n}\n"
    );
    await expect(formatSource("a.py", "x=1")).rejects.toThrow(/No formatter/);
  });
});
