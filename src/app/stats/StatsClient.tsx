"use client";

import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { Header } from "@/components/Header";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ─── Component ─── */

export default function StatsClient() {
  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="text-[var(--ink-faint)]">Coming soon</span>
          </div>
          <h1 className="fade-up fade-up-1 font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Protocol Stats
          </h1>
          <p className="fade-up fade-up-2 mt-4 max-w-lg text-lg text-[var(--ink-soft)] leading-relaxed">
            Real-time protocol metrics will appear here once the lending protocol is live.
          </p>
        </div>
      </section>

      {/* ── Empty state ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Loans Originated", value: "0" },
            { label: "Total SOL Lent", value: "0 SOL" },
            { label: "Total Value Locked", value: "$0" },
            { label: "Active Loans", value: "0" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`card card-hover p-6 fade-up fade-up-${i + 1}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                {s.label}
              </div>
              <div className="mt-3 font-display tabular text-4xl font-medium tracking-[-0.03em] md:text-5xl text-[var(--ink-faint)]">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Placeholder sections ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--accent-dim)] text-4xl">
              📊
            </div>
            <h2 className="mt-8 font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
              No protocol data yet
            </h2>
            <p className="mt-4 max-w-md text-base text-[var(--ink-soft)] leading-relaxed">
              Charts, volume data, collateral rankings, health distributions, and live activity will populate here once the lending protocol launches and real transactions begin.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href={TELEGRAM_URL} className="btn-accent text-base">
                Join the waitlist
                <span aria-hidden>→</span>
              </a>
              <Link
                href="/vault"
                className="btn-ghost text-base"
              >
                Explore the vault protocol
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h2 className="font-display mx-auto max-w-3xl text-4xl font-medium tracking-[-0.03em] text-white md:text-6xl">
            The protocol is <span className="italic text-[var(--accent)]">coming</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/70">
            Borrow SOL against your bags in seconds. No credit check, no KYC.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-base">
              Get notified
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Browse tokens
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              <Wordmark size={24} />
              <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[var(--ink-soft)]">
                Borrow SOL against your memecoin bags, in a Telegram chat.
              </p>
            </div>
            <FooterCol title="Product">
              <FooterLink href="/calculate">Calculator</FooterLink>
              <FooterLink href="/tokens">Tokens</FooterLink>
              <FooterLink href="/credit">Credit</FooterLink>
              <FooterLink href="/stats">Stats</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
            </FooterCol>
            <FooterCol title="Company">
              <FooterLink href="/docs">Docs</FooterLink>
              <FooterLink href="#">Security</FooterLink>
              <FooterLink href="#">Contact</FooterLink>
            </FooterCol>
            <FooterCol title="Social">
              <FooterLink href="https://x.com/MagpieLending">X</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
              <FooterLink href="#">GitHub</FooterLink>
            </FooterCol>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--hairline)] pt-6 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
            </div>
            <div className="text-xs text-[var(--ink-faint)]">
              Not financial advice. Loans carry liquidation risk.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Footer helpers ─── */

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">{title}</div>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
      {children}
    </Link>
  );
}
