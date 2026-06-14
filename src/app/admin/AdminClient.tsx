"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { StatusDot } from "@/components/icons";

// Creator/lender wallet — must match LENDER_PUBKEY on the bot.
const CREATOR_WALLET = "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx";

type PoolState = {
  pool_pda: string;
  authority: string;
  loan_token_mint: string;
  protocol_fee_bps: number;
  keeper_reward_bps: number;
  total_deposits_sol: number;
  total_borrowed_sol: number;
  total_fees_earned_sol: number;
  protocol_fee_share_sol: number;
  lp_fee_share_sol: number;
  total_loans_issued: string;
  total_liquidations: string;
  paused: boolean;
};

type Lifetime = {
  generated_at: string;
  cached_age_seconds: number;
  pool: {
    pda: string;
    total_deposits_lamports: string;
    total_borrowed_lamports: string;
    utilization_pct: number;
    total_loans_issued: number;
    total_liquidations: number;
    total_fees_earned_lamports: string;
    paused: boolean;
  };
  fee_split: {
    lp_yield_lamports: string;
    magpie_holders_lamports: string;
    referrers_lamports: string;
    lp_loyalty_lamports: string;
    protocol_treasury_lamports: string;
  };
  loans: {
    total: number; active: number; repaid: number; liquidated: number;
    unique_borrowers: number;
    lifetime_volume_lamports: string;
  };
  referrals: {
    reward_events: number;
    unique_referrers_paid: number;
    lifetime_accrued_lamports: string;
    paid_lamports: string;
    pending_claim_lamports: string;
  };
  magpie_holders: {
    distributions_to_date: number;
    total_distributed_lamports: string;
    paid_count: number;
    pending_count: number;
    unique_recipients: number;
    paid_lamports: string;
    pending_lamports: string;
    accrued_lamports: string;
    next_distribution_at: string | null;
  };
  lp_loyalty: {
    distributions_to_date: number;
    total_distributed_lamports: string;
    paid_lamports: string;
    pending_lamports: string;
    accrued_lamports: string;
  };
  users: { total: number; new_24h: number; new_7d: number; new_30d: number };
};

type Stats = {
  pool: PoolState | null;
  loans: {
    counts: { active: number; repaid: number; liquidated: number };
    volume_lamports: { active: string; repaid: string; liquidated: string };
    total_issued: number;
    default_rate: number;
    recent: Array<{
      id: number;
      status: string;
      collateral_mint: string;
      symbol: string | null;
      amount: string;
      ltv_percentage: number;
      duration_days: number;
      start_timestamp: string;
      updated_at: string;
      tx_signature: string | null;
    }>;
  };
  fees: {
    lifetime_lamports: string;
    last_24h_lamports: string;
    last_7d_lamports: string;
    protocol_share_bps: number;
    lp_share_bps: number;
  };
  top_collateral_mints: Array<{
    collateral_mint: string;
    symbol: string | null;
    name: string | null;
    loans: number;
    volume_lamports: string;
  }>;
  users: { total_users: number; borrowers: number; active_borrowers: number };
  tokens: { enabled_mints: number; pending_review: number };
  pool_utilization: number;
  generated_at: string;
};

// Postgres SUM(numeric) returns strings with decimals (e.g.
// "16400.0000000000000000") which BigInt can't parse. Number() handles
// both clean integer strings and decimal strings just fine for these
// magnitudes (max ~9e15 lamports = 9M SOL — well under Number precision).
const fmtSol = (lamportsStr: string | null | undefined, decimals = 4) => {
  const n = Number(lamportsStr ?? 0);
  if (!isFinite(n)) return "0";
  return (n / 1e9).toFixed(decimals);
};
const fmtOrDash = (n: number | undefined | null, decimals = 4) =>
  typeof n === "number" && isFinite(n) ? n.toFixed(decimals) : "—";

const Card = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) => (
  <div className={`rounded-2xl border p-5 ${accent ? "border-[var(--accent)]/30 bg-[var(--accent)]/5" : "border-[var(--hairline)] bg-[var(--bg)]"}`}>
    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">{label}</div>
    <div className={`mt-2 font-display text-2xl font-semibold tracking-tight ${accent ? "text-[var(--accent)]" : ""}`}>{value}</div>
    {sub && <div className="mt-1 text-xs text-[var(--ink-soft)]">{sub}</div>}
  </div>
);

export default function AdminClient() {
  const { publicKey, connected } = useWallet();
  const [stats, setStats] = useState<Stats | null>(null);
  const [lifetime, setLifetime] = useState<Lifetime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCreator = connected && publicKey?.toBase58() === CREATOR_WALLET;

  useEffect(() => {
    if (!isCreator || !publicKey) { setStats(null); return; }
    let cancelled = false;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/pool-stats?wallet=${publicKey.toBase58()}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || `${res.status}`);
          setStats(null);
        } else {
          setStats(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isCreator, publicKey]);

  // Lifetime stats — cached 1h server-side, so polling every 10 min from
  // the client is cheap (most hits return the cache instantly).
  useEffect(() => {
    if (!isCreator || !publicKey) { setLifetime(null); return; }
    let cancelled = false;
    const fetchLifetime = async () => {
      try {
        const res = await fetch(`/api/v1/admin/lifetime-stats?wallet=${publicKey.toBase58()}`);
        if (!res.ok) return;
        const data: Lifetime = await res.json();
        if (!cancelled) setLifetime(data);
      } catch { /* non-critical — pool-stats is the primary view */ }
    };
    fetchLifetime();
    const interval = setInterval(fetchLifetime, 10 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isCreator, publicKey]);

  if (!connected) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Creator Dashboard</h1>
        <p className="mt-4 text-base text-[var(--ink-soft)]">
          Connect the protocol's creator wallet to view economics, loans, fees, and lifetime metrics.
        </p>
        <div className="mt-8 flex justify-center"><ConnectWallet /></div>
      </main>
    );
  }

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-4 text-base text-[var(--ink-soft)]">
          This page is only available to the protocol creator wallet.
        </p>
        <p className="mt-2 font-mono text-xs text-[var(--ink-faint)]">
          Connected: {publicKey?.toBase58().slice(0, 6)}…{publicKey?.toBase58().slice(-6)}
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-[var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Error</h1>
        <p className="mt-4 font-mono text-sm text-red-500">{error}</p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-sm text-[var(--ink-soft)]">{loading ? "Loading protocol metrics…" : "Awaiting data."}</p>
      </main>
    );
  }

  const pool = stats.pool;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Creator dashboard</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Magpie protocol</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Real-time view of pool economics, loan activity, and lifetime earnings.{" "}
            <span className="text-[var(--ink-faint)]">Refreshes every 60s.</span>
          </p>
        </div>
        {pool?.paused && (
          <div className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
            ⏸ PROTOCOL PAUSED
          </div>
        )}
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          label="Total fees earned"
          value={`${fmtOrDash(pool?.total_fees_earned_sol, 6)} SOL`}
          sub={`gross · since pool init`}
          accent
        />
        <Card
          label="Your protocol cut"
          value={`${fmtOrDash(pool?.protocol_fee_share_sol, 6)} SOL`}
          sub={`${((pool?.protocol_fee_bps ?? 0) / 100).toFixed(1)}% of every loan fee`}
          accent
        />
        <Card
          label="Pool TVL"
          value={`${fmtOrDash(pool?.total_deposits_sol, 4)} SOL`}
          sub="all liquidity providers"
        />
        <Card
          label="Outstanding loans"
          value={`${fmtOrDash(pool?.total_borrowed_sol, 4)} SOL`}
          sub={`${((stats.pool_utilization ?? 0) * 100).toFixed(1)}% utilization`}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Active loans" value={String(stats.loans.counts.active)} sub={`${fmtSol(stats.loans.volume_lamports.active)} SOL outstanding`} />
        <Card label="Repaid loans" value={String(stats.loans.counts.repaid)} sub={`${fmtSol(stats.loans.volume_lamports.repaid)} SOL closed`} />
        <Card
          label="Liquidations"
          value={String(stats.loans.counts.liquidated)}
          sub={stats.loans.total_issued > 0 ? `${(stats.loans.default_rate * 100).toFixed(2)}% default rate` : "no loans yet"}
        />
        <Card label="Borrowers" value={String(stats.users.borrowers)} sub={`${stats.users.active_borrowers} active · ${stats.users.total_users} signed up`} />
      </div>

      {/* Fee origination by period */}
      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Fee origination</h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Card label="Last 24h" value={`${fmtSol(stats.fees.last_24h_lamports, 6)} SOL`} sub="gross fees originated" />
          <Card label="Last 7d" value={`${fmtSol(stats.fees.last_7d_lamports, 6)} SOL`} sub="gross fees originated" />
          <Card label="Lifetime" value={`${fmtSol(stats.fees.lifetime_lamports, 6)} SOL`} sub={`${(stats.fees.protocol_share_bps / 100).toFixed(1)}% to you · ${(stats.fees.lp_share_bps / 100).toFixed(1)}% to LPs`} />
        </div>
      </div>

      {/* Lifetime earnings — per stakeholder */}
      {lifetime && (
        <div className="mt-8">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">Lifetime earnings — by stakeholder</h2>
            <div className="text-xs text-[var(--ink-faint)]">
              Cached snapshot · {lifetime.cached_age_seconds < 60 ? "just refreshed" : `${Math.floor(lifetime.cached_age_seconds / 60)}m ago`}
            </div>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Of every loan fee (post-MGP-001): <span className="font-mono">70% $MAGPIE holders · 10% LP loyalty · 10% referrers · 10% protocol reserve</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card label="$MAGPIE holders (70%)" value={`${fmtSol(lifetime.fee_split.magpie_holders_lamports, 6)} SOL`} sub={lifetime.magpie_holders.distributions_to_date > 0 ? `${lifetime.magpie_holders.distributions_to_date} distributions` : "first snapshot pending"} />
            <Card label="LP loyalty (10%)" value={`${fmtSol(lifetime.fee_split.lp_loyalty_lamports, 6)} SOL`} sub={`${lifetime.lp_loyalty.distributions_to_date} distributions · shares × time held`} />
            <Card label="Referrers (10%)" value={`${fmtSol(lifetime.fee_split.referrers_lamports, 6)} SOL`} sub={`${lifetime.referrals.unique_referrers_paid} unique referrers · ${lifetime.referrals.reward_events} events`} />
            <Card label="Protocol reserve (10%)" value={`${fmtSol(lifetime.fee_split.protocol_treasury_lamports, 6)} SOL`} sub="buffer / treasury" />
          </div>

          {/* Distribution status grid */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">$MAGPIE holder rewards</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-[var(--ink-soft)]">Distributions</div>
                <div className="text-right font-mono">{lifetime.magpie_holders.distributions_to_date}</div>
                <div className="text-[var(--ink-soft)]">Paid out</div>
                <div className="text-right font-mono">{fmtSol(lifetime.magpie_holders.paid_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Pending</div>
                <div className="text-right font-mono">{fmtSol(lifetime.magpie_holders.pending_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Pool accrued</div>
                <div className="text-right font-mono">{fmtSol(lifetime.magpie_holders.accrued_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Recipients</div>
                <div className="text-right font-mono">{lifetime.magpie_holders.unique_recipients}</div>
              </div>
              {lifetime.magpie_holders.next_distribution_at && (
                <div className="mt-3 text-xs text-[var(--ink-faint)]">
                  Next: {new Date(lifetime.magpie_holders.next_distribution_at).toLocaleString()}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Referral earnings</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-[var(--ink-soft)]">Events</div>
                <div className="text-right font-mono">{lifetime.referrals.reward_events}</div>
                <div className="text-[var(--ink-soft)]">Unique referrers</div>
                <div className="text-right font-mono">{lifetime.referrals.unique_referrers_paid}</div>
                <div className="text-[var(--ink-soft)]">Accrued</div>
                <div className="text-right font-mono">{fmtSol(lifetime.referrals.lifetime_accrued_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Paid out</div>
                <div className="text-right font-mono">{fmtSol(lifetime.referrals.paid_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Pending claim</div>
                <div className="text-right font-mono">{fmtSol(lifetime.referrals.pending_claim_lamports, 4)} SOL</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">LP loyalty bonus</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-[var(--ink-soft)]">Distributions</div>
                <div className="text-right font-mono">{lifetime.lp_loyalty.distributions_to_date}</div>
                <div className="text-[var(--ink-soft)]">Paid out</div>
                <div className="text-right font-mono">{fmtSol(lifetime.lp_loyalty.paid_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Pending</div>
                <div className="text-right font-mono">{fmtSol(lifetime.lp_loyalty.pending_lamports, 4)} SOL</div>
                <div className="text-[var(--ink-soft)]">Pool accrued</div>
                <div className="text-right font-mono">{fmtSol(lifetime.lp_loyalty.accrued_lamports, 4)} SOL</div>
              </div>
            </div>
          </div>

          {/* User growth strip */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card label="Total users" value={lifetime.users.total.toLocaleString()} sub="all-time" />
            <Card label="New 24h" value={lifetime.users.new_24h.toLocaleString()} sub="last day" />
            <Card label="New 7d" value={lifetime.users.new_7d.toLocaleString()} sub="last week" />
            <Card label="New 30d" value={lifetime.users.new_30d.toLocaleString()} sub="last month" />
          </div>
        </div>
      )}

      {/* Top collateral mints */}
      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Top collateral by loan count</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg)]">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              <tr><th className="px-4 py-3 text-left">Token</th><th className="px-4 py-3 text-right">Loans</th><th className="px-4 py-3 text-right">Volume</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {stats.top_collateral_mints.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-[var(--ink-soft)]">No loans yet</td></tr>
              ) : stats.top_collateral_mints.map((m) => (
                <tr key={m.collateral_mint}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.symbol ?? "Unknown"}</div>
                    <div className="font-mono text-[10px] text-[var(--ink-faint)]">{m.collateral_mint.slice(0, 6)}…{m.collateral_mint.slice(-6)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{m.loans}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtSol(m.volume_lamports)} SOL</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent loans */}
      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Recent loans</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg)]">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              <tr>
                <th className="px-4 py-3 text-left">Token</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">LTV / term</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-right">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {stats.loans.recent.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--ink-soft)]">No loans yet</td></tr>
              ) : stats.loans.recent.map((l) => {
                const when = new Date(l.start_timestamp);
                const statusColor =
                  l.status === "active" ? "text-emerald-600"
                  : l.status === "repaid" ? "text-[var(--ink-soft)]"
                  : l.status === "liquidated" ? "text-red-600"
                  : "text-[var(--ink-faint)]";
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.symbol ?? "?"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmtSol(l.amount)} SOL</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{l.ltv_percentage}% · {l.duration_days}d</td>
                    <td className={`px-4 py-3 ${statusColor}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot className="h-1.5 w-1.5" />
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-faint)] text-xs">{when.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {l.tx_signature && (
                        <a href={`https://solscan.io/tx/${l.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] hover:underline">
                          view ↗
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token approval pipeline */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card label="Approved tokens" value={String(stats.tokens.enabled_mints)} sub="currently borrowable" />
        <Card label="Pending review" value={String(stats.tokens.pending_review)} sub="awaiting admin / age" />
      </div>

      <div className="mt-10 text-center text-xs text-[var(--ink-faint)]">
        Pool {pool?.pool_pda.slice(0, 8)}…{pool?.pool_pda.slice(-8)} · Updated {new Date(stats.generated_at).toLocaleTimeString()}
      </div>
    </main>
  );
}
