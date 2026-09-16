/**
 * Runtime configuration. Everything is optional: PaperOS runs with no keys.
 */

/** tldraw SDK license key. Set NEXT_PUBLIC_TLDRAW_LICENSE_KEY to remove the watermark. */
export const tldrawLicenseKey: string | undefined =
  process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY || undefined;
