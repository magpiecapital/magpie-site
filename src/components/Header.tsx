"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wordmark, Mark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWallet } from "@/components/ConnectWallet";
import ThemeToggle from "@/components/ThemeToggle";

// Creator wallet — must match LENDER_PUBKEY on the bot. The Admin nav
// item only appears when this wallet is connected.
const CREATOR_WALLET = "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx";

const NAV_LINKS = [
  { label: "Earn", href: "/earn" },
  { label: "Borrow", href: "/marketplace" },
  { label: "Tokens", href: "/tokens" },
  { label: "Credit", href: "/credit" },
  { label: "x402", href: "/x402" },
  { label: "Holders", href: "/holders" },
  { label: "Refer", href: "/refer" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Stats", href: "/stats" },
  { label: "Docs", href: "/docs" },
  { label: "Whitepaper", href: "/whitepaper" },
];

// $MAGPIE token nav slot. href is a placeholder until the official link
// is provided — when set, surfaces alongside the main nav in the header
// and as the last item in the mobile drawer.
const MAGPIE_TOKEN_HREF: string | null = "https://pump.fun/coin/9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump";
const MAGPIE_TOKEN_LABEL = "$MAGPIE";

export function Header() {
  const { publicKey, connected } = useWallet();
  const isCreator = connected && publicKey?.toBase58() === CREATOR_WALLET;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNav />
          {/* Full wordmark on sm+, just the mark on tiny screens */}
          <Link href="/" className="hidden sm:flex">
            <Wordmark size={28} />
          </Link>
          <Link href="/" className="flex sm:hidden">
            <Mark size={28} />
          </Link>
        </div>

        {/* Center: desktop nav links. xl: breakpoint so at narrower desktop
            sizes the nav doesn't fight for space with the wordmark + right
            cluster (use the hamburger drawer there). */}
        <nav className="hidden items-center gap-4 xl:flex xl:ml-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
          {MAGPIE_TOKEN_HREF ? (
            <a
              href={MAGPIE_TOKEN_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
            >
              {MAGPIE_TOKEN_LABEL}
            </a>
          ) : (
            <span className="whitespace-nowrap rounded-full border border-[var(--hairline)] px-3 py-1 text-sm font-medium text-[var(--ink-faint)]">
              {MAGPIE_TOKEN_LABEL}
            </span>
          )}
        </nav>

        {/* Right: admin (creator-only) + wallet + launch */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isCreator && (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
              title="Creator dashboard — only visible to you"
            >
              ★ <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <ThemeToggle />
          <ConnectWallet variant="ghost" className="hidden md:flex" />
          <Link
            href="/dashboard"
            className="btn-accent whitespace-nowrap text-sm"
          >
            <span className="hidden sm:inline">Launch</span>
            <span className="sm:hidden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
