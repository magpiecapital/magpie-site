import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Magpie",
  description:
    "Manage your Magpie portfolio — view balances, loans, and collateral in one place.",
  openGraph: {
    title: "Dashboard — Magpie",
    description:
      "Manage your Magpie portfolio — view balances, loans, and collateral in one place.",
  },
};

// 2026-06-13: visible build identifier so operator can verify on-device
// (especially Phantom Mobile webview) that the freshest deploy is loaded.
// Pulled from Vercel's build-time env. Shown both as a meta tag (for
// view-source / DevTools) and a tiny corner chip the operator can read at
// a glance — if the chip doesn't match the latest deploy SHA shown in
// Vercel, the webview is serving cached HTML and needs a hard reset.
const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ||
  "dev";
const BUILD_TS = new Date().toISOString().slice(0, 16).replace("T", " ");

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <meta name="x-magpie-build" content={BUILD_SHA} />
      <meta name="x-magpie-built-at" content={BUILD_TS} />
      {children}
      <div
        aria-label="Build identifier"
        title={`Magpie dashboard build ${BUILD_SHA} (${BUILD_TS} UTC). If this doesn't match the latest deploy, the webview is showing a cached version — Phantom users should disconnect + reconnect the dApp.`}
        style={{
          position: "fixed",
          right: 8,
          bottom: 8,
          fontSize: 10,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          opacity: 0.4,
          padding: "2px 6px",
          borderRadius: 4,
          background: "rgba(0,0,0,0.4)",
          color: "#9ca3af",
          pointerEvents: "auto",
          zIndex: 9999,
          userSelect: "all",
        }}
      >
        build {BUILD_SHA}
      </div>
    </>
  );
}
