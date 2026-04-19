"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@solana/wallet-adapter-react";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const TRANCHES = [
  {
    id: "senior",
    name: "Senior",
    emoji: "🛡️",
    color: "#4ade80",
    description: "Protected from first losses. Stable yield.",
    typicalApy: "5-15%",
    riskLevel: "Low",
    minCredit: 500,
    maxLtv: 25,
    features: [
      "First to be repaid in liquidation events",
      "Capital protected by junior tranche buffer",
      "Ideal for conservative lenders",
      "Lower but more predictable returns",
    ],
  },
  {
    id: "mezzanine",
    name: "Mezzanine",
    emoji: "⚖️",
    color: "#f7c948",
    description: "Balanced risk and reward. Middle layer.",
    typicalApy: "10-30%",
    riskLevel: "Medium",
    minCredit: 400,
    maxLtv: 30,
    features: [
      "Moderate exposure to defaults",
      "Higher yields than senior tranche",
      "Partial loss protection from junior layer",
      "Good balance of risk and return",
    ],
  },
  {
    id: "junior",
    name: "Junior",
    emoji: "🔥",
    color: "#ef4444",
    description: "First-loss position. Highest yields.",
    typicalApy: "20-50%",
    riskLevel: "High",
    minCredit: 300,
    maxLtv: 35,
    features: [
      "Absorbs losses before other tranches",
      "Highest potential APY in the protocol",
      "Best for experienced DeFi users",
      "Accepts all credit tiers and collateral",
    ],
  },
];

const HOW_IT_WORKS_LENDER = [
  { step: "01", title: "Choose your tranche", desc: "Pick senior (safe), mezzanine (balanced), or junior (aggressive) based on your risk appetite." },
  { step: "02", title: "Deposit SOL", desc: "Fund your lending pool via Telegram bot. Your capital is immediately available for matching." },
  { step: "03", title: "Automatic matching", desc: "The engine pairs your pool with qualified borrowers. Credit scores and token risk are checked automatically." },
  { step: "04", title: "Earn yield", desc: "Collect origination fees and interest. Withdraw your principal + yield anytime from available balance." },
];

const HOW_IT_WORKS_BORROWER = [
  { step: "01", title: "Build credit", desc: "Your Magpie Credit Score (300-850) determines your rates. Better score = better terms." },
  { step: "02", title: "Request a loan", desc: "The AI risk engine dynamically prices your loan based on your collateral's real-time risk profile." },
  { step: "03", title: "Get matched", desc: "Automatic matching finds the best pool for your profile. Senior pools offer lower rates for high-credit borrowers." },
  { step: "04", title: "Repay & build", desc: "On-time repayment improves your credit score. Better score unlocks higher LTV, lower fees, longer terms." },
];

export function MarketplaceClient() {
  const { connected } = useWallet();
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<"lender" | "borrower">("lender");

  useEffect(() => {
    fetch("/api/v1/marketplace")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.data); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Mark size={26} />
              <Wordmark size={20} className="hidden sm:block" />
            </Link>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]">Dashboard</Link>
              <Link href="/marketplace" className="rounded-lg px-3 py-1.5 font-medium text-[var(--ink)]">Marketplace</Link>
              <Link href="/tokens" className="rounded-lg px-3 py-1.5 text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]">Tokens</Link>
              <Link href="/credit" className="rounded-lg px-3 py-1.5 text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]">Credit</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ConnectWallet variant="accent" />
            <MobileNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-12">
        {/* Hero */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
            P2P Lending Marketplace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--ink-soft)]">
            Earn yield by lending SOL in risk-adjusted tranches. AI-powered credit scoring and token risk assessment protect your capital.
          </p>
        </div>

        {/* Stats bar */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Pools", value: stats?.overview.total_pools ?? "—" },
            { label: "TVL", value: stats ? `${stats.overview.total_tvl_sol} SOL` : "—" },
            { label: "Loans Matched", value: stats?.overview.total_loans_matched ?? "—" },
            { label: "Avg APY", value: stats ? `${stats.overview.avg_apy_pct}%` : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--ink-faint)]">{s.label}</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[var(--ink)]">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tranches */}
        <section className="mt-16">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            Choose Your Risk Tranche
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            Each tranche offers a different risk/reward profile. Senior is safest, junior is highest yield.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TRANCHES.map((t) => (
              <div
                key={t.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 transition hover:border-[var(--accent)] hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{t.emoji}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--ink)]">{t.name}</h3>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: `${t.color}20`, color: t.color }}
                    >
                      {t.riskLevel} Risk
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-[var(--ink-soft)]">{t.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold" style={{ color: t.color }}>
                    {t.typicalApy}
                  </span>
                  <span className="text-sm text-[var(--ink-faint)]">APY</span>
                </div>

                <ul className="mt-4 space-y-2">
                  {t.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                      <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-[var(--ink-faint)]">
                  <div>Min Credit: <span className="font-medium text-[var(--ink)]">{t.minCredit}</span></div>
                  <div>Max LTV: <span className="font-medium text-[var(--ink)]">{t.maxLtv}%</span></div>
                </div>

                <a
                  href={TELEGRAM_URL}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition"
                  style={{ background: `${t.color}18`, color: t.color }}
                >
                  Start Lending
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* How it works tabs */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            How It Works
          </h2>

          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setTab("lender")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${tab === "lender" ? "bg-[var(--accent)] text-[var(--accent-ink,#0a0a0a)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"}`}
            >
              For Lenders
            </button>
            <button
              onClick={() => setTab("borrower")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${tab === "borrower" ? "bg-[var(--accent)] text-[var(--accent-ink,#0a0a0a)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"}`}
            >
              For Borrowers
            </button>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(tab === "lender" ? HOW_IT_WORKS_LENDER : HOW_IT_WORKS_BORROWER).map((step) => (
              <div key={step.step} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] font-display text-sm font-bold text-[var(--accent-deep)]">
                  {step.step}
                </div>
                <h3 className="mt-3 font-semibold text-[var(--ink)]">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Credit integration callout */}
        <section className="mt-20 overflow-hidden rounded-3xl border border-[var(--accent)]/25 bg-[var(--accent-dim)]/30 p-8 sm:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Powered by Magpie Credit Protocol
            </h2>
            <p className="mt-3 text-[var(--ink-soft)]">
              Every loan is underwritten by our 6-factor credit scoring engine (300-850) and real-time AI token risk assessment. Better credit unlocks better terms — for both borrowers and lenders.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/credit"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
              >
                Learn About Credit Scores
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-6 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface)]"
              >
                API Documentation
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Start Earning Today
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--ink-soft)]">
            Open the Telegram bot to create your first lending pool. Choose a tranche, deposit SOL, and start earning yield.
          </p>
          <a
            href={TELEGRAM_URL}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-8 py-3.5 text-base font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
            </svg>
            Open Telegram Bot
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[var(--hairline)] py-8 text-center text-xs text-[var(--ink-faint)]">
        Magpie Capital &middot; Built on Solana
      </footer>
    </div>
  );
}
