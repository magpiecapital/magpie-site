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
      // ── Phantom Mobile webview cache busting (2026-06-13) ─────────
      // Operator reported repeated stale-prompt bug: SPCX borrow shows
      // 0.534 SOL in Phantom Mobile despite multiple deploys with the
      // category-routing fix. Root cause: Phantom Mobile's in-app
      // webview caches HTML separately from the OS browser. When the
      // HTML is cached, it references OLD hashed JS chunks, so the
      // cached pre-fix bundle keeps running.
      //
      // Force `no-store` on the borrow-critical surfaces so the webview
      // re-fetches HTML every visit. Next.js' hashed JS chunks are
      // content-addressed (immutable filenames) — fresh HTML → fresh
      // chunk URLs → fresh code. Also no-store the API surface that
      // borrow.ts reads from so cached responses can't stale the
      // category lookup.
      {
        source: "/dashboard",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          {
            key: "X-Magpie-Build",
            value: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
          },
        ],
      },
      {
        source: "/dashboard/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          {
            key: "X-Magpie-Build",
            value: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
          },
        ],
      },
      {
        // Token list + borrow endpoints — never cache. borrow.ts hits
        // /api/v1/tokens for the authoritative category and any stale
        // cache there reintroduces the SPCX-as-memecoin bug.
        source: "/api/v1/tokens",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/v1/borrow/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
