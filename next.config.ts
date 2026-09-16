import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
