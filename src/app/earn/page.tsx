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

const MODE_KEY = "magpie-earn-mode";

/* ───────────────────────── PAGE ───────────────────────── */

export default function EarnPage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<DepositorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple vs Advanced mode — persisted in localStorage
  const [simpleMode, setSimpleMode] = useState(true);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
    if (saved === "advanced") setSimpleMode(false);
  }, []);
  const toggleMode = () => {
    const next = !simpleMode;
    setSimpleMode(next);
    localStorage.setItem(MODE_KEY, next ? "simple" : "advanced");
  };

  // Form state
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [txPending, setTxPending] = useState(false);
  const [txResult, setTxResult] = useState<{ sig: string; type: string } | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);

  // Pool is not yet initialized on mainnet. Flip this to true once
  // initializePool has been called, then remove the guard.
  const POOL_LIVE = false;

  const [poolNotInitialized] = useState(!POOL_LIVE);

  // Fetch pool stats + position — only when pool is live
  const refresh = useCallback(async () => {
    if (!POOL_LIVE) return; // zero RPC calls until pool exists
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
      const msg = e instanceof Error ? e.message : "";
      setError(msg || "Failed to fetch pool data");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!POOL_LIVE) {
      setLoading(false);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60_000);
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

  /* ─── Shared form pieces ─── */
  const depositWithdrawTabs = (
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
  );

  const amountInput = (
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
  );

  const submitButton = (
    <button
      onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
      disabled={txPending || !amount || parseFloat(amount) <= 0 || poolNotInitialized}
      className="btn-accent w-full py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {txPending ? "Confirming..." : tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
    </button>
  );

  const txFeedback = (
    <>
      {txResult && (
        <div className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 text-sm">
          {txResult.type === "deposit" ? "Deposit" : "Withdrawal"} confirmed!{" "}
          <a
            href={`https://solscan.io/tx/${txResult.sig}`}
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
  );

  /* ─── Mode toggle ─── */
  const modeToggle = (
    <button
      onClick={toggleMode}
      className="rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
    >
      {simpleMode ? "Advanced view" : "Simple view"}
    </button>
  );

  /* ═══════════════════════ SIMPLE MODE ═══════════════════════ */
  if (simpleMode) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <Header />

        <section className="relative overflow-hidden border-b border-[var(--hairline)]">
          <div className="hero-glow" />
          <div className="relative mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-6 md:pt-20 md:pb-16">
            <div className="mb-4 flex flex-wrap items-center gap-2 fade-up">
              <span className="chip">
                <span className="live-dot" />
                Passive yield
              </span>
              {modeToggle}
            </div>
            <h1 className="font-display text-3xl font-medium tracking-[-0.04em] sm:text-5xl md:text-7xl fade-up fade-up-1">
              Set it &amp; forget it.
            </h1>
            <p className="mt-3 max-w-xl text-base text-[var(--ink-soft)] leading-relaxed fade-up fade-up-2 sm:mt-4 sm:text-lg">
              Deposit SOL once. Yield accrues automatically from borrower fees.
              No staking, no claiming, no lockups. Withdraw anytime.
            </p>
          </div>
        </section>

        <main className="mx-auto max-w-lg px-5 py-8 sm:px-6 sm:py-12">
          {error && (
            <div className="mb-6 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-4 text-sm text-[var(--bad)]">
              {error}
            </div>
          )}

          {poolNotInitialized && (
            <div className="mb-6 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-5">
              <p className="text-sm font-semibold text-[var(--ink)] mb-1">Pool launching soon</p>
              <p className="text-sm text-[var(--ink-soft)]">
                Deposits will be enabled once the pool is activated. Join the{" "}
                <a href="https://t.me/magpiecapital" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">Telegram</a>
                {" "}for updates.
              </p>
            </div>
          )}

          {/* Position card */}
          <div className="mb-6 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 shadow-sm sm:p-8">
            {!connected ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-dim)]">
                  <svg className="h-7 w-7 text-[var(--accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--ink)] mb-1">Connect your wallet to start earning</p>
                <p className="text-xs text-[var(--ink-faint)]">Use the wallet button in the header</p>
              </div>
            ) : (
              <>
                {/* Balance display */}
                <div className="text-center mb-6">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)] mb-1">
                    {position ? "Your position" : "Wallet balance"}
                  </p>
                  <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                    {position
                      ? solStr(position.currentValue, 2)
                      : solStr(solBalance, 2)}
                    <span className="ml-1.5 text-lg text-[var(--ink-soft)]">SOL</span>
                  </p>
                  {position && position.yieldEarned !== 0 && (
                    <p className={`mt-1 text-sm font-medium ${position.yieldEarned > 0 ? "text-[var(--accent-deep)]" : "text-[var(--bad)]"}`}>
                      {position.yieldEarned > 0 ? "+" : ""}{solStr(position.yieldEarned)} SOL earned
                    </p>
                  )}
                </div>

                {/* Deposit / Withdraw */}
                {depositWithdrawTabs}
                {amountInput}
                {submitButton}
                {txFeedback}
              </>
            )}
          </div>

          {/* How it works — minimal */}
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 shadow-sm sm:p-8">
            <h3 className="font-display text-base font-semibold mb-4 sm:text-lg">How it works</h3>
            <div className="space-y-4">
              <SimpleStep icon="1" title="Deposit" desc="Send SOL to the lending pool in one transaction." />
              <SimpleStep icon="2" title="Earn" desc="Borrowers pay fees that automatically grow your share." />
              <SimpleStep icon="3" title="Withdraw" desc="Pull out your SOL plus earned yield at any time." />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* ═══════════════════════ ADVANCED MODE ═══════════════════════ */
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="hero-glow" />
        <div className="relative mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-6 md:pt-20 md:pb-16">
          <div className="mb-4 flex flex-wrap items-center gap-2 fade-up">
            <span className="chip">
              <span className="live-dot" />
              Permissionless pool
            </span>
            {modeToggle}
          </div>
          <h1 className="font-display text-3xl font-medium tracking-[-0.04em] sm:text-5xl md:text-7xl fade-up fade-up-1">
            Earn yield.
          </h1>
          <p className="mt-3 max-w-xl text-base text-[var(--ink-soft)] leading-relaxed fade-up fade-up-2 sm:mt-4 sm:text-lg">
            Supply SOL to the lending pool. Earn a share of every borrower fee.
            Withdraw anytime — no lockups, no minimums.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="mb-6 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-4 text-sm text-[var(--bad)]">
            {error}
          </div>
        )}

        {poolNotInitialized && (
          <div className="mb-6 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-5">
            <p className="text-sm font-semibold text-[var(--ink)] mb-1">Lending pool not yet live on mainnet</p>
            <p className="text-sm text-[var(--ink-soft)]">
              The pool contract is deployed but hasn&apos;t been initialized yet. Deposits will be
              enabled once the pool is activated. Join the{" "}
              <a href="https://t.me/magpiecapital" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">Telegram</a>
              {" "}for updates.
            </p>
          </div>
        )}

        {/* Pool Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 sm:gap-4 sm:mb-8">
          <StatCard label="Total Deposits" value={pool ? `${solStr(pool.totalDeposits, 2)} SOL` : "--"} loading={loading} />
          <StatCard label="Total Borrowed" value={pool ? `${solStr(pool.totalBorrowed, 2)} SOL` : "--"} loading={loading} />
          <StatCard label="Utilization" value={pool ? pct(pool.utilizationRate) : "--"} loading={loading} />
          <StatCard label="Loans Issued" value={pool ? pool.totalLoansIssued.toString() : "--"} loading={loading} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Deposit/Withdraw form */}
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
            {depositWithdrawTabs}

            {!connected ? (
              <div className="text-center py-10">
                <p className="text-sm mb-3 text-[var(--ink-soft)]">Connect your wallet to get started.</p>
                <p className="text-xs text-[var(--ink-faint)]">Use the wallet button in the header.</p>
              </div>
            ) : (
              <>
                {amountInput}

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

                {submitButton}
                {txFeedback}
              </>
            )}
          </div>

          {/* Right: Your Position + Info */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
              <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">Your Position</h3>
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
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
              <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">How it works</h3>
              <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
                <HowStep n={1} text="Deposit SOL into the lending pool" />
                <HowStep n={2} text="Borrowers take loans and pay fees (1.5-3%)" />
                <HowStep n={3} text="Fees flow back to the pool, increasing your share value" />
                <HowStep n={4} text="Withdraw anytime with your earned yield" />
              </ol>
            </div>

            {/* Pool breakdown */}
            {pool && (
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
                <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">Pool Details</h3>
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
              <div id="keeper" className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm scroll-mt-20 sm:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-xs text-[var(--accent-deep)]">
                    &#x26A1;
                  </span>
                  <h3 className="font-display text-base font-semibold sm:text-lg">Keeper Network</h3>
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

function SimpleStep({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-sm font-bold text-[var(--accent-deep)]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="text-sm text-[var(--ink-soft)]">{desc}</p>
      </div>
    </div>
  );
}
