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

  // Public pool stats — fee periods (for APY estimate) + recent loan
  // events (for the live pool activity feed). Refreshed every 60s.
  type RecentLoanEvent = {
    symbol: string | null;
    status: string;
    loan_amount_lamports: string;
    fee_lamports: string;
    timestamp: string;
    event: "borrow" | "repay" | "liquidation";
  };
  const [poolApi, setPoolApi] = useState<{
    fees?: { last_7d_lamports: string; last_30d_lamports: string };
    recent_loans?: RecentLoanEvent[];
  } | null>(null);
  const recentLoanEvents = poolApi?.recent_loans ?? [];

  // Annualize trailing 7d LP fee yield into APY. LP gets 80% of every fee.
  // Formula: (7d_fees × 0.80 / pool_TVL) × 52  (weeks/year). Returns null
  // when there's not enough signal yet (no fees in window or zero TVL).
  const lpApy = (() => {
    if (!pool || !poolApi?.fees) return null;
    const tvl = pool.totalDeposits;
    if (!tvl) return null;
    const sevenDFees = Number(poolApi.fees.last_7d_lamports) || 0;
    if (sevenDFees <= 0) return null;
    const lpShareBps = 10_000 - pool.protocolFeeBps;
    const lpFees7d = (sevenDFees * lpShareBps) / 10_000;
    return (lpFees7d / tvl) * 52 * 100;
  })();

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

  // Pool is live on mainnet (initialized as part of the Token-2022 deploy).
  // Deposits / withdrawals route through the program's deposit/withdraw
  // instructions which we've verified work with real funds.
  const POOL_LIVE = true;

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

      // Public pool stats from the bot API — fee periods + recent events.
      // Best-effort; failure here doesn't block the rest.
      fetch("/api/v1/pool/stats")
        .then((r) => r.json())
        .then((d) => { if (d?.ok) setPoolApi(d); })
        .catch(() => {});
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

  /**
   * Confirm a transaction by POLLING signature status instead of relying
   * on the default 30s blockhash-expiration strategy. Solana's default
   * confirmTransaction throws "not confirmed in 30 seconds" even when
   * the tx is actually confirming on-chain — just slowly during
   * congestion. This polls every 1.5s up to 90s and returns success
   * the moment the tx is in.
   *
   * Returns:
   *   { ok: true } on success
   *   { ok: false, err } on on-chain failure
   *   { ok: false, pending: true } if 90s passed with no resolution
   *     (caller can still treat as ambiguous and direct user to explorer)
   */
  const confirmWithPoll = useCallback(
    async (sig: string, timeoutMs = 90_000): Promise<{ ok: boolean; pending?: boolean; err?: unknown }> => {
      const start = Date.now();
      const POLL_INTERVAL_MS = 1_500;
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
          const s = res?.value?.[0];
          if (s) {
            if (s.err) return { ok: false, err: s.err };
            if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") {
              return { ok: true };
            }
          }
        } catch {
          /* transient RPC error — keep polling */
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      return { ok: false, pending: true };
    },
    [connection],
  );

  // Handle deposit
  const handleDeposit = async () => {
    if (!publicKey || !amount) return;
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamports <= 0) return;

    setTxPending(true);
    setTxError(null);
    setTxResult(null);
    let sig = "";
    try {
      const tx = await buildDepositTransaction(connection, publicKey, lamports);
      sig = await sendTransaction(tx, connection);
      const r = await confirmWithPoll(sig);
      if (r.ok) {
        setTxResult({ sig, type: "deposit" });
        setAmount("");
        refresh();
      } else if (r.pending) {
        setTxError(
          `Tx submitted but not confirmed in 90s. It usually still lands — check https://solscan.io/tx/${sig} in a minute. If it shows Success, your deposit is in.`,
        );
      } else {
        setTxError(`On-chain error: ${JSON.stringify(r.err)}`);
      }
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
    let sig = "";
    try {
      const tx = await buildWithdrawTransaction(connection, publicKey, shares);
      sig = await sendTransaction(tx, connection);
      const r = await confirmWithPoll(sig);
      if (r.ok) {
        setTxResult({ sig, type: "withdraw" });
        setAmount("");
        refresh();
      } else if (r.pending) {
        setTxError(
          `Tx submitted but not confirmed in 90s. It usually still lands — check https://solscan.io/tx/${sig} in a minute. If it shows Success, your withdrawal completed.`,
        );
      } else {
        setTxError(`On-chain error: ${JSON.stringify(r.err)}`);
      }
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
            <div className="mt-5 fade-up fade-up-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-4 py-2 text-sm font-medium text-[var(--accent-deep)]">
                <span>★</span>
                <span>Long-term LPs also earn a Loyalty Bonus — 2% of every fee, time-weighted</span>
              </span>
              <Link
                href="/holders"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)]/30 hover:text-[var(--accent-deep)]"
              >
                <span>💎</span>
                <span>Prefer to earn without depositing? Hold $MAGPIE → 10% of every fee →</span>
              </Link>
            </div>
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

          {/* What you earn — fee breakdown */}
          <div className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)]/30 p-5 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-xs text-[var(--accent-deep)]">★</span>
              <h3 className="font-display text-base font-semibold sm:text-lg">What you earn</h3>
            </div>
            <p className="text-sm text-[var(--ink-soft)] mb-4">
              LPs receive <span className="font-semibold text-[var(--ink)]">80% of every loan fee</span>, proportional to share of the pool. Fees accrue directly — your position grows passively as borrowers pay.
            </p>
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] overflow-hidden">
              <div className="grid grid-cols-3 border-b border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                <div>Tier</div>
                <div className="text-right">Borrower fee</div>
                <div className="text-right">Your share</div>
              </div>
              {[
                { tier: "Express · 2d", fee: "3.00%", lp: "2.40%" },
                { tier: "Quick · 3d",   fee: "2.00%", lp: "1.60%" },
                { tier: "Standard · 7d", fee: "1.50%", lp: "1.20%" },
              ].map((row) => (
                <div key={row.tier} className="grid grid-cols-3 border-b border-[var(--hairline)] px-3 py-2 text-xs last:border-b-0">
                  <div className="text-[var(--ink-soft)]">{row.tier}</div>
                  <div className="text-right text-[var(--ink-soft)]">{row.fee}</div>
                  <div className="text-right font-semibold text-[var(--accent-deep)]">{row.lp}</div>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-[12px] text-[var(--ink-soft)]">
              <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> No lock-up — withdraw any time (subject to available liquidity)</li>
              <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Paid in SOL, accrues every loan that closes</li>
              <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Permissionless — no claim step, share value grows automatically</li>
            </ul>
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
                  {pool && pool.totalDeposits > 0 && (
                    <InfoRow
                      label="Pool share"
                      value={`${((position.currentValue / pool.totalDeposits) * 100).toFixed(2)}%`}
                    />
                  )}
                  {pool && lpApy != null && (
                    <InfoRow
                      label="Est. APY"
                      value={`${lpApy >= 1000 ? ">1000" : lpApy.toFixed(1)}%`}
                      highlight={lpApy > 0}
                    />
                  )}
                  {pool && (
                    <InfoRow
                      label="Withdrawable now"
                      value={`${solStr(Math.min(position.currentValue, pool.availableLiquidity))} SOL`}
                      sub={
                        position.currentValue > pool.availableLiquidity
                          ? "Rest available when borrowers repay"
                          : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-[var(--ink-soft)]">No active position.</p>
                  <p className="text-xs mt-1 text-[var(--ink-faint)]">Deposit SOL to start earning yield.</p>
                </div>
              )}
            </div>

            {/* Live yield activity */}
            {recentLoanEvents.length > 0 && (
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
                <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">Pool activity</h3>
                <p className="text-[11px] text-[var(--ink-faint)] mb-3">
                  Loan events flowing through the pool. 80% of each fee accrues to LPs proportionally.
                </p>
                <div className="space-y-2">
                  {recentLoanEvents.slice(0, 6).map((e, i) => {
                    const feeSol = Number(e.fee_lamports) / 1e9;
                    const when = new Date(e.timestamp);
                    const msAgo = Date.now() - when.getTime();
                    const rel =
                      msAgo < 60_000 ? "just now"
                      : msAgo < 3_600_000 ? `${Math.floor(msAgo / 60_000)}m ago`
                      : msAgo < 86_400_000 ? `${Math.floor(msAgo / 3_600_000)}h ago`
                      : `${Math.floor(msAgo / 86_400_000)}d ago`;
                    const icon = e.event === "repay" ? "✓" : e.event === "liquidation" ? "🔻" : "→";
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-[var(--ink-soft)]">
                          <span className="text-[var(--accent-deep)]">{icon}</span>
                          {e.event} <span className="font-medium text-[var(--ink)]">{e.symbol || "?"}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-[var(--accent-deep)]">+{feeSol.toFixed(6)} SOL</span>
                          <span className="text-[10px] text-[var(--ink-faint)] w-14 text-right">{rel}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* How LPs earn */}
            <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)]/30 p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-xs text-[var(--accent-deep)]">
                  ★
                </span>
                <h3 className="font-display text-base font-semibold sm:text-lg">How you earn</h3>
              </div>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                LPs receive <span className="font-semibold text-[var(--ink)]">80% of every loan fee</span>, proportional to share of the pool. Fees accrue directly into the pool, so your position grows passively.
              </p>

              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] overflow-hidden">
                <div className="grid grid-cols-3 border-b border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <div>Tier</div>
                  <div className="text-right">Borrower fee</div>
                  <div className="text-right">Your share</div>
                </div>
                {[
                  { tier: "Express · 30% LTV · 2d", fee: "3.00%", lp: "2.40%" },
                  { tier: "Quick · 25% LTV · 3d",   fee: "2.00%", lp: "1.60%" },
                  { tier: "Standard · 20% LTV · 7d", fee: "1.50%", lp: "1.20%" },
                ].map((row) => (
                  <div key={row.tier} className="grid grid-cols-3 border-b border-[var(--hairline)] px-3 py-2 text-xs last:border-b-0">
                    <div className="text-[var(--ink-soft)]">{row.tier}</div>
                    <div className="text-right text-[var(--ink-soft)]">{row.fee}</div>
                    <div className="text-right font-semibold text-[var(--accent-deep)]">{row.lp}</div>
                  </div>
                ))}
              </div>

              <ul className="mt-4 space-y-2 text-[12px] text-[var(--ink-soft)]">
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> No lock-up — withdraw any time (subject to available liquidity)</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Yield is variable, paid in SOL, accrues every loan that closes</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Share value grows as fees flow in — track it in your position panel</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Permissionless and on-chain — no off-chain rewards program, no claim step</li>
              </ul>
            </div>

            {/* How it works (mechanics) */}
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
              <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">How it works</h3>
              <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
                <HowStep n={1} text="Deposit SOL into the lending pool — you receive shares proportional to your stake" />
                <HowStep n={2} text="Borrowers take loans against approved memecoins, paying a 1.5–3% fee upfront" />
                <HowStep n={3} text="80% of every fee flows back into the pool, lifting share value for all LPs" />
                <HowStep n={4} text="Withdraw anytime: redeem shares for principal + accrued fees in SOL" />
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

function InfoRow({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className="flex items-start justify-between text-sm gap-2">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-right">
        <span className={`font-medium ${highlight ? "text-[var(--accent-deep)]" : ""}`}>{value}</span>
        {sub && <span className="block text-[10px] text-[var(--ink-faint)] mt-0.5">{sub}</span>}
      </span>
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
