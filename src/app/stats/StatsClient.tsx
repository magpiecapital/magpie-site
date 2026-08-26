"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { CollateralBreakdown } from "@/components/CollateralBreakdown";
import {
  ShieldCheckIcon, ShieldIcon, GaugeIcon, UsersIcon, LayersIcon, CoinsIcon,
  BoltIcon, FlameIcon, TrendUpIcon, PulseIcon, GiftIcon,
} from "@/components/icons";

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
    active_outstanding_sol: number;
  };
  users: { total: number; new_24h: number; new_7d: number };
  holder_rewards: {
    // 2026-06-13 (per operator request): current_pool_sol is NOW public.
    // Timing (next_distribution_at) stays operator-private — the random
    // 5-10 day window kills the snapshot-timing arb without hiding the
    // amount itself.
    current_pool_sol: number;
    lifetime_distributions: number;
    lifetime_distributed_sol: number;
    last_distribution_sol: number | null;
    last_distribution_at: string | null;
  };
  lp_loyalty: {
    current_pool_sol: number;
    lifetime_distributions: number;
    lifetime_distributed_sol: number;
    last_distribution_sol: number | null;
    last_distribution_at: string | null;
  };
  referrals: {
    current_pool_sol: number;
    lifetime_accrued_sol: number;
    lifetime_paid_sol: number;
  };
  protocol_reserve: {
    current_pool_sol: number;
    lifetime_spent_sol: number;
  };
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

function engineStatusLabel(status: EngineData["status"] | undefined): string {
  switch (status) {
    case "alive":    return "Alive";
    case "degraded": return "Degraded";
    case "offline":  return "Offline";
    default:         return "—";
  }
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

interface EngineData {
  status: "alive" | "degraded" | "offline" | "unknown";
  heartbeatAgeSec: number | null;
  armedOrdersNow: number | null;
  firesAttempted24h: number;
  firesSucceeded24h: number;
  firesFailed24h: number;
  firesReverted24h: number;
  fireSuccessRate24h: number | null;
  jupiterHealth24h: number | null;
  // 2026-06-14: auto-sell revenue rollup. firesLifetime is total successful
  // fills, feesLifetimeSol / fees24hSol is the 1% protocol fee they
  // generated (split 70/10/10/10 to holders / LP loyalty / referrer /
  // protocol reserve via limit-close-fee-accrual-watcher).
  firesLifetime?: number;
  feesLifetimeSol?: number;
  fees24hSol?: number;
}

interface MagpieBurnedData {
  totalRaw: string;
  totalTokens: number;
  burnCount: number;
  bySource: {
    manualTokens: number;
    liquidationDefaultTokens: number;
    buybackTokens: number;
  };
  decimals: number;
}

interface DefaultedLoanProfitData {
  lifetimeSol: number;
  last24hSol: number;
  profitableDefaultsCount: number;
  magpieBurnedCount?: number;
  magpieBurnPendingCount?: number;
}

interface X402Data {
  calls_24h: number;
  calls_7d: number;
  revenue_24h_sol: number;
  revenue_7d_sol: number;
  revenue_total_sol: number;
  calls_total: number;
  unique_payers_24h: number;
  x402_borrows_total: number;
  x402_borrows_24h: number;
  last_x402_borrow_at?: string | null;
  last_x402_borrow_tx?: string | null;
}

export default function StatsClient() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [engine, setEngine] = useState<EngineData | null>(null);
  const [magpieBurned, setMagpieBurned] = useState<MagpieBurnedData | null>(null);
  const [defaultedProfit, setDefaultedProfit] = useState<DefaultedLoanProfitData | null>(null);
  const [x402, setX402] = useState<X402Data | null>(null);
  const [error, setError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  // Light tick (every 20s) so the subtle "updated Xs ago" freshness label stays current
  // between the 60s data refreshes — no data fetching, just a re-render.
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Fire both in parallel — transparency drives the heavyweight
        // sections, /stats now also carries the limit-close engine
        // rollup. Either failing shouldn't block the other from
        // rendering, so we Promise.allSettled and degrade per slot.
        const [tRes, sRes, xRes] = await Promise.allSettled([
          fetch("/api/v1/transparency", { cache: "no-store" }),
          fetch("/api/v1/stats", { cache: "no-store" }),
          fetch("/api/v1/x402-metrics", { cache: "no-store" }),
        ]);
        if (xRes.status === "fulfilled" && xRes.value.ok) {
          const json = (await xRes.value.json()) as X402Data;
          if (!cancelled && json && typeof json.calls_24h === "number") setX402(json);
        }
        if (tRes.status === "fulfilled" && tRes.value.ok) {
          const json = (await tRes.value.json()) as TransparencyData;
          if (!cancelled) {
            setData(json);
            setRefreshedAt(new Date());
          }
        } else if (tRes.status === "fulfilled") {
          throw new Error(`HTTP ${tRes.value.status}`);
        }
        if (sRes.status === "fulfilled" && sRes.value.ok) {
          const json = (await sRes.value.json()) as {
            ok: boolean;
            data?: {
              limitCloseEngine?: EngineData;
              magpieBurned?: MagpieBurnedData | null;
              defaultedLoanProfit?: DefaultedLoanProfitData | null;
            };
          };
          const e = json?.data?.limitCloseEngine;
          if (e && !cancelled) setEngine(e);
          const mb = json?.data?.magpieBurned;
          if (mb && !cancelled) setMagpieBurned(mb);
          const dp = json?.data?.defaultedLoanProfit;
          if (dp && !cancelled) setDefaultedProfit(dp);
        }
      } catch (err) {
        console.warn("stats fetch failed:", err);
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

  const freshness = (() => {
    if (!refreshedAt) return null;
    const s = Math.max(0, Math.round((nowTs - refreshedAt.getTime()) / 1000));
    if (s < 15) return "updated just now";
    if (s < 60) return `updated ${s}s ago`;
    const m = Math.round(s / 60);
    return `updated ${m}m ago`;
  })();

  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-8 sm:px-6 md:pt-24 md:pb-16">
          <div className="fade-up mb-5 inline-flex items-center gap-2 text-[11px] text-[var(--ink-faint)] sm:text-xs">
            <span className="live-dot" />
            <span>Live{freshness ? ` · ${freshness}` : ""}</span>
          </div>
          <h1 className="fade-up fade-up-1 font-display text-[2.25rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-7xl">
            Protocol Transparency
          </h1>
          <p className="fade-up fade-up-2 mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-lg">
            Every loan, every dollar, every reward — all verifiable on-chain.
            Updated live from the same database the bot writes to.
          </p>
        </div>
      </section>

      {/* ── Headline scoreboard — unified framed board (matches the homepage
            hero-stat pattern), icons per metric, zero-liquidations as the
            amber flagship cell. Structure/visuals only; every value is the
            same fmtNum/data path as before. ── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-6 sm:pb-12">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] shadow-md lg:grid-cols-4">
          <ScoreCell
            icon={<ShieldCheckIcon className="h-5 w-5" />}
            label="Liquidations · Lifetime"
            value={data ? fmtNum(data.headline.liquidations_lifetime) : "—"}
            sub={data && data.headline.liquidations_lifetime === 0 ? "Zero. Ever." : "Across protocol history"}
            flagship={!!data && data.headline.liquidations_lifetime === 0}
          />
          <ScoreCell
            icon={<GaugeIcon className="h-5 w-5" />}
            label="Default Rate"
            value={data ? `${data.headline.default_rate_pct}%` : "—"}
            sub="Liquidated / finalized loans"
          />
          <ScoreCell
            icon={<UsersIcon className="h-5 w-5" />}
            label="Total Users"
            value={data ? fmtNum(data.headline.users) : "—"}
            sub={data ? `+${data.users.new_24h} in 24h` : ""}
          />
          <ScoreCell
            icon={<LayersIcon className="h-5 w-5" />}
            label="Loans Lifetime"
            value={data ? fmtNum(data.headline.loans_lifetime) : "—"}
            sub={data ? `+${data.loans.new_24h} in 24h` : ""}
          />
        </div>
      </section>

      {/* ── Borrow volume ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <SectionHead
            icon={<CoinsIcon className="h-5 w-5" />}
            title="Borrow activity"
            tag="SOL borrowed"
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            <Stat label="Out on loan now" value={data ? fmtSol(data.loans.active_outstanding_sol) : "—"} sub={data ? `across ${fmtNum(data.loans.active)} active loans` : ""} />
            <Stat label="Lifetime borrowed" value={data ? fmtSol(data.loans.lifetime_borrowed_sol) : "—"} sub={data ? `${data.loans.total} loans` : ""} />
            <Stat label="Active loans" value={data ? fmtNum(data.loans.active) : "—"} sub="Currently outstanding" />
            <Stat label="Repaid loans" value={data ? fmtNum(data.loans.repaid) : "—"} sub="Successfully closed" />
          </div>
        </div>
      </section>

      {/* ── Collateral breakdown — every token currently in use ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <SectionHead icon={<LayersIcon className="h-5 w-5" />} title="Collateral in use" tag="Most-used first" />
        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
          Every token with at least one loan against it. Active count, lifetime count, and SOL borrowed — all verifiable on-chain.
        </p>
        <CollateralBreakdown />
      </section>

      {/* ── Live activity feed — the protocol breathing ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <SectionHead
          icon={<PulseIcon className="h-5 w-5" />}
          title="Live activity"
          tagNode={
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Streaming
            </span>
          }
        />
        <LiveActivityFeed />
      </section>

      {/* ── x402 agent lending — autonomous AI agents borrowing via pay-per-call ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <SectionHead icon={<BoltIcon className="h-5 w-5" />} title="x402 agent lending" tag="Autonomous agents · pay-per-call" />
        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
          Magpie is borrowable by autonomous AI agents over the{" "}
          <Link href="/x402" className="underline hover:text-[var(--ink)]">x402</Link>{" "}
          protocol — agents pay per API call (in SOL) and borrow against memecoins, tokenized
          stocks, and RWAs across V1, V3, and the V4 line — including V4.1, the Sec3-audited program that now serves every new auto-sell loan. Live counters below.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Paid agent calls (24h)"
            value={x402 ? x402.calls_24h.toLocaleString() : "—"}
            sub={x402 ? `${x402.calls_7d.toLocaleString()} in 7d` : undefined}
          />
          <Stat
            label="Agent fee revenue (all-time)"
            value={x402 && x402.revenue_total_sol != null ? `${x402.revenue_total_sol.toFixed(3)} SOL` : "—"}
            sub={x402 ? `${x402.revenue_24h_sol.toFixed(3)} SOL · 24h` : undefined}
          />
          <Stat
            label="x402-originated loans"
            value={x402 ? x402.x402_borrows_total.toLocaleString() : "—"}
            sub={x402 ? `${x402.x402_borrows_24h} in 24h` : "all-time"}
          />
          <Stat
            label="Paying agents (24h)"
            value={x402 ? x402.unique_payers_24h.toLocaleString() : "—"}
            sub="unique wallets"
          />
        </div>
        {x402?.last_x402_borrow_tx && (
          <p className="mt-4 text-[12px] text-[var(--ink-faint)]">
            Last agent borrow:{" "}
            <a
              href={`https://solscan.io/tx/${x402.last_x402_borrow_tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--ink)]"
            >
              {x402.last_x402_borrow_tx.slice(0, 8)}…{x402.last_x402_borrow_tx.slice(-8)}
            </a>
          </p>
        )}
      </section>

      {/* ── Snapshot rewards (MGP-001 four-channel split) ── */}
      {/* 2026-06-13: per operator request, accruing pool sizes are now
          public. Timing (next snapshot date) stays internal — the random
          5-10 day window kills timing arbitrage by itself. */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <SectionHead
          icon={<GiftIcon className="h-5 w-5" />}
          title="Snapshot rewards"
          tag="Accruing toward next distribution"
        />
        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
          Every loan origination + extension fee splits across four
          channels per <Link href="/governance/proposal/MGP-001" className="underline hover:text-[var(--ink)]">MGP-001</Link>:
          70% to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, 10% to the
          protocol reserve. When a loan has no referrer, that 10% rolls into the
          $MAGPIE holder pool — so holders earn 80% on non-referral loans, and
          100% of every fee is always distributed (nothing is retained). The
          numbers below are what&apos;s currently accruing toward the next
          distribution snapshot.
        </p>
        {/* ── Total rewards headline: all-time paid across every snapshot,
            PLUS what's currently accruing toward the next one (operator
            request 2026-08-03: show the cumulative total and include the
            future/accruing rewards in the same figure). All values live
            from the transparency API. ── */}
        {data && (() => {
          const distributedToDate =
            data.holder_rewards.lifetime_distributed_sol +
            data.lp_loyalty.lifetime_distributed_sol +
            data.referrals.lifetime_paid_sol;
          const accruingNow =
            data.holder_rewards.current_pool_sol +
            data.lp_loyalty.current_pool_sol +
            data.referrals.current_pool_sol +
            data.protocol_reserve.current_pool_sol;
          return (
            <div className="mb-6 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[11px]">
                    Total rewards · paid out + accruing
                  </div>
                  <div className="mt-1.5 text-3xl font-semibold tabular-nums text-[var(--ink)] sm:text-[2.5rem] sm:leading-none">
                    {fmtSol(distributedToDate + accruingNow)}
                  </div>
                  <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-[var(--ink-faint)] sm:text-[13px]">
                    Everything Magpie has returned to $MAGPIE holders, SOL LPs &amp; referrers
                    across every snapshot to date, plus what&apos;s already accruing toward the
                    next distribution.
                  </p>
                </div>
                <div className="flex flex-none gap-8 sm:gap-10">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] sm:text-[11px]">
                      Distributed to date
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--ink)] sm:text-2xl">
                      {fmtSol(distributedToDate)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                      {data.holder_rewards.lifetime_distributions} $MAGPIE snapshots
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] sm:text-[11px]">
                      Accruing now
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--accent-deep)] sm:text-2xl">
                      +{fmtSol(accruingNow)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                      toward next snapshot
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="$MAGPIE holders"
            value={data ? fmtSol(data.holder_rewards.current_pool_sol) : "—"}
            sub="70% of fees"
          />
          <Stat
            label="SOL LPs"
            value={data ? fmtSol(data.lp_loyalty.current_pool_sol) : "—"}
            sub="10% of fees"
          />
          <Stat
            label="Referrers"
            value={data ? fmtSol(data.referrals.current_pool_sol) : "—"}
            sub="10% of fees · claim-based"
          />
          <Stat
            label="Protocol reserve"
            value={data ? fmtSol(data.protocol_reserve.current_pool_sol) : "—"}
            sub="10% of fees · buffer"
          />
        </div>
        {data && data.holder_rewards.last_distribution_at && (
          <p className="mt-5 text-[12px] text-[var(--ink-faint)] sm:text-[13px]">
            Last $MAGPIE holder distribution: {fmtSol(data.holder_rewards.last_distribution_sol ?? 0)} —{" "}
            {relTime(data.holder_rewards.last_distribution_at)}
          </p>
        )}
        {data && data.lp_loyalty.last_distribution_at && (
          <p className="mt-1 text-[12px] text-[var(--ink-faint)] sm:text-[13px]">
            Last SOL LP loyalty distribution: {fmtSol(data.lp_loyalty.last_distribution_sol ?? 0)} —{" "}
            {relTime(data.lp_loyalty.last_distribution_at)}
          </p>
        )}
      </section>

      {/* ── Default economics: $MAGPIE burned + non-$MAGPIE profit ──
          When a $MAGPIE-collateralized loan defaults, the seized
          $MAGPIE is burned (supply contraction → larger pro-rata
          slice for remaining holders). When a non-$MAGPIE asset
          defaults, the protocol sells the collateral and routes the
          net profit 70/10/10/10 into the same four pools above —
          additive to the snapshot, not a separate distribution. */}
      {(magpieBurned || defaultedProfit) && (
        <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <SectionHead
            icon={<FlameIcon className="h-5 w-5" />}
            title="Default economics"
            tag="Burns + profit-to-rewards"
          />
          <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
            Defaulted loans don&apos;t leak value out of the system.
            $MAGPIE collateral gets burned 1:1 (operator-conducted,
            on-chain) — every $MAGPIE default is a burn, so the number
            of $MAGPIE defaults always equals the number of burns, and
            the burn shrinks supply to grow every holder&apos;s slice of
            the next payout. Any other collateral is sold and the net
            profit flows into the four reward channels above. All figures
            here are running totals.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="$MAGPIE burned"
              value={magpieBurned
                ? magpieBurned.totalTokens.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : "—"}
              sub={magpieBurned
                ? `${magpieBurned.burnCount} burn${magpieBurned.burnCount === 1 ? "" : "s"} on-ledger · all sources`
                : "Supply contraction"}
            />
            <Stat
              label="$MAGPIE defaults"
              value={defaultedProfit
                ? fmtNum(defaultedProfit.magpieBurnedCount ?? 0)
                : "—"}
              sub={defaultedProfit
                ? ((defaultedProfit.magpieBurnPendingCount ?? 0) === 0
                    ? "all burned 1:1 ✓"
                    : `${defaultedProfit.magpieBurnPendingCount} awaiting burn`)
                : "Burned 1:1"}
            />
            <Stat
              label="  via defaults"
              value={magpieBurned
                ? magpieBurned.bySource.liquidationDefaultTokens.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : "—"}
              sub="$MAGPIE seized + burned"
            />
            <Stat
              label="Default profit"
              value={defaultedProfit
                ? fmtSol(defaultedProfit.lifetimeSol)
                : "—"}
              sub="Non-$MAGPIE · to rewards"
            />
          </div>
        </section>
      )}

      {/* ── User-growth strip ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <SectionHead icon={<TrendUpIcon className="h-5 w-5" />} title="User growth" tag="New users" />
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <Stat label="Last 24h" value={data ? `+${fmtNum(data.users.new_24h)}` : "—"} sub="New signups" />
            <Stat label="Last 7d" value={data ? `+${fmtNum(data.users.new_7d)}` : "—"} sub="Weekly cohort" />
            <Stat label="Total" value={data ? fmtNum(data.users.total) : "—"} sub="All-time" />
          </div>
        </div>
      </section>

      {/* ── Auto-sell engine reliability + revenue ──
          Operator wants plain-English copy here ("Autonomous engine"
          was too technical). Section now reads as "Auto-sell engine"
          with a friendlier description AND a fees-collected line
          item so users can see auto-sell revenue flowing into the
          snapshot reward pools alongside borrow origination. */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <SectionHead
          icon={<GaugeIcon className="h-5 w-5" />}
          title="Auto-sell engine"
          tag="Watching your auto-sells 24/7"
        />
        <p className="mb-5 text-[13px] leading-relaxed text-[var(--ink-faint)] sm:text-sm">
          Auto-closes your position at the price you set. When your target hits, we instantly repay your loan and sell the collateral — no chart-staring required. If the first attempt would exceed your slippage allowance, we auto-retry with a slightly wider one (up to your cap) so you don't miss a trigger. Every successful auto-sell collects a 1% protocol fee that flows into the snapshot reward pools (same 70/10/10/10 split as borrow fees).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
          <Stat
            label="Engine status"
            value={engineStatusLabel(engine?.status)}
            sub={
              engine?.heartbeatAgeSec != null
                ? `Last check ${engine.heartbeatAgeSec}s ago`
                : "—"
            }
          />
          <Stat
            label="Armed right now"
            value={engine?.armedOrdersNow != null ? fmtNum(engine.armedOrdersNow) : "—"}
            sub="Orders being watched"
          />
          <Stat
            label="Auto-sells last 24h"
            value={engine ? fmtNum(engine.firesSucceeded24h) : "—"}
            sub={
              engine && engine.firesFailed24h > 0
                ? `${engine.firesFailed24h} unable to fill`
                : "All filled"
            }
          />
        </div>
        {engine != null && (engine.firesLifetime ?? 0) > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
            <Stat
              label="Lifetime auto-sells"
              value={fmtNum(engine.firesLifetime ?? 0)}
              sub="Successful fills, all time"
            />
            <Stat
              label="Fees to rewards (24h)"
              value={(engine.fees24hSol ?? 0).toFixed(4) + " SOL"}
              sub="1% of proceeds → holders + LPs"
            />
            <Stat
              label="Fees to rewards (lifetime)"
              value={(engine.feesLifetimeSol ?? 0).toFixed(4) + " SOL"}
              sub="Same 70/10/10/10 as borrow fees"
            />
            <Stat
              label="Jupiter health 24h"
              value={
                engine.jupiterHealth24h != null
                  ? `${(engine.jupiterHealth24h * 100).toFixed(1)}%`
                  : "—"
              }
              sub="Swap-routing uptime"
            />
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-faint)] sm:text-[12px]">
          Engine is alive when the last check was within 90 seconds, degraded between 90 seconds and 5 minutes, offline beyond. Watchdogs auto-restart on stall — see{" "}
          <a href="/security" className="underline hover:text-[var(--ink-soft)]">
            security &amp; reliability
          </a>{" "}
          for the full architecture.
        </p>
      </section>

      {/* ── Verify on-chain — every number above can be confirmed independently ── */}
      <VerifyOnChain />

      {/* ── Error / freshness footer ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 text-center text-[13px] text-[var(--ink-faint)] sm:px-6 sm:py-10 sm:text-sm">
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
        <div className="relative mx-auto max-w-6xl px-5 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <h2 className="font-display mx-auto max-w-3xl text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-[var(--bg-elevated)] sm:text-4xl md:text-6xl">
            Borrow against bags. <span className="italic text-[var(--accent)]">Never sell.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[var(--bg-elevated)]/70 sm:text-base">
            Telegram-native lending on Solana. Sub-1% liquidation rate by design.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:items-center sm:gap-4 md:mt-10 md:flex-row">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Start borrowing
              <span aria-hidden>→</span>
            </a>
            <Link href="/tokens" className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10">
              Browse collateral
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * SectionHead — responsive section header that stacks the title and the
 * uppercase tag on mobile so the tag never overflows / wraps next to a
 * long title. On sm+ it sits side-by-side at the baseline like the
 * original design. Shared so every section is consistent.
 */
function SectionHead({
  title,
  tag,
  tagNode,
  icon,
}: {
  title: string;
  tag?: string;
  tagNode?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent-deep)] ring-1 ring-[var(--hairline-strong)]">
            {icon}
          </span>
        )}
        <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
          {title}
        </h2>
      </div>
      {tagNode ?? (tag ? (
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
          {tag}
        </span>
      ) : null)}
    </div>
  );
}

/* ─── Sub-components ─── */

/**
 * ScoreCell — one cell of the headline scoreboard board. The parent uses
 * gap-px on a hairline background so cells read as one framed instrument
 * panel (the same language as the homepage hero stats). The flagship cell
 * (zero liquidations) gets an amber wash, an amber icon badge, a glowing
 * value and a slow sheen so it's unmistakably the marquee number.
 */
function ScoreCell({
  icon,
  label,
  value,
  sub,
  flagship = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  flagship?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden p-5 sm:p-6 md:p-7 ${flagship ? "score-flagship" : "bg-[var(--bg-elevated)]"}`}>
      {flagship && <span className="stat-sheen" aria-hidden />}
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
          flagship
            ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
            : "bg-[var(--surface)] text-[var(--ink-soft)] ring-1 ring-[var(--hairline)]"
        }`}
      >
        {icon}
      </span>
      <div
        className={`num-in mt-4 font-display tabular text-3xl font-medium leading-[1.0] tracking-[-0.03em] sm:text-4xl md:text-5xl ${
          flagship ? "text-[var(--accent-deep)]" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] sm:text-[11px] sm:tracking-[0.18em]">
        {label}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)] sm:text-xs">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card p-4 sm:p-5">
      <div className="stat-eyebrow text-[9px] uppercase tracking-[0.14em] text-[var(--ink-faint)] sm:text-[10px] sm:tracking-[0.18em]">{label}</div>
      <div className="num-in mt-1.5 font-display tabular text-lg font-medium leading-[1.05] tracking-[-0.02em] sm:mt-2 sm:text-2xl md:text-3xl">{value}</div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)] sm:text-xs">{sub}</div>}
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

/* ─── Verify on-chain ───────────────────────────────────────────
   Lets anyone confirm the numbers above are real. Every account here
   is a clickable Solscan link — readers can see Magpie's pools, the
   $MAGPIE mint, the lending programs, and every loan / repay /
   distribution that's ever happened. No off-chain trust required.
*/
const ONCHAIN_ACCOUNTS: { label: string; address: string; note: string }[] = [
  {
    label: "Lender authority",
    address: "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx",
    note: "Pool authority + fee receiver. Every borrow + repay + distribution touches this wallet.",
  },
  {
    label: "Memecoin lending program (v1)",
    address: "4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh",
    note: "Anchor program handling all memecoin-collateralized loans. Open-source logic, immutable rules.",
  },
  {
    label: "Dual-tier lending program (v3)",
    address: "B8AwYzFmc3ZB5EWWVtJcJhJtEmKL78W5i3kZrL1uMCmP",
    note: "Live on mainnet since 2026-06-13. Single program supports both memecoin (30/25/20% LTV) AND RWA (50/60/70% LTV) tiers, with on-chain TWAP oracle gating. Existing v1 loans continue on the original program.",
  },
  {
    label: "In-vault auto-sell program (v4)",
    address: "HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo",
    note: "Live on mainnet since 2026-06-15 (patched). Routes any borrow that arms an exit (TP / SL / Trailing / Ladder / Bracket). On fire, SOL accumulates inside the per-loan vault — the loan stays Active until the borrower repays. Same dual-tier ladder as v3.",
  },
  {
    label: "Memecoin pool state",
    address: "EynWtuRMUKU3zHzfLv7Y5Qu6MWpwqG17X91QAuHSww9u",
    note: "Live total_deposits, total_borrowed, total_shares for the memecoin pool.",
  },
  {
    label: "Memecoin pool wSOL vault",
    address: "5CYVDEqnLknmtyKkFEvpr5XnEJRzieXm1G5hSvYFG2Ko",
    note: "Holds the wSOL liquidity LPs deposit and borrowers draw from. Read the balance here for live TVL.",
  },
  {
    label: "v3 pool state",
    address: "6D1QmfDxFw4BRNWaVadzmFt1mVqs8Zw9EwkvT6HnR1Na",
    note: "Live state of the v3 dual-tier lending pool — memecoin + RWA share one pool with category-keyed LTV.",
  },
  {
    label: "v3 pool wSOL vault",
    address: "s2M7st6DEepiuKhX3ouJM7mUsr8aDMJNm8UQh82KrVb",
    note: "wSOL vault for the v3 lending pool.",
  },
  {
    label: "v4 pool state",
    address: "7My1o9Jfm2D5wM2xfpfy67NPvTPVUTSzWyz7ZxjwPjT4",
    note: "Live state of the v4 in-vault auto-sell lending pool.",
  },
  {
    label: "v4 pool wSOL vault",
    address: "7vfpVHc2ndPYw9dToiag2ARoUZ75BjLLuzsEfSjMtD1w",
    note: "wSOL vault for the v4 lending pool. Per-loan sol_proceeds_vault PDAs (one per loan) are separate and hold each loan's auto-sell proceeds independently.",
  },
  {
    label: "Engine authority (v4)",
    address: "7GKdZ8n6nNc6oFpQMiPZxmiR1KRJgXuBSmuJF4u2BKrs",
    note: "Hardcoded ENGINE_AUTHORITY in the v4 program. The ONLY pubkey allowed to call convert_collateral_slice. Least-privilege seam — cannot mint, withdraw pool reserves, or touch fee wallet outside the in-program 1% protocol skim.",
  },
  {
    label: "$MAGPIE mint",
    address: "9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump",
    note: "Token-2022 mint. Holders earn 70% of every loan fee (per MGP-001) — distributions go straight from the lender authority to holder wallets.",
  },
];

function VerifyOnChain() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
      <SectionHead icon={<ShieldIcon className="h-5 w-5" />} title="Verify on-chain" tag="Trust nothing, check everything" />
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
        Every number on this page is derived from on-chain state — the accounts below.
        Tap any address to inspect it on Solscan. The lending pools, the programs,
        the $MAGPIE mint, every loan, every distribution: all public, all verifiable
        without our cooperation.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ONCHAIN_ACCOUNTS.map((acc) => (
          <a
            key={acc.address}
            href={`https://solscan.io/account/${acc.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3.5 transition active:border-[var(--accent)]/40 hover:border-[var(--accent)]/40 hover:shadow-sm sm:p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)] sm:text-xs sm:tracking-[0.14em]">
                {acc.label}
              </div>
              {/* On mobile (no hover) show a persistent arrow so users know it's tappable. */}
              <span className="text-[10px] text-[var(--accent-deep)] opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                Solscan →
              </span>
            </div>
            <div className="mt-2 font-mono text-[10px] leading-snug text-[var(--ink)] break-all sm:text-[11px]">
              {acc.address}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-xs">
              {acc.note}
            </div>
          </a>
        ))}
      </div>
      <p className="mt-5 max-w-2xl text-[12px] leading-relaxed text-[var(--ink-soft)] sm:mt-6 sm:text-xs">
        Want to verify a specific loan? Every borrow + repay shows a transaction
        signature in <Link href="/dashboard" className="underline hover:text-[var(--ink)]">your dashboard</Link>{" "}
        and the <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('[id^="live"]')?.scrollIntoView({ behavior: "smooth" }); }} className="underline hover:text-[var(--ink)]">live activity feed above</a>.
        Paste any signature into Solscan to see the exact accounts, amounts, and program calls.
      </p>
    </section>
  );
}
