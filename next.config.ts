import type { NextConfig } from "next";
import path from "node:path";

/**
 * Static export (GitHub Pages). `PAPEROS_STATIC=1 next build` (npm run
 * build:static) writes a fully static site to `out/`, served under
 * PAPEROS_BASE_PATH (default `/paperos`, i.e. https://imagine-os.github.io/paperos/).
 * The normal `next build` (Vercel, `npm start`) is unchanged.
 */
const isStatic = process.env.PAPEROS_STATIC === "1";
const basePath = isStatic ? (process.env.PAPEROS_BASE_PATH ?? "/paperos") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Exposed to the client so hard-coded URLs (fetches) can use withBasePath().
  // <Link>, the router and static imports get the base path from Next itself.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isStatic
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        images: { unoptimized: true },
        // A static export cannot include route handlers (the legacy
        // /api/liveblocks-auth POST route). Route files are `route.ts`;
        // every page and layout is `.tsx`, so dropping `ts` from the
        // special-file extensions leaves the API out of the static build
        // without moving files. The legacy client then fails to auth and
        // stays disconnected, which is its existing no-key behavior.
        pageExtensions: ["tsx", "jsx", "js"],
      }
    : {}),
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure that all imports of `yjs` resolve to the same instance
      // (needed by the legacy code editor's Yjs binding).
      config.resolve.alias["yjs"] = path.resolve(__dirname, "node_modules/yjs");
    }

    // tldraw ships its icons, fonts and translations in @tldraw/assets.
    // We import them (see src/lib/tldraw-assets.ts) so the app never depends
    // on cdn.tldraw.com. Next handles png/svg imports itself; fonts and the
    // translation JSON files need to be emitted as plain files.
    config.module.rules.push(
      {
        test: /\.woff2?$/,
        type: "asset/resource",
        generator: { filename: "static/media/[name].[hash:8][ext]" },
      },
      {
        test: /[\\/]@tldraw[\\/]assets[\\/]translations[\\/].*\.json$/,
        type: "asset/resource",
        generator: { filename: "static/media/[name].[hash:8][ext]" },
      }
    );
    return config;
  },
};

export default nextConfig;
