import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Solana web3.js needs Buffer in the browser
      buffer: "buffer",
    },
  },
};

export default nextConfig;
