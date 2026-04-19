"use client";

import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWallet } from "@/components/ConnectWallet";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const NAV_LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Tokens", href: "/tokens" },
  { label: "Calculator", href: "/calculate" },
  { label: "Credit", href: "/credit" },
  { label: "Vault", href: "/vault" },
  { label: "Marketplace", href: "/marketplace" },
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
          <Link href="/">
            <Wordmark size={28} />
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
          <a href={TELEGRAM_URL} className="btn-accent text-sm">
            Launch
          </a>
        </div>
      </div>
    </header>
  );
}
