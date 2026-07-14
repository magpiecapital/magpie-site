"use client";

import dynamic from "next/dynamic";
import { RefCapture } from "./RefCapture";

// Dynamic import to avoid SSR issues with wallet adapter
// Buffer polyfill is loaded via <Script beforeInteractive> in layout.tsx
const WalletProvider = dynamic(
  () => import("./WalletProvider").then((m) => m.WalletProvider),
  { ssr: false },
);

// Site-wide floating AI chat — available on every page. Loaded
// client-only because it needs the wallet adapter.
const FloatingAiChatGlobal = dynamic(
  () => import("./FloatingAiChatGlobal"),
  { ssr: false },
);

// Re-engagement prompt for returning dormant borrowers (needs the wallet
// adapter, so client-only). Renders nothing for new wallets or active borrowers.
const ReconnectWelcome = dynamic(
  () => import("./ReconnectWelcome").then((m) => m.ReconnectWelcome),
  { ssr: false },
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {/* Persist any ?ref=CODE from the URL so a later wallet connect
          can credit the referrer via the bot's auto-bootstrap path. */}
      <RefCapture />
      {children}
      <FloatingAiChatGlobal />
      <ReconnectWelcome />
    </WalletProvider>
  );
}
