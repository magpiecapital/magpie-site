"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";

export function ConnectWallet({
  className = "",
  variant = "accent",
}: {
  className?: string;
  variant?: "accent" | "ghost" | "minimal";
}) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = useCallback(() => {
    if (publicKey) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [publicKey, disconnect, setVisible]);

  const truncated = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const baseStyles = "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition";

  const variantStyles = {
    accent:
      "bg-[var(--accent)] text-[var(--accent-ink,#0a0a0a)] hover:bg-[var(--accent-hover,#e6b830)]",
    ghost:
      "border border-[var(--hairline)] text-[var(--ink)] hover:bg-[var(--surface)]",
    minimal: "text-[var(--ink-soft)] hover:text-[var(--ink)]",
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {/* Wallet icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>

      {connecting
        ? "Connecting..."
        : publicKey
          ? truncated
          : "Connect Wallet"}
    </button>
  );
}
