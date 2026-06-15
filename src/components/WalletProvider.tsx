"use client";

import { useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import {
  SolanaMobileWalletAdapter,
  createDefaultAuthorizationResultCache,
  createDefaultAddressSelector,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";
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
      // SolanaMobileWalletAdapter — only activates on Android Chrome
      // (and other browsers that support the Mobile Wallet Adapter
      // protocol). When activated, the connect flow deep-links into
      // the user's wallet app (Phantom, Solflare, Backpack) to sign
      // there and return a signed response. Without this adapter,
      // mobile users would only see "wallet not found" on tap.
      //
      // On desktop and iOS Safari this adapter is detected as
      // unsupported and the standard browser-extension adapters below
      // still own the connection flow.
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: "Magpie",
          uri: "https://www.magpie.capital",
          icon: "favicon.ico",
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: "mainnet-beta",
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      // PhantomWalletAdapter intentionally OMITTED — Phantom registers
      // itself as a Solana Standard Wallet automatically, and having BOTH
      // the legacy adapter AND the standard auto-registration causes the
      // wallet-adapter-react instance to attach to one source while the
      // user's active session is on the other. Result: signTransaction
      // throws "The requested method and/or account has not been
      // authorized by the user". Phantom's own warning in console says
      // "The Wallet Adapter for Phantom can be removed from your app."
      // Operator hit this 2026-06-15 PM on a V1 borrow.
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
