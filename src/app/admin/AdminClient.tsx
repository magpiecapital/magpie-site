"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";

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

const fmtSol = (lamportsStr: string, decimals = 4) =>
  (Number(BigInt(lamportsStr || "0")) / 1e9).toFixed(decimals);

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
    const interval = setInterval(fetchStats, 30_000);
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
            <span className="text-[var(--ink-faint)]">Refreshes every 30s.</span>
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
          value={`${pool?.total_fees_earned_sol.toFixed(6) ?? "—"} SOL`}
          sub={`gross · since pool init`}
          accent
        />
        <Card
          label="Your protocol cut"
          value={`${pool?.protocol_fee_share_sol.toFixed(6) ?? "—"} SOL`}
          sub={`${((pool?.protocol_fee_bps ?? 0) / 100).toFixed(1)}% of every loan fee`}
          accent
        />
        <Card
          label="Pool TVL"
          value={`${pool?.total_deposits_sol.toFixed(4) ?? "—"} SOL`}
          sub="all liquidity providers"
        />
        <Card
          label="Outstanding loans"
          value={`${pool?.total_borrowed_sol.toFixed(4) ?? "—"} SOL`}
          sub={`${(stats.pool_utilization * 100).toFixed(1)}% utilization`}
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
                const status = l.status === "active" ? "🟢 active" : l.status === "repaid" ? "✓ repaid" : l.status === "liquidated" ? "🔻 liquidated" : l.status;
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.symbol ?? "?"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmtSol(l.amount)} SOL</td>
                    <td className="px-4 py-3 text-right text-[var(--ink-soft)]">{l.ltv_percentage}% · {l.duration_days}d</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{status}</td>
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
