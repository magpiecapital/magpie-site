"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { ConnectWallet } from "@/components/ConnectWallet";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const NAV_SECTIONS = [
  {
    heading: "Core",
    links: [
      { label: "Home", href: "/", icon: "⌂" },
      { label: "Agent Vault Protocol", href: "/vault", icon: "⬡" },
      { label: "Lending", href: "/marketplace", icon: "⇄" },
      { label: "Approved Tokens", href: "/tokens", icon: "◈" },
      { label: "Dashboard", href: "/dashboard", icon: "▦" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { label: "Loan Calculator", href: "/calculate", icon: "⊞" },
      { label: "Credit Score", href: "/credit", icon: "★" },
      { label: "Points & Rewards", href: "/points", icon: "◆" },
      { label: "Protocol Stats", href: "/stats", icon: "◎" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs", icon: "▤" },
      { label: "Whitepaper", href: "/whitepaper", icon: "▧" },
      { label: "About", href: "/about", icon: "○" },
      { label: "Security", href: "/security", icon: "⛨" },
      { label: "Changelog", href: "/changelog", icon: "↻" },
    ],
  },
];

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          zIndex: 9998,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed left-0 top-0 h-full w-[300px] max-w-[85vw] flex flex-col transition-transform duration-300 ease-out"
        style={{
          zIndex: 9999,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          background: "var(--bg-elevated)",
          boxShadow: open ? "4px 0 24px rgba(0,0,0,0.2)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
          <Link href="/" onClick={onClose}><Wordmark size={22} /></Link>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--ink-soft)] transition hover:bg-[var(--surface)]"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Connect wallet */}
        <div className="border-b border-[var(--hairline)] px-4 py-4">
          <ConnectWallet variant="ghost" className="w-full justify-center" />
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                {section.heading}
              </div>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-[var(--ink-soft)] transition active:bg-[var(--surface)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-xs text-[var(--ink-faint)]">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom CTA */}
        <div className="border-t border-[var(--hairline)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            href={TELEGRAM_URL}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-hover)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
            </svg>
            Open Telegram Bot
          </a>
        </div>
      </div>
    </>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  return (
    <>
      {/* Hamburger button — larger touch target on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--ink-soft)] transition hover:bg-[var(--surface)] active:bg-[var(--surface)] md:hidden"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {portalRoot && createPortal(
        <MobileDrawer open={open} onClose={() => setOpen(false)} />,
        portalRoot,
      )}
    </>
  );
}
