import { describe, expect, it } from "vitest";
import { fetchGithubRepo, parseGithubUrl, zipballUrl } from "./github";
import { isTextPath, readZip, stripCommonRoot } from "./zip";

describe("parseGithubUrl", () => {
  it("accepts the common spellings", () => {
    expect(parseGithubUrl("owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(parseGithubUrl("https://github.com/owner/repo")).toMatchObject({
      owner: "owner",
      repo: "repo",
    });
    expect(parseGithubUrl("github.com/owner/repo.git/")).toMatchObject({
      repo: "repo",
    });
    expect(parseGithubUrl("https://github.com/o/r/tree/dev?x=1")).toEqual({
      owner: "o",
      repo: "r",
      ref: "dev",
    });
    expect(parseGithubUrl("https://gitlab.com/o/r")).toBeNull();
    expect(parseGithubUrl("")).toBeNull();
  });

  it("builds zipball urls", () => {
    expect(zipballUrl({ owner: "o", repo: "r" })).toBe(
      "https://api.github.com/repos/o/r/zipball"
    );
    expect(zipballUrl({ owner: "o", repo: "r", ref: "v1" })).toMatch(
      /zipball\/v1$/
    );
  });

  it("explains failures", async () => {
    const notFound = (async () =>
      new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(
      fetchGithubRepo({ owner: "o", repo: "r" }, notFound)
    ).rejects.toThrow(/not found/);
    const blocked = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(
      fetchGithubRepo({ owner: "o", repo: "r" }, blocked)
    ).rejects.toThrow(/Import ZIP/);
  });
});

describe("zip helpers", () => {
  it("classifies text files", () => {
    expect(isTextPath("a/b.ts")).toBe(true);
    expect(isTextPath("LICENSE")).toBe(true);
    expect(isTextPath("img/logo.png")).toBe(false);
  });

  it("strips a common root folder", () => {
    expect(
      stripCommonRoot({ "repo-main/a.js": "1", "repo-main/b/c.js": "2" })
    ).toEqual({
      "a.js": "1",
      "b/c.js": "2",
    });
    expect(stripCommonRoot({ "a.js": "1", "b/c.js": "2" })).toEqual({
      "a.js": "1",
      "b/c.js": "2",
    });
  });

  it("reads text entries from a zip and skips binaries", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("site-1/index.html", "<p>hi</p>");
    zip.file("site-1/img.png", new Uint8Array([1, 2, 3]));
    zip.file("site-1/node_modules/x/index.js", "nope");
    const data = await zip.generateAsync({ type: "arraybuffer" });
    const out = await readZip(data);
    expect(out.files).toEqual({ "index.html": "<p>hi</p>" });
    expect(out.skipped).toBe(1);
  });
});
