import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Solana web3.js needs Buffer in the browser
      buffer: "buffer",
    },
  },
  async redirects() {
    return [
      // /transparency is the canonical (and more shareable) URL for the
      // protocol transparency dashboard. /stats stays as alias for SEO.
      { source: "/transparency", destination: "/stats", permanent: false },
    ];
  },
};

export default nextConfig;
