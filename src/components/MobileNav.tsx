"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Approved Tokens", href: "/tokens" },
  { label: "Loan Calculator", href: "/calculate" },
  { label: "Credit Score", href: "/credit" },
  { label: "Points & Rewards", href: "/points" },
  { label: "Documentation", href: "/docs" },
  { label: "About", href: "/about" },
  { label: "Changelog", href: "/changelog" },
  { label: "Security", href: "/security" },
  { label: "Whitepaper", href: "/whitepaper" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--ink-soft)] transition hover:bg-[var(--surface)] md:hidden"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] transition-opacity duration-300 md:hidden"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        className="fixed left-0 top-0 z-[90] h-full w-[280px] transition-transform duration-300 ease-out md:hidden flex flex-col"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          background: "var(--bg-elevated)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
          <Wordmark size={22} />
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] transition hover:bg-[var(--surface)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-xl px-3 py-3 text-[15px] text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Bottom CTA */}
        <div className="border-t border-[var(--hairline)] px-4 py-4">
          <a
            href={TELEGRAM_URL}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-hover)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
            </svg>
            Open Telegram Bot
          </a>
        </div>
      </div>
    </>
  );
}
