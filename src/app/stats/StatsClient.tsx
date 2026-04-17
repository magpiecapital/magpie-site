"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ─── Mock Data ─── */

const HEADLINE_STATS = [
  { label: "Total Loans Originated", value: "847", trend: "+12% this week" },
  { label: "Total SOL Lent", value: "12,450 SOL", sub: "~$2.0M", trend: "+8% this week" },
  { label: "Total Value Locked", value: "$3.2M", trend: "+15% this week" },
  { label: "Active Loans", value: "142", trend: "+6% this week" },
];

const DAILY_VOLUME = [
  { day: "Mon", vol: 320 },
  { day: "Tue", vol: 480 },
  { day: "Wed", vol: 410 },
  { day: "Thu", vol: 560 },
  { day: "Fri", vol: 390 },
  { day: "Sat", vol: 620 },
  { day: "Sun", vol: 510 },
];

const TIER_DISTRIBUTION = [
  { name: "Express", pct: 45, color: "var(--accent)" },
  { name: "Quick", pct: 35, color: "var(--accent-deep)" },
  { name: "Standard", pct: 20, color: "var(--ink-faint)" },
];

const TOP_COLLATERAL = [
  { rank: 1, token: "WIF", vol: 2340 },
  { rank: 2, token: "BONK", vol: 1890 },
  { rank: 3, token: "FARTCOIN", vol: 1450 },
  { rank: 4, token: "POPCAT", vol: 1120 },
  { rank: 5, token: "MOO DENG", vol: 980 },
  { rank: 6, token: "GOAT", vol: 870 },
  { rank: 7, token: "PENGU", vol: 750 },
  { rank: 8, token: "PNUT", vol: 620 },
  { rank: 9, token: "SPX", vol: 540 },
  { rank: 10, token: "GIGA", vol: 480 },
];

const HEALTH_DISTRIBUTION = [
  { label: "Healthy (>75%)", pct: 78, color: "var(--accent)" },
  { label: "Watch (50-75%)", pct: 15, color: "var(--warn)" },
  { label: "At Risk (<50%)", pct: 7, color: "var(--bad)" },
];

const PROTOCOL_HEALTH = [
  { label: "Average Health Ratio", value: "82%" },
  { label: "Average LTV", value: "26.3%" },
  { label: "Liquidation Rate", value: "3.2%" },
  { label: "Average Loan Duration", value: "3.8 days" },
];

const ACTIVITY_FEED = [
  { icon: "pledge", text: "12,000 WIF pledged — Express tier — 2.4 SOL", time: "3m ago" },
  { icon: "repay", text: "Loan repaid — 1.8 SOL — BONK collateral returned", time: "7m ago" },
  { icon: "pledge", text: "8,500 FARTCOIN pledged — Quick tier — 1.1 SOL", time: "12m ago" },
  { icon: "alert", text: "Health alert — WIF loan #0xa3f2 at 88%", time: "18m ago" },
  { icon: "extend", text: "Loan extended — POPCAT — 1.5% fee", time: "24m ago" },
  { icon: "pledge", text: "45M BONK pledged — Standard tier — 3.2 SOL", time: "31m ago" },
  { icon: "liquidation", text: "Liquidation — MEW loan #0xb7c1 — health below 1.1x", time: "38m ago" },
  { icon: "repay", text: "Loan repaid — 0.8 SOL — GOAT collateral returned", time: "45m ago" },
];

/* ─── Helpers ─── */

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "pledge":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="var(--accent-deep)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "repay":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 8l3 3 5-6" stroke="var(--accent-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case "alert":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--warn)]/10">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 4v5M8 11v1" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "liquidation":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--bad)]/10">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="var(--bad)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "extend":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5" stroke="var(--ink-soft)" strokeWidth="1.5" />
            <path d="M8 5v3l2 2" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      );
    default:
      return <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface)]" />;
  }
}

/* ─── Component ─── */

export default function StatsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const maxVol = Math.max(...DAILY_VOLUME.map((d) => d.vol));
  const maxCollateral = TOP_COLLATERAL[0].vol;

  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/"><Wordmark size={28} /></Link>
          </div>
          <nav className="flex items-center gap-8">
            <Link href="/calculate" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Calculator
            </Link>
            <Link href="/tokens" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tokens
            </Link>
            <Link href="/credit" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Credit
            </Link>
            <Link href="/docs" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Docs
            </Link>
            <Link href="/dashboard" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span className="text-[var(--ink)]">Live data</span>
          </div>
          <h1 className="fade-up fade-up-1 font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Protocol Stats
          </h1>
          <p className="fade-up fade-up-2 mt-4 max-w-lg text-lg text-[var(--ink-soft)] leading-relaxed">
            Real-time metrics from the Magpie lending protocol.
          </p>
        </div>
      </section>

      {/* ── Headline Stats ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HEADLINE_STATS.map((s, i) => (
            <div
              key={s.label}
              className={`card card-hover p-6 fade-up fade-up-${i + 1}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                {s.label}
              </div>
              <div className="mt-3 font-display tabular text-4xl font-medium tracking-[-0.03em] md:text-5xl">
                {s.value}
              </div>
              {s.sub && (
                <div className="mt-1 text-sm text-[var(--ink-soft)]">{s.sub}</div>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-deep)]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 8V2M2 4.5L5 2l3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {s.trend}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Charts Section ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

            {/* Loan Volume Over Time */}
            <div className="card p-6 md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Loan Volume</div>
                  <div className="mt-1 font-display text-xl font-medium tracking-tight">Last 7 Days</div>
                </div>
                <div className="text-right">
                  <div className="font-display tabular text-2xl font-medium">3,290 SOL</div>
                  <div className="text-xs text-[var(--accent-deep)] font-semibold">+18% vs prior week</div>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
                {DAILY_VOLUME.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg transition-all duration-700 ease-out"
                      style={{
                        height: mounted ? `${(d.vol / maxVol) * 140}px` : "0px",
                        background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-deep) 100%)",
                        opacity: mounted ? 1 : 0,
                      }}
                    />
                    <div className="text-[10px] font-medium text-[var(--ink-faint)]">{d.day}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-[var(--ink-faint)]">
                <span>SOL volume per day</span>
                <span>Peak: {Math.max(...DAILY_VOLUME.map((d) => d.vol))} SOL</span>
              </div>
            </div>

            {/* Tier Distribution */}
            <div className="card p-6 md:p-8">
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">By Tier</div>
                <div className="mt-1 font-display text-xl font-medium tracking-tight">Tier Distribution</div>
              </div>
              <div className="flex flex-col gap-6">
                {TIER_DISTRIBUTION.map((t) => (
                  <div key={t.name}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="tabular text-sm font-semibold">{t.pct}%</span>
                    </div>
                    <div className="h-8 w-full overflow-hidden rounded-lg bg-[var(--surface)]">
                      <div
                        className="h-full rounded-lg transition-all duration-1000 ease-out"
                        style={{
                          width: mounted ? `${t.pct}%` : "0%",
                          backgroundColor: t.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-4 py-3 text-xs text-[var(--ink-soft)]">
                Express tier dominates with <span className="font-semibold text-[var(--ink)]">45%</span> of all loans — degens prefer speed.
              </div>
            </div>

            {/* Top Collateral Tokens */}
            <div className="card p-6 md:p-8">
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Collateral</div>
                <div className="mt-1 font-display text-xl font-medium tracking-tight">Top 10 Tokens by Volume</div>
              </div>
              <div className="flex flex-col gap-3">
                {TOP_COLLATERAL.map((t, i) => (
                  <div key={t.token} className="group flex items-center gap-3">
                    <span className="w-6 text-right font-mono text-xs text-[var(--ink-faint)]">
                      {t.rank}
                    </span>
                    <span className="w-24 text-sm font-semibold truncate">{t.token}</span>
                    <div className="flex-1 h-5 overflow-hidden rounded bg-[var(--surface)]">
                      <div
                        className="h-full rounded transition-all duration-700 ease-out"
                        style={{
                          width: mounted ? `${(t.vol / maxCollateral) * 100}%` : "0%",
                          background:
                            i === 0
                              ? "var(--accent)"
                              : i < 3
                              ? "var(--accent-deep)"
                              : "var(--ink-faint)",
                          opacity: i < 3 ? 1 : 0.5,
                          transitionDelay: `${i * 50}ms`,
                        }}
                      />
                    </div>
                    <span className="tabular w-20 text-right text-sm text-[var(--ink-soft)]">
                      {t.vol.toLocaleString()} SOL
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Distribution */}
            <div className="card p-6 md:p-8">
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Risk</div>
                <div className="mt-1 font-display text-xl font-medium tracking-tight">Health Distribution</div>
              </div>

              {/* Stacked bar */}
              <div className="mb-6 flex h-12 w-full overflow-hidden rounded-xl">
                {HEALTH_DISTRIBUTION.map((h) => (
                  <div
                    key={h.label}
                    className="flex items-center justify-center transition-all duration-1000 ease-out"
                    style={{
                      width: mounted ? `${h.pct}%` : "0%",
                      backgroundColor: h.color,
                    }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: h.color === "var(--accent)" ? "var(--accent-ink)" : "#fff",
                      }}
                    >
                      {h.pct}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                {HEALTH_DISTRIBUTION.map((h) => (
                  <div key={h.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: h.color }}
                      />
                      <span className="text-sm">{h.label}</span>
                    </div>
                    <span className="tabular text-sm font-semibold">
                      {h.pct}% of loans
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-4 py-3 text-xs text-[var(--ink-soft)]">
                <span className="font-semibold text-[var(--ink)]">78%</span> of active loans are in healthy territory. Protocol risk remains well-managed.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Protocol Health ── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="mb-10">
          <div className="chip mb-4">Protocol health</div>
          <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
            Under the hood
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROTOCOL_HEALTH.map((m, i) => (
            <div key={m.label} className="card card-hover p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                {m.label}
              </div>
              <div className="mt-3 font-display tabular text-4xl font-medium tracking-[-0.03em]">
                {m.value}
              </div>
              {/* Mini visual indicator */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: mounted ? `${parseFloat(m.value)}%` : "0%",
                    backgroundColor:
                      m.label === "Liquidation Rate"
                        ? "var(--warn)"
                        : "var(--accent)",
                    maxWidth: "100%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activity Feed ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <div className="chip mb-4">
                <span className="live-dot mr-1" style={{ width: 6, height: 6 }} />
                Live feed
              </div>
              <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                Recent Activity
              </h2>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {ACTIVITY_FEED.map((evt, i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-4 transition hover:bg-[var(--surface)]/50"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(8px)",
                  transition: `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`,
                }}
              >
                <ActivityIcon type={evt.icon} />
                <div className="flex-1 text-sm leading-relaxed">
                  {evt.text}
                </div>
                <div className="shrink-0 text-xs text-[var(--ink-faint)] tabular">
                  {evt.time}
                </div>
              </div>
            ))}
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
            The protocol is <span className="italic text-[var(--accent)]">live</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/70">
            Borrow SOL against your bags in seconds. No credit check, no KYC.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-base">
              Start lending
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
