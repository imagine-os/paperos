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

/** Signaling servers for peer-to-peer rooms (comma-separated). Default: y-webrtc's public one. */
export const collabSignaling: string | undefined =
  process.env.NEXT_PUBLIC_PAPEROS_SIGNALING || undefined;

/** A self-hosted sync server (`tools/paperos-sync`). When set, rooms use it by default. */
export const collabSyncUrl: string | undefined =
  process.env.NEXT_PUBLIC_PAPEROS_SYNC_URL || undefined;
