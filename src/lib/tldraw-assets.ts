import { getAssetUrlsByImport } from "@tldraw/assets/imports";

/**
 * tldraw icons, fonts and translations, bundled from @tldraw/assets so the
 * app never loads anything from cdn.tldraw.com. The webpack rules that emit
 * the fonts and translation files live in next.config.ts.
 */
export const tldrawAssetUrls = getAssetUrlsByImport();
