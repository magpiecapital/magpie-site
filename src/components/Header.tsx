"use client";

import Link from "next/link";
import { Wordmark, Mark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWallet } from "@/components/ConnectWallet";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const NAV_LINKS = [
  { label: "Protocol", href: "/vault" },
  { label: "Lending", href: "/marketplace" },
  { label: "Tokens", href: "/tokens" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Docs", href: "/docs" },
];

export function Header() {
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

        {/* Center: desktop nav links */}
        <nav className="hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: wallet + launch */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ConnectWallet variant="ghost" className="hidden md:flex" />
          <a
            href={TELEGRAM_URL}
            className="btn-accent whitespace-nowrap text-sm"
          >
            <span className="hidden sm:inline">Launch</span>
            <span className="sm:hidden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
