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
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import type { WalletError } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";

// Stable reference — prevents ConnectionProvider from re-creating the
// Connection object on every render, which would cascade re-renders
// through every component that calls useConnection().
const CONNECTION_CONFIG = { commitment: "confirmed" as const };

// All RPC traffic from the dashboard flows through our same-origin proxy
// at /api/rpc, which forwards to Helius server-side. Hardcoded absolute
// URL so Solana's web3.js Connection (which does `new URL(endpoint)`
// internally) can always parse it without needing window.location.
// MAGPIE_RPC_PROXY_v1 — bump suffix to force a Vercel rebuild.
const RPC_ENDPOINT = "https://www.magpie.capital/api/rpc";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    [],
  );

  const onError = useCallback((error: WalletError) => {
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider
      endpoint={RPC_ENDPOINT}
      config={CONNECTION_CONFIG}
    >
      <SolanaWalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
