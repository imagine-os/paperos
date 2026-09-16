/**
 * Runtime configuration. Everything is optional: PaperOS runs with no keys.
 */

/** tldraw SDK license key. Set NEXT_PUBLIC_TLDRAW_LICENSE_KEY to remove the watermark. */
export const tldrawLicenseKey: string | undefined =
  process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY || undefined;

/**
 * Base path the app is served under ("" normally, "/paperos" on GitHub
 * Pages). Set by next.config.ts. <Link>, the router and static imports
 * already include it; use withBasePath() for hand-written URLs (fetches).
 */
export const basePath: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an absolute in-app path ("/api/x") with the base path. */
export function withBasePath(pathname: string): string {
  return `${basePath}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
