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

  // Pill shape + size matched to the Launch (.btn-accent) CTA next to
  // it. Same border-radius (full), comparable padding, comparable text
  // weight — so the two buttons read as a pair rather than competing.
  const baseStyles =
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-medium transition whitespace-nowrap min-h-[44px]";

  const variantStyles = {
    accent:
      "bg-[var(--accent)] text-[var(--accent-ink,#0a0a0a)] hover:bg-[var(--accent-hover,#e6b830)]",
    ghost:
      "border border-[var(--hairline)] text-[var(--ink)] hover:bg-[var(--surface)] hover:border-[var(--ink-soft)]/30",
    minimal: "text-[var(--ink-soft)] hover:text-[var(--ink)]",
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {/* Wallet icon — smaller for tighter visual weight */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>

      {connecting
        ? "Connecting…"
        : publicKey
          ? <span className="font-mono">{truncated}</span>
          : "Connect"}
    </button>
  );
}
