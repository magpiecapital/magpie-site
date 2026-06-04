"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { CollateralBreakdown } from "@/components/CollateralBreakdown";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

interface TransparencyData {
  headline: {
    liquidations_lifetime: number;
    default_rate_pct: number;
    users: number;
    loans_lifetime: number;
  };
  loans: {
    total: number;
    active: number;
    repaid: number;
    liquidated: number;
    new_24h: number;
    new_7d: number;
    new_30d: number;
    lifetime_borrowed_sol: number;
    borrowed_24h_sol: number;
  };
  users: { total: number; new_24h: number; new_7d: number };
  holder_rewards: {
    // current_pool_sol is operator-private (NOT returned by the API);
    // omitted from this type so we never accidentally reference it.
    lifetime_distributions: number;
    last_distribution_sol: number | null;
    last_distribution_at: string | null;
  };
  lp_loyalty: { lifetime_distributions: number };
  referrals: { lifetime_accrued_sol: number; lifetime_paid_sol: number };
  generated_at: string;
}

function fmtNum(n: number, opts: Intl.NumberFormatOptions = {}) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2, ...opts });
}

function fmtSol(n: number) {
  if (n < 0.01) return n.toFixed(4) + " SOL";
  if (n < 100) return n.toFixed(3) + " SOL";
  return fmtNum(n, { maximumFractionDigits: 1 }) + " SOL";
}

function relTime(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StatsClient() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [error, setError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/transparency", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as TransparencyData;
        if (!cancelled) {
          setData(json);
          setRefreshedAt(new Date());
        }
      } catch (err) {
        console.warn("transparency fetch failed:", err);
        if (!cancelled) setError(true);
      }
    }
    load();
    // Auto-refresh every 60s so the page feels live
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[var(--ink-faint)]">Live · auto-refreshes every 60s</span>
          </div>
          <h1 className="fade-up fade-up-1 font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Protocol Transparency
          </h1>
          <p className="fade-up fade-up-2 mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Every loan, every dollar, every reward — all verifiable on-chain.
            Updated live from the same database the bot writes to.
          </p>
        </div>
      </section>

      {/* ── Headline numbers ── */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <HeadlineStat
            label="Liquidations · Lifetime"
            value={data ? fmtNum(data.headline.liquidations_lifetime) : "—"}
            sub={data && data.headline.liquidations_lifetime === 0 ? "Zero. Ever." : "Across protocol history"}
            highlight={!!data && data.headline.liquidations_lifetime === 0}
          />
          <HeadlineStat
            label="Default Rate"
            value={data ? `${data.headline.default_rate_pct}%` : "—"}
            sub="Liquidated / finalized loans"
          />
          <HeadlineStat
            label="Total Users"
            value={data ? fmtNum(data.headline.users) : "—"}
            sub={data ? `+${data.users.new_24h} in 24h` : ""}
          />
          <HeadlineStat
            label="Loans Lifetime"
            value={data ? fmtNum(data.headline.loans_lifetime) : "—"}
            sub={data ? `+${data.loans.new_24h} in 24h` : ""}
          />
        </div>
      </section>

      {/* ── Borrow volume ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">
              Borrow activity
            </h2>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              SOL borrowed
            </span>
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <Stat label="Last 24h" value={data ? fmtSol(data.loans.borrowed_24h_sol) : "—"} sub={data ? `${data.loans.new_24h} loans` : ""} />
            <Stat label="Lifetime borrowed" value={data ? fmtSol(data.loans.lifetime_borrowed_sol) : "—"} sub={data ? `${data.loans.total} loans` : ""} />
            <Stat label="Active loans" value={data ? fmtNum(data.loans.active) : "—"} sub="Currently outstanding" />
            <Stat label="Repaid loans" value={data ? fmtNum(data.loans.repaid) : "—"} sub="Successfully closed" />
          </div>
        </div>
      </section>

      {/* ── Collateral breakdown — every token currently in use ── */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">
            Collateral in use
          </h2>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Most-used first
          </span>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-[var(--ink-soft)] leading-relaxed">
          Every token with at least one loan against it. Active count, lifetime count, and SOL borrowed — all verifiable on-chain.
        </p>
        <CollateralBreakdown />
      </section>

      {/* ── Live activity feed — the protocol breathing ── */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">
            Live activity
          </h2>
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Streaming
          </span>
        </div>
        <LiveActivityFeed />
      </section>

      {/* ── User-growth strip ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">
              User growth
            </h2>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              New users
            </span>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <Stat label="Last 24h" value={data ? `+${fmtNum(data.users.new_24h)}` : "—"} sub="New signups" />
            <Stat label="Last 7d" value={data ? `+${fmtNum(data.users.new_7d)}` : "—"} sub="Weekly cohort" />
            <Stat label="Total" value={data ? fmtNum(data.users.total) : "—"} sub="All-time" />
          </div>
        </div>
      </section>

      {/* ── Error / freshness footer ── */}
      <section className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-[var(--ink-faint)]">
        {error ? (
          <span>Live data temporarily unavailable — refreshing…</span>
        ) : refreshedAt ? (
          <span>Last refreshed: {relTime(refreshedAt.toISOString())} · <a href="/api/v1/transparency" className="underline hover:text-[var(--ink-soft)]">view raw JSON</a></span>
        ) : (
          <span>Loading…</span>
        )}
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h2 className="font-display mx-auto max-w-3xl text-4xl font-medium tracking-[-0.03em] text-white md:text-6xl">
            Borrow against bags. <span className="italic text-[var(--accent)]">Never sell.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/70">
            Telegram-native lending on Solana. Zero liquidations by design.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Start borrowing
              <span aria-hidden>→</span>
            </a>
            <Link href="/tokens" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10">
              Browse collateral
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ─── Sub-components ─── */

function HeadlineStat({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card card-hover p-6 ${highlight ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
        {label}
      </div>
      <div className={`mt-3 font-display tabular text-4xl font-medium tracking-[-0.03em] md:text-5xl ${highlight ? "text-[var(--accent-deep)]" : ""}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs text-[var(--ink-soft)]">{sub}</div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">{label}</div>
      <div className="mt-2 font-display tabular text-2xl font-medium tracking-[-0.02em] md:text-3xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--ink-soft)]">{sub}</div>}
    </div>
  );
}

function RewardCard({
  title,
  currentPool,
  hideCurrentPool,
  distributions,
  lastDistribution,
  lastAt,
  paidOut,
  description,
}: {
  title: string;
  currentPool?: number;
  hideCurrentPool?: boolean;   // for pools we keep operator-private
  distributions?: number;
  lastDistribution?: number | null;
  lastAt?: string | null;
  paidOut?: number | null;
  description: string;
}) {
  // Pick a headline number:
  //  • If currentPool is allowed → use it (referrals)
  //  • Otherwise → use lifetime distributions count or last distribution
  const headlineValue = !hideCurrentPool && currentPool != null
    ? fmtSol(currentPool)
    : (lastDistribution != null ? fmtSol(lastDistribution) : (distributions != null ? distributions.toString() : "—"));
  const headlineLabel = !hideCurrentPool && currentPool != null
    ? "Current pool"
    : (lastDistribution != null ? "Last distribution" : "Lifetime distributions");

  return (
    <div className="card card-hover p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{title}</div>
      <div className="mt-3 font-display tabular text-3xl font-medium tracking-[-0.02em] md:text-4xl">
        {headlineValue}
      </div>
      <div className="mt-1 text-xs text-[var(--ink-soft)]">{headlineLabel}</div>
      <div className="mt-4 space-y-1.5 text-xs text-[var(--ink-soft)]">
        {distributions != null && !(headlineLabel === "Lifetime distributions") && (
          <div className="flex justify-between"><span>Lifetime distributions</span><span className="tabular">{distributions}</span></div>
        )}
        {lastDistribution != null && !(headlineLabel === "Last distribution") && (
          <div className="flex justify-between"><span>Last distribution</span><span className="tabular">{fmtSol(lastDistribution)}</span></div>
        )}
        {lastAt && (
          <div className="flex justify-between"><span>Last paid</span><span>{relTime(lastAt)}</span></div>
        )}
        {paidOut != null && (
          <div className="flex justify-between"><span>Lifetime paid out</span><span className="tabular">{fmtSol(paidOut)}</span></div>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--ink-soft)]">{description}</p>
    </div>
  );
}
