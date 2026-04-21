"use client";

// Buffer polyfill MUST be imported before any Solana code
import "@/app/polyfills";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with wallet adapter
const WalletProvider = dynamic(
  () => import("./WalletProvider").then((m) => m.WalletProvider),
  { ssr: false },
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
