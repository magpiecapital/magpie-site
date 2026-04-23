"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  fetchPoolStats,
  fetchDepositorPosition,
  buildDepositTransaction,
  buildWithdrawTransaction,
  type PoolStats,
  type DepositorInfo,
} from "@/lib/solana/pool";

/* ───────────────────────── HELPERS ───────────────────────── */

function solStr(lamports: number, decimals = 4): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(decimals);
}

function pct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + "%";
}

/* ───────────────────────── PAGE ───────────────────────── */

export default function EarnPage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<DepositorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [txPending, setTxPending] = useState(false);
  const [txResult, setTxResult] = useState<{ sig: string; type: string } | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);

  // Fetch pool stats + position
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const stats = await fetchPoolStats(connection);
      setPool(stats);

      if (publicKey) {
        const bal = await connection.getBalance(publicKey);
        setSolBalance(bal);
        const pos = await fetchDepositorPosition(connection, publicKey);
        setPosition(pos);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch pool data");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!publicKey || !amount) return;
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamports <= 0) return;

    setTxPending(true);
    setTxError(null);
    setTxResult(null);
    try {
      const tx = await buildDepositTransaction(connection, publicKey, lamports);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setTxResult({ sig, type: "deposit" });
      setAmount("");
      refresh();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setTxPending(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!publicKey || !position || !amount) return;

    const lamportsRequested = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamportsRequested <= 0 || !pool) return;

    const shares = pool.totalDeposits > 0
      ? Math.floor((lamportsRequested * pool.totalShares) / pool.totalDeposits)
      : 0;
    if (shares <= 0) return;

    setTxPending(true);
    setTxError(null);
    setTxResult(null);
    try {
      const tx = await buildWithdrawTransaction(connection, publicKey, shares);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setTxResult({ sig, type: "withdraw" });
      setAmount("");
      refresh();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setTxPending(false);
    }
  };

  const maxDeposit = Math.max(0, solBalance - 0.01 * LAMPORTS_PER_SOL);
  const maxWithdraw = position ? position.currentValue : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="hero-glow" />
        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-20 md:pb-16">
          <div className="mb-4 flex flex-wrap items-center gap-2 fade-up">
            <span className="chip">
              <span className="live-dot" />
              Permissionless pool
            </span>
          </div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.04em] md:text-7xl fade-up fade-up-1">
            Earn yield.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed fade-up fade-up-2">
            Supply SOL to the lending pool. Earn a share of every borrower fee.
            Withdraw anytime — no lockups, no minimums.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-4 text-sm text-[var(--bad)]">
            {error}
          </div>
        )}

        {/* Pool Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Deposits" value={pool ? `${solStr(pool.totalDeposits, 2)} SOL` : "--"} loading={loading} />
          <StatCard label="Total Borrowed" value={pool ? `${solStr(pool.totalBorrowed, 2)} SOL` : "--"} loading={loading} />
          <StatCard label="Utilization" value={pool ? pct(pool.utilizationRate) : "--"} loading={loading} />
          <StatCard label="Loans Issued" value={pool ? pool.totalLoansIssued.toString() : "--"} loading={loading} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Deposit/Withdraw form */}
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm">
            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1 mb-6 bg-[var(--surface)]">
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setAmount(""); setTxError(null); setTxResult(null); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                    tab === t
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {!connected ? (
              <div className="text-center py-10">
                <p className="text-sm mb-3 text-[var(--ink-soft)]">Connect your wallet to get started.</p>
                <p className="text-xs text-[var(--ink-faint)]">Use the wallet button in the header.</p>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[var(--ink-soft)]">
                      Amount (SOL)
                    </label>
                    <button
                      onClick={() => {
                        const max = tab === "deposit" ? maxDeposit : maxWithdraw;
                        setAmount((max / LAMPORTS_PER_SOL).toFixed(4));
                      }}
                      className="text-xs font-medium text-[var(--accent-deep)] transition hover:text-[var(--accent)]"
                    >
                      Max: {solStr(tab === "deposit" ? maxDeposit : maxWithdraw)} SOL
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-4 py-3 text-lg font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                {/* Info row */}
                {tab === "deposit" && pool && amount && parseFloat(amount) > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--hairline)] p-3 text-xs space-y-1.5">
                    <InfoRow label="You deposit" value={`${parseFloat(amount).toFixed(4)} SOL`} />
                    <InfoRow
                      label="Pool share"
                      value={pool.totalDeposits > 0
                        ? pct(parseFloat(amount) * LAMPORTS_PER_SOL / (pool.totalDeposits + parseFloat(amount) * LAMPORTS_PER_SOL), 2)
                        : "100%"}
                    />
                    <InfoRow label="Yield source" value="Borrower loan fees" />
                  </div>
                )}

                {tab === "withdraw" && position && amount && parseFloat(amount) > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--hairline)] p-3 text-xs space-y-1.5">
                    <InfoRow label="You receive" value={`${parseFloat(amount).toFixed(4)} SOL`} />
                    <InfoRow
                      label="Remaining position"
                      value={`${solStr(Math.max(0, (position.currentValue) - parseFloat(amount) * LAMPORTS_PER_SOL))} SOL`}
                    />
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                  disabled={txPending || !amount || parseFloat(amount) <= 0}
                  className="btn-accent w-full py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {txPending ? "Confirming..." : tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
                </button>

                {/* Results */}
                {txResult && (
                  <div className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 text-sm">
                    {txResult.type === "deposit" ? "Deposit" : "Withdrawal"} confirmed!{" "}
                    <a
                      href={`https://solscan.io/tx/${txResult.sig}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]"
                    >
                      View on Solscan
                    </a>
                  </div>
                )}
                {txError && (
                  <div className="mt-4 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-3 text-sm text-[var(--bad)]">
                    {txError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Your Position + Info */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm">
              <h3 className="font-display text-lg font-semibold mb-4">Your Position</h3>
              {!connected ? (
                <p className="text-sm text-[var(--ink-soft)]">Connect wallet to view.</p>
              ) : position ? (
                <div className="space-y-3">
                  <InfoRow label="Deposited" value={`${solStr(position.depositedAmount)} SOL`} />
                  <InfoRow label="Current value" value={`${solStr(position.currentValue)} SOL`} />
                  <InfoRow
                    label="Yield earned"
                    value={`${position.yieldEarned >= 0 ? "+" : ""}${solStr(position.yieldEarned)} SOL`}
                    highlight={position.yieldEarned > 0}
                  />
                  <InfoRow label="Pool shares" value={position.shares.toLocaleString()} />
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-[var(--ink-soft)]">No active position.</p>
                  <p className="text-xs mt-1 text-[var(--ink-faint)]">Deposit SOL to start earning yield.</p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm">
              <h3 className="font-display text-lg font-semibold mb-4">How it works</h3>
              <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
                <HowStep n={1} text="Deposit SOL into the lending pool" />
                <HowStep n={2} text="Borrowers take loans and pay fees (1.5-3%)" />
                <HowStep n={3} text="Fees flow back to the pool, increasing your share value" />
                <HowStep n={4} text="Withdraw anytime with your earned yield" />
              </ol>
            </div>

            {/* Pool breakdown */}
            {pool && (
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold mb-4">Pool Details</h3>
                <div className="space-y-3">
                  <InfoRow label="Available liquidity" value={`${solStr(pool.availableLiquidity, 2)} SOL`} />
                  <InfoRow label="Total fees earned" value={`${solStr(pool.totalFeesEarned, 4)} SOL`} />
                  <InfoRow label="Liquidations" value={pool.totalLiquidations.toString()} />
                  <InfoRow label="Protocol fee" value={`${(pool.protocolFeeBps / 100).toFixed(0)}%`} />
                  <InfoRow label="Status" value={pool.paused ? "Paused" : "Active"} highlight={!pool.paused} />
                </div>
              </div>
            )}

            {/* Keeper Network */}
            {pool && (
              <div id="keeper" className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm scroll-mt-20">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-xs text-[var(--accent-deep)]">
                    &#x26A1;
                  </span>
                  <h3 className="font-display text-lg font-semibold">Keeper Network</h3>
                </div>
                <p className="text-sm mb-4 text-[var(--ink-soft)]">
                  Earn passive income by running a liquidation keeper. When loans expire,
                  keepers execute liquidations and earn a bounty — no staking required.
                </p>
                <div className="space-y-3">
                  <InfoRow label="Keeper bounty" value={`${(pool.keeperRewardBps / 100).toFixed(1)}% of collateral`} highlight />
                  <InfoRow label="Active loans" value={pool.totalLoansIssued > pool.totalLiquidations ? (pool.totalLoansIssued - pool.totalLiquidations).toString() : "0"} />
                  <InfoRow label="Total liquidations" value={pool.totalLiquidations.toString()} />
                  <InfoRow label="Permission" value="Permissionless" highlight />
                </div>
                <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 text-xs text-[var(--ink-soft)]">
                  Run the keeper bot: <code className="font-mono text-[var(--accent-deep)]">node src/services/keeper.js</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ───────────────────────── SUB-COMPONENTS ───────────────────────── */

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)] mb-1">{label}</p>
      <p className={`text-lg font-semibold ${loading ? "text-[var(--ink-faint)]" : ""}`}>
        {loading ? "..." : value}
      </p>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className={`font-medium ${highlight ? "text-[var(--accent-deep)]" : ""}`}>{value}</span>
    </div>
  );
}

function HowStep({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-bold text-[var(--accent-deep)]">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
