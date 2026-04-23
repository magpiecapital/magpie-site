"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Mark } from "@/components/Logo";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
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

    // Convert SOL amount to shares
    const lamportsRequested = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamportsRequested <= 0 || !pool) return;

    // shares = lamports * totalShares / totalDeposits
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

  const maxDeposit = Math.max(0, solBalance - 0.01 * LAMPORTS_PER_SOL); // keep 0.01 SOL for fees
  const maxWithdraw = position ? position.currentValue : 0;

  return (
    <div className="min-h-screen" style={{ background: "#0f1114", color: "#e8e6e1" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: "#2a2c33", background: "rgba(15,17,20,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Mark size={24} />
            <span className="font-display text-base font-semibold tracking-tight" style={{ color: "#f7c948" }}>Magpie</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="transition hover:text-[#f7c948]" style={{ color: "#9a978f" }}>Dashboard</Link>
            <span className="font-medium" style={{ color: "#f7c948" }}>Earn</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Earn</h1>
        <p className="text-sm mb-8" style={{ color: "#9a978f" }}>
          Supply SOL to the lending pool and earn yield from borrower fees.
        </p>

        {error && (
          <div className="mb-6 rounded-xl border p-4 text-sm" style={{ borderColor: "#e05555", background: "rgba(224,85,85,0.08)", color: "#e05555" }}>
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
          <div className="rounded-2xl border p-6" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1 mb-6" style={{ background: "#252730" }}>
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setAmount(""); setTxError(null); setTxResult(null); }}
                  className="flex-1 rounded-lg py-2 text-sm font-medium capitalize transition"
                  style={{
                    background: tab === t ? "#f7c948" : "transparent",
                    color: tab === t ? "#1a1500" : "#9a978f",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {!connected ? (
              <div className="text-center py-10">
                <p className="text-sm mb-3" style={{ color: "#9a978f" }}>Connect your wallet to get started.</p>
                <p className="text-xs" style={{ color: "#5c5a55" }}>Use the wallet button in the dashboard header.</p>
              </div>
            ) : (
              <>
                {/* Amount input */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: "#9a978f" }}>
                      Amount (SOL)
                    </label>
                    <button
                      onClick={() => {
                        const max = tab === "deposit" ? maxDeposit : maxWithdraw;
                        setAmount((max / LAMPORTS_PER_SOL).toFixed(4));
                      }}
                      className="text-xs font-medium transition hover:opacity-80"
                      style={{ color: "#f7c948" }}
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
                    className="w-full rounded-xl border px-4 py-3 text-lg font-medium outline-none transition focus:border-[#f7c948]"
                    style={{ borderColor: "#2a2c33", background: "#252730", color: "#e8e6e1" }}
                  />
                </div>

                {/* Info row */}
                {tab === "deposit" && pool && amount && parseFloat(amount) > 0 && (
                  <div className="mb-4 rounded-lg p-3 text-xs space-y-1" style={{ background: "#252730" }}>
                    <div className="flex justify-between">
                      <span style={{ color: "#9a978f" }}>You deposit</span>
                      <span>{parseFloat(amount).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#9a978f" }}>Pool share</span>
                      <span>
                        {pool.totalDeposits > 0
                          ? pct(parseFloat(amount) * LAMPORTS_PER_SOL / (pool.totalDeposits + parseFloat(amount) * LAMPORTS_PER_SOL), 2)
                          : "100%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#9a978f" }}>Yield source</span>
                      <span>Borrower loan fees</span>
                    </div>
                  </div>
                )}

                {tab === "withdraw" && position && amount && parseFloat(amount) > 0 && (
                  <div className="mb-4 rounded-lg p-3 text-xs space-y-1" style={{ background: "#252730" }}>
                    <div className="flex justify-between">
                      <span style={{ color: "#9a978f" }}>You receive</span>
                      <span>{parseFloat(amount).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#9a978f" }}>Remaining position</span>
                      <span>{solStr(Math.max(0, (position.currentValue) - parseFloat(amount) * LAMPORTS_PER_SOL))} SOL</span>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                  disabled={txPending || !amount || parseFloat(amount) <= 0}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold transition disabled:opacity-40"
                  style={{ background: "#f7c948", color: "#1a1500" }}
                >
                  {txPending ? "Confirming..." : tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
                </button>

                {/* Results */}
                {txResult && (
                  <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "rgba(247,201,72,0.08)", border: "1px solid rgba(247,201,72,0.2)" }}>
                    {txResult.type === "deposit" ? "Deposit" : "Withdrawal"} confirmed!{" "}
                    <a
                      href={`https://solscan.io/tx/${txResult.sig}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: "#f7c948" }}
                    >
                      View on Solscan
                    </a>
                  </div>
                )}
                {txError && (
                  <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "rgba(224,85,85,0.08)", border: "1px solid rgba(224,85,85,0.2)", color: "#e05555" }}>
                    {txError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Your Position */}
          <div className="space-y-4">
            <div className="rounded-2xl border p-6" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
              <h3 className="font-display text-lg font-semibold mb-4">Your Position</h3>
              {!connected ? (
                <p className="text-sm" style={{ color: "#9a978f" }}>Connect wallet to view.</p>
              ) : position ? (
                <div className="space-y-3">
                  <PositionRow label="Deposited" value={`${solStr(position.depositedAmount)} SOL`} />
                  <PositionRow label="Current value" value={`${solStr(position.currentValue)} SOL`} />
                  <PositionRow
                    label="Yield earned"
                    value={`${position.yieldEarned >= 0 ? "+" : ""}${solStr(position.yieldEarned)} SOL`}
                    highlight={position.yieldEarned > 0}
                  />
                  <PositionRow label="Pool shares" value={position.shares.toLocaleString()} />
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm" style={{ color: "#9a978f" }}>No active position.</p>
                  <p className="text-xs mt-1" style={{ color: "#5c5a55" }}>Deposit SOL to start earning yield.</p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-2xl border p-6" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
              <h3 className="font-display text-lg font-semibold mb-4">How it works</h3>
              <ol className="space-y-3 text-sm" style={{ color: "#9a978f" }}>
                <HowStep n={1} text="Deposit SOL into the lending pool" />
                <HowStep n={2} text="Borrowers take loans and pay fees (1.5-3%)" />
                <HowStep n={3} text="Fees flow back to the pool, increasing your share value" />
                <HowStep n={4} text="Withdraw anytime with your earned yield" />
              </ol>
            </div>

            {/* Pool breakdown */}
            {pool && (
              <div className="rounded-2xl border p-6" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
                <h3 className="font-display text-lg font-semibold mb-4">Pool Details</h3>
                <div className="space-y-3">
                  <PositionRow label="Available liquidity" value={`${solStr(pool.availableLiquidity, 2)} SOL`} />
                  <PositionRow label="Total fees earned" value={`${solStr(pool.totalFeesEarned, 4)} SOL`} />
                  <PositionRow label="Liquidations" value={pool.totalLiquidations.toString()} />
                  <PositionRow label="Protocol fee" value={`${(pool.protocolFeeBps / 100).toFixed(0)}%`} />
                  <PositionRow label="Status" value={pool.paused ? "Paused" : "Active"} highlight={!pool.paused} />
                </div>
              </div>
            )}

            {/* Keeper Network */}
            {pool && (
              <div className="rounded-2xl border p-6" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs" style={{ background: "rgba(247,201,72,0.12)", color: "#f7c948" }}>
                    &#x26A1;
                  </span>
                  <h3 className="font-display text-lg font-semibold">Keeper Network</h3>
                </div>
                <p className="text-sm mb-4" style={{ color: "#9a978f" }}>
                  Earn passive income by running a liquidation keeper. When loans expire,
                  keepers execute liquidations and earn a bounty — no staking required.
                </p>
                <div className="space-y-3">
                  <PositionRow label="Keeper bounty" value={`${(pool.keeperRewardBps / 100).toFixed(1)}% of collateral`} highlight />
                  <PositionRow label="Active loans" value={pool.totalLoansIssued > pool.totalLiquidations ? (pool.totalLoansIssued - pool.totalLiquidations).toString() : "0"} />
                  <PositionRow label="Total liquidations" value={pool.totalLiquidations.toString()} />
                  <PositionRow label="Permission" value="Permissionless" highlight />
                </div>
                <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: "#252730", color: "#9a978f" }}>
                  Run the keeper bot: <code className="font-mono" style={{ color: "#f7c948" }}>node src/services/keeper.js</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ───────────────────────── SUB-COMPONENTS ───────────────────────── */

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#2a2c33", background: "#1e2028" }}>
      <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "#5c5a55" }}>{label}</p>
      <p className="text-lg font-semibold" style={{ color: loading ? "#5c5a55" : "#e8e6e1" }}>
        {loading ? "..." : value}
      </p>
    </div>
  );
}

function PositionRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "#9a978f" }}>{label}</span>
      <span className="font-medium" style={{ color: highlight ? "#f7c948" : "#e8e6e1" }}>{value}</span>
    </div>
  );
}

function HowStep({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "rgba(247,201,72,0.12)", color: "#f7c948" }}
      >
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
