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
  // Site-wide security & reviewer-friendly headers.
  //
  // Aims:
  //   1. Standard security hardening expected of a production DeFi app
  //      (X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
  //      Vercel adds HSTS automatically; we set the rest explicitly so
  //      SSL Labs / Mozilla Observatory grade reflects intentional
  //      posture rather than defaults.
  //   2. A `Link rel="security-policy"` header per RFC 9116 §3 so
  //      automated security crawlers discover /.well-known/security.txt
  //      from any URL on the site.
  //   3. X-Magpie-Security / X-Magpie-Source headers on every response
  //      pointing at the public security page + source repos. A
  //      Blowfish-style automated scanner curling magpie.capital sees
  //      these signals before it even parses HTML.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Link", value: '</.well-known/security.txt>; rel="security-policy"' },
          { key: "X-Magpie-Security", value: "https://magpie.capital/security" },
          { key: "X-Magpie-Source", value: "https://github.com/magpiecapital" },
        ],
      },
      {
        // RFC 9116: security.txt MUST be plain text
        source: "/.well-known/security.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
