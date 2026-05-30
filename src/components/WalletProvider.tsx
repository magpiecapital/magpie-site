"use client";

import { useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { WalletError } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";

// Stable reference — prevents ConnectionProvider from re-creating the
// Connection object on every render, which would cascade re-renders
// through every component that calls useConnection().
const CONNECTION_CONFIG = { commitment: "confirmed" as const };

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Route all RPC through our same-origin proxy at /api/rpc. The proxy
  // forwards to Helius server-side, so the API key never reaches the
  // browser and we don't depend on NEXT_PUBLIC_* env vars being inlined
  // at build time. Resolved inside the component so it picks up
  // window.location.origin on the client after hydration.
  const rpcEndpoint = useMemo(
    () => (typeof window !== "undefined"
      ? `${window.location.origin}/api/rpc`
      : "/api/rpc"),
    [],
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    [],
  );

  const onError = useCallback((error: WalletError) => {
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider
      endpoint={rpcEndpoint}
      config={CONNECTION_CONFIG}
    >
      <SolanaWalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
