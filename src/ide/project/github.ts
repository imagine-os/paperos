import { readZip, type ZipImport } from "./zip";

export interface GithubRepo {
  owner: string;
  repo: string;
  ref?: string;
}

/**
 * Accepts `owner/repo`, `github.com/owner/repo`, full URLs, `.git` suffixes
 * and `/tree/<branch>` paths.
 */
export function parseGithubUrl(input: string): GithubRepo | null {
  const s = input.trim();
  if (!s) return null;
  const short = s.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (short) return { owner: short[1], repo: short[2] };
  const m = s.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/?#]+))?(?:[/?#].*)?$/i
  );
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] };
}

export function zipballUrl({ owner, repo, ref }: GithubRepo): string {
  const base = `https://api.github.com/repos/${owner}/${repo}/zipball`;
  return ref ? `${base}/${encodeURIComponent(ref)}` : base;
}

/**
 * Downloads a public repository as a ZIP, client-side and without a token.
 * The API redirects to codeload.github.com; both send CORS headers, but
 * corporate proxies or rate limits (60 requests/hour per IP) can block it.
 * The caller shows the error and offers the ZIP upload as the fallback.
 */
export async function fetchGithubRepo(
  repo: GithubRepo,
  fetchImpl: typeof fetch = fetch
): Promise<ZipImport> {
  let res: Response;
  try {
    res = await fetchImpl(zipballUrl(repo), {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    throw new Error(
      "Could not reach api.github.com from this browser (blocked by CORS, a proxy, or offline). Download the repository ZIP from GitHub and use Import ZIP instead."
    );
  }
  if (res.status === 404)
    throw new Error(
      `Repository ${repo.owner}/${repo.repo} not found (or private).`
    );
  if (res.status === 403 || res.status === 429)
    throw new Error(
      "GitHub rate limit reached for this IP. Try again later or use Import ZIP."
    );
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return readZip(await res.arrayBuffer());
}
