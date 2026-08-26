"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { DiamondIcon } from "@/components/DiamondIcon";
import { TriangleAlertIcon } from "@/components/icons";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TELEGRAM_COMMUNITY } from "@/lib/telegram-links";
import {
  fetchPoolStats,
  fetchDepositorPositionForVersion,
  fetchAllDepositorPositions,
  buildDepositTransaction,
  buildWithdrawBundleTransaction,
  MAX_WITHDRAW_IXS_PER_TX,
  computeMaxSafeWithdrawShares,
  DEPOSIT_VERSION,
  type PoolStats,
  type DepositorInfo,
  type LpVersion,
  type VersionedPosition,
} from "@/lib/solana/pool";
import { sendAndConfirmWithRebroadcast } from "@/lib/solana/send-confirm";

// Human label for a pool version. V4 is the flagship (new deposits).
function versionLabel(v: LpVersion): string {
  return v === "v41" ? "V4.1 (flagship · audited)"
    : v === "v4" ? "V4 (prior flagship)"
    : v === "v3" ? "V3 (RWA)"
    : v === "v2" ? "V2 (legacy RWA)"
    : "V1 (memecoin)";
}
import { translateTxError, type FriendlyError } from "@/lib/solana/tx-error";

/* ───────────────────────── HELPERS ───────────────────────── */

function solStr(lamports: number, decimals = 4): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(decimals);
}

function pct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + "%";
}

/**
 * Minimum pool size (in SOL) before we show "Pool TVL" as a trust signal.
 *
 * An instantaneous balance swings with a single deposit or withdrawal and says
 * nothing about track record — a small number actively undersells the pool.
 * Below this we show LIFETIME FEES instead: it only goes up, and it is earned
 * rather than parked, which is the thing a prospective LP is actually asking
 * about. Nothing is hidden — the pool balance stays public on-chain and via the
 * API; this is only about which number leads.
 */
const TVL_DISPLAY_MIN_SOL = Number(process.env.NEXT_PUBLIC_TVL_DISPLAY_MIN_SOL ?? 250);

const MODE_KEY = "magpie-earn-mode";

/* ───────────────────────── PAGE ───────────────────────── */

export default function EarnPage() {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [pool, setPool] = useState<PoolStats | null>(null);
  const [position, setPosition] = useState<DepositorInfo | null>(null);
  // All the wallet's LP positions across V1/V2/V3/V4 (flagship-first). New
  // deposits go to V4, but existing V1/V2/V3 LPs are NEVER stranded — this
  // sweep finds their money wherever it lives. `activeVersion` is the pool
  // the withdraw form acts on; `pool` + `position` mirror that active pool.
  const [positions, setPositions] = useState<VersionedPosition[]>([]);
  const [activeVersion, setActiveVersion] = useState<LpVersion>(DEPOSIT_VERSION);
  // Always the V4 flagship pool — deposits ALWAYS go here, so the deposit
  // tab's preview reflects V4 even when `pool` mirrors a legacy active
  // position (e.g. the V1 whale). Keeps deposit UX accurate for everyone.
  const [depositPool, setDepositPool] = useState<PoolStats | null>(null);
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
    fees?: { last_7d_lamports: string; last_30d_lamports: string; lifetime_lamports?: string };
    recent_loans?: RecentLoanEvent[];
  } | null>(null);
  const recentLoanEvents = poolApi?.recent_loans ?? [];

  // Annualize trailing 7d LP fee yield into APY. Post-MGP-001 LPs receive
  // the 10% LP loyalty slice of every loan fee.
  // Formula: (7d_fees × 0.10 / pool_TVL) × 52 (weeks/year). Returns null
  // when there's not enough signal yet (no fees in window or zero TVL).
  const lpApy = (() => {
    if (!pool || !poolApi?.fees) return null;
    const tvl = pool.totalDeposits;
    if (!tvl) return null;
    const sevenDFees = Number(poolApi.fees.last_7d_lamports) || 0;
    if (sevenDFees <= 0) return null;
    // Post-MGP-001 LP loyalty bps. Hardcoded mirrors V3_RWA_TIERS/holder constants;
    // governance_config.lp_loyalty_bps is the authoritative server-side number.
    const LP_LOYALTY_BPS = 1000;
    const lpFees7d = (sevenDFees * LP_LOYALTY_BPS) / 10_000;
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
  // When the user clicks "Max", we capture the EXACT lamport value here so the
  // submit path can use the precise on-chain amount instead of round-tripping
  // through the display string (which rounds at 4 decimals and can push the
  // requested lamports above the actual balance). Cleared on any manual edit.
  const [maxLamports, setMaxLamports] = useState<number | null>(null);
  const [txPending, setTxPending] = useState(false);
  // For chunked withdraws (working around v1 program's u64 overflow):
  // {step, total, lamportsDone} so the UI can show 'Withdrawing chunk 2 of 5…'
  const [chunkProgress, setChunkProgress] = useState<{ step: number; total: number; lamportsDone: number } | null>(null);
  const [txResult, setTxResult] = useState<{ sig: string; type: string } | null>(null);
  const [txError, setTxError] = useState<FriendlyError | null>(null);
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

      // The V4 flagship pool — deposits always land here.
      const dPool = await fetchPoolStats(connection, DEPOSIT_VERSION);
      setDepositPool(dPool);

      if (publicKey) {
        const bal = await connection.getBalance(publicKey);
        setSolBalance(bal);
        // Sweep every pool version so no LP (incl. the 110-SOL V1 whale) is
        // stranded when new deposits move to V4.
        const all = await fetchAllDepositorPositions(connection, publicKey);
        setPositions(all);
        // Keep the current selection if the wallet still holds it, else
        // default to the first position (flagship-first order).
        const active = all.find((p) => p.version === activeVersion) ?? all[0] ?? null;
        const av = active?.version ?? DEPOSIT_VERSION;
        setActiveVersion(av);
        setPosition(active?.info ?? null);
        // pool = the ACTIVE position's pool, so the withdraw math + share
        // display are correct for whatever pool the LP actually holds (V4 for
        // new depositors, V1 for the legacy whale). Reuse dPool when active
        // is already V4 to avoid a redundant fetch.
        setPool(av === DEPOSIT_VERSION ? dPool : await fetchPoolStats(connection, av));
      } else {
        setPositions([]);
        setPosition(null);
        setPool(dPool);
      }

      // Public pool stats from the bot API — fee periods + recent events.
      // Best-effort; failure here doesn't block the rest.
      fetch("/api/v1/pool/stats")
        .then((r) => r.json())
        .then((d) => { if (d?.ok) setPoolApi(d); })
        .catch(() => {});
    } catch (e: unknown) {
      // Don't surface raw RPC errors to the user — they're noisy and
      // usually transient. Log to console for debugging; show a clean
      // generic message in the UI.
      console.warn("[earn] pool refresh failed:", e instanceof Error ? e.message : e);
      setError("Pool data briefly unavailable — refreshing in a moment.");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, activeVersion]);

  useEffect(() => {
    if (!POOL_LIVE) {
      setLoading(false);
      return;
    }
    refresh();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!publicKey || !amount) return;
    // Source of truth: if Max was clicked, use the captured exact lamport
    // value. Otherwise parse the user's typed string. Never trust a
    // round-tripped SOL→string→SOL conversion when the underlying is lamports.
    let lamports = maxLamports !== null
      ? maxLamports
      : Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamports <= 0) return;

    setTxError(null);
    setTxResult(null);

    // Preflight: do they have enough SOL to cover deposit + ATA rent + fees?
    // ~0.003 SOL reserve is plenty for typical deposit flows.
    const GAS_RESERVE = Math.floor(0.003 * LAMPORTS_PER_SOL);
    // Hard clamp: if the requested amount is within tx-fee tolerance of the
    // user's actual balance, cap to balance - GAS_RESERVE. Defends against any
    // future rounding regressions — submission can never exceed real funds.
    const maxAllowedDeposit = Math.max(0, solBalance - GAS_RESERVE);
    if (lamports > maxAllowedDeposit && lamports <= solBalance + 1_000_000) {
      lamports = maxAllowedDeposit;
    }
    if (solBalance < lamports + GAS_RESERVE) {
      const short = lamports + GAS_RESERVE - solBalance;
      setTxError({
        title: "Not enough SOL in your wallet",
        body: [
          `You're trying to deposit ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`,
          `Solana also needs ~0.003 SOL for network fees + ATA rent.`,
          ``,
          `Your wallet has: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
          `You need at least: ${((lamports + GAS_RESERVE) / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
          `Short by: ${(short / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
          ``,
          "Top up your wallet a bit and try again — or deposit a smaller amount.",
        ].join("\n"),
      });
      return;
    }

    setTxPending(true);
    let sig = "";
    try {
      const tx = await buildDepositTransaction(connection, publicKey, lamports);
      const r = await sendAndConfirmWithRebroadcast(connection, tx, {
        sendTransaction,
        signTransaction,
      });
      sig = r.sig;
      if (r.ok) {
        setTxResult({ sig, type: "deposit" });
        setAmount("");
        refresh();
      } else if (r.pending) {
        setTxError(translateTxError("not confirmed in 90s", { flow: "deposit", sig }));
      } else {
        setTxError(translateTxError(r.err, { flow: "deposit", sig }));
      }
    } catch (e: unknown) {
      setTxError(translateTxError(e, { flow: "deposit", sig }));
    } finally {
      setTxPending(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    setTxError(null);
    setTxResult(null);

    if (!publicKey) return;
    if (!position) {
      setTxError({
        title: "No deposit found on this wallet",
        body: "We don't see an LP position for this wallet on-chain. Either you've never deposited from this wallet, or you're connected with a different one. Switch wallets in your adapter and try again.",
      });
      return;
    }
    // Stale-pool guard: if `pool` isn't the active position's pool yet (e.g.
    // just after switching the pool tab, before refresh() reloads), NEVER
    // compute shares from the wrong pool's ratio. Refresh + ask to retry.
    if (!pool || pool.version !== activeVersion) {
      setTxError({ title: "One moment", body: "Loading this pool's live data — try again in a second." });
      refresh();
      return;
    }
    if (!amount) return;

    // Source of truth: if Max was clicked, use the captured exact lamport
    // value (which equals position.currentValue). Otherwise parse the typed
    // string. Either way, the final value below is hard-clamped to the
    // actual on-chain position so we can NEVER request more than exists.
    let lamportsRequested = maxLamports !== null
      ? maxLamports
      : Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamportsRequested <= 0 || !pool) return;

    // Preflight: are they trying to withdraw substantially more than they own?
    // Tolerance covers normal display rounding (4-decimal SOL display can be
    // off by up to ~50,000 lamports). Anything within 0.001 SOL above the
    // actual position is silently clamped to currentValue (covered by the
    // hard clamp below). Anything further is a real mistake — show the error.
    const currentValue = position.currentValue;
    const ROUNDING_TOLERANCE = 1_000_000; // 0.001 SOL
    if (lamportsRequested > currentValue + ROUNDING_TOLERANCE) {
      setTxError({
        title: "Withdrawal exceeds your position",
        body: [
          `You're trying to withdraw ${(lamportsRequested / LAMPORTS_PER_SOL).toFixed(4)} SOL,`,
          `but your position is currently worth ${(currentValue / LAMPORTS_PER_SOL).toFixed(4)} SOL.`,
          ``,
          "Use Max, or lower the amount.",
        ].join("\n"),
      });
      return;
    }
    // Hard clamp — final defense. Even if every other check is bypassed, the
    // submitted amount can never exceed the user's actual on-chain position.
    if (lamportsRequested > currentValue) lamportsRequested = currentValue;

    // Preflight: gas reserve check
    const GAS_RESERVE = Math.floor(0.003 * LAMPORTS_PER_SOL);
    if (solBalance < GAS_RESERVE) {
      setTxError({
        title: "Wallet doesn't have SOL for network fees",
        body: `Withdrawing still costs ~0.003 SOL for the transaction. Your wallet has ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL — send a bit more and retry.`,
      });
      return;
    }

    const sharesRequested = pool.totalDeposits > 0
      ? Math.floor((lamportsRequested * pool.totalShares) / pool.totalDeposits)
      : 0;
    if (sharesRequested <= 0) {
      setTxError({
        title: "Amount too small",
        body: "Try a slightly larger amount — this comes out to zero shares against the current pool size.",
      });
      return;
    }

    // Plan the chunking: each chunk's shares × current depositedAmount must
    // stay under the program's u64 overflow ceiling. computeMaxSafeWithdrawShares
    // returns the per-tx ceiling; we cap each chunk to that. After each chunk
    // lands, depositedAmount shrinks proportionally so the ceiling rises — most
    // positions clear in 1-6 sequential chunks.
    setTxPending(true);
    setChunkProgress(null);
    let lastSig = "";
    try {
      let remainingShares = BigInt(sharesRequested);
      let currentDepositedAmount = position.depositedAmount;
      let chunkStep = 0;
      // Estimate total chunks for the UI based on initial state. The real count
      // may differ by ±1 because depositedAmount shrinks each iteration.
      let estimatedTotal = 1;
      {
        const initialSafeMax = computeMaxSafeWithdrawShares(currentDepositedAmount, activeVersion);
        if (initialSafeMax > 0n && remainingShares > initialSafeMax) {
          const chunks = Math.ceil(Number(remainingShares) / Number(initialSafeMax));
          // Chunks are packed MAX_WITHDRAW_IXS_PER_TX at a time into ONE tx = one
          // approval, so the approval count is chunks / ixs-per-tx (rounded up).
          estimatedTotal = Math.max(1, Math.ceil(chunks / MAX_WITHDRAW_IXS_PER_TX));
        }
      }
      let lamportsDone = 0;

      while (remainingShares > 0n) {
        chunkStep++;
        const safeMaxShares = computeMaxSafeWithdrawShares(currentDepositedAmount, activeVersion);
        // Pack up to MAX_WITHDRAW_IXS_PER_TX chunks into ONE transaction = ONE
        // wallet approval (instead of one approval per chunk — which ballooned to
        // hundreds for large positions). Each chunk stays under the per-tx overflow
        // ceiling; deposited_amount only shrinks as the bundled ixs execute, so if
        // the first chunk is safe every later one is too. Total shares in the pool
        // is well under 2^53, so Number() on each chunk is exact.
        const bundle: number[] = [];
        let bundleShares = 0n;
        for (let i = 0; i < MAX_WITHDRAW_IXS_PER_TX; i++) {
          const left = remainingShares - bundleShares;
          if (left <= 0n) break;
          const thisChunk = safeMaxShares > 0n && left > safeMaxShares ? safeMaxShares : left;
          bundle.push(Number(thisChunk));
          bundleShares += thisChunk;
        }

        setChunkProgress({ step: chunkStep, total: Math.max(estimatedTotal, chunkStep), lamportsDone });

        const tx = await buildWithdrawBundleTransaction(connection, publicKey, bundle, activeVersion);
        const r = await sendAndConfirmWithRebroadcast(connection, tx, {
          sendTransaction,
          signTransaction,
        });
        lastSig = r.sig;
        if (!r.ok) {
          if (r.pending) {
            setTxError(translateTxError("not confirmed in 90s", { flow: "withdraw", sig: lastSig }));
          } else {
            setTxError(translateTxError(r.err, { flow: "withdraw", sig: lastSig }));
          }
          // If at least one bundle landed, surface that explicitly so the user
          // knows partial funds arrived before the failure.
          if (chunkStep > 1) {
            setTxResult({ sig: lastSig, type: "withdraw" });
          }
          return;
        }

        remainingShares -= bundleShares;
        lamportsDone += Math.floor((Number(bundleShares) * pool.totalDeposits) / pool.totalShares);

        // Re-read position so the next iteration uses fresh depositedAmount.
        // If lookup fails, fall back to a proportional estimate (worst case
        // is we use a smaller chunk next round — still safe, never overflows).
        if (remainingShares > 0n) {
          try {
            const fresh = await fetchDepositorPositionForVersion(connection, publicKey, activeVersion);
            if (fresh && fresh.depositedAmount > 0) {
              currentDepositedAmount = fresh.depositedAmount;
            } else {
              // No position left — we've withdrawn everything. Done.
              break;
            }
          } catch {
            // Proportional estimate: deposit shrinks by the bundle's share fraction
            const fraction = Number(bundleShares) / sharesRequested;
            currentDepositedAmount = Math.floor(currentDepositedAmount * (1 - fraction));
          }
        }
      }

      setTxResult({ sig: lastSig, type: "withdraw" });
      setAmount("");
      setMaxLamports(null);
      refresh();
    } catch (e: unknown) {
      setTxError(translateTxError(e, { flow: "withdraw", sig: lastSig }));
    } finally {
      setTxPending(false);
      setChunkProgress(null);
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
          onClick={() => { setTab(t); setAmount(""); setMaxLamports(null); setTxError(null); setTxResult(null); }}
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
            // Capture the EXACT lamport amount so submit can use it directly,
            // bypassing the lossy SOL→string→SOL conversion entirely. The
            // display string is just for visual feedback — never the source
            // of truth for the on-chain amount.
            setMaxLamports(max);
            const displayed = Math.floor(max / 1e5) / 1e4;
            setAmount(displayed.toFixed(4));
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
        onChange={(e) => { setAmount(e.target.value); setMaxLamports(null); }}
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
      {txPending
        ? chunkProgress && chunkProgress.total > 1
          ? `Withdrawing ${chunkProgress.step} of ${chunkProgress.total}…`
          : "Confirming..."
        : tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
    </button>
  );

  const txFeedback = (
    <>
      {chunkProgress && chunkProgress.total > 1 && (
        <div className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 text-xs">
          <div className="flex items-center justify-between font-medium text-[var(--accent-deep)]">
            <span>Chunk {chunkProgress.step} of {chunkProgress.total}</span>
            <span className="tabular">{solStr(chunkProgress.lamportsDone, 4)} SOL received so far</span>
          </div>
          <p className="mt-1 leading-relaxed text-[var(--ink-soft)]">
            Large withdrawals are split into multiple transactions automatically. Keep this tab open until all chunks land.
          </p>
        </div>
      )}
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
        <div className="mt-4 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-[var(--bad)]">
            <TriangleAlertIcon className="h-4 w-4" />
            <span>{txError.title}</span>
          </div>
          <div className="mt-2 whitespace-pre-line leading-relaxed text-[var(--ink-soft)]">
            {txError.body}
          </div>
          {txError.action?.href && (
            <a
              href={txError.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-deep)] underline-offset-2 hover:underline"
            >
              {txError.action.label} →
            </a>
          )}
          <button
            onClick={() => setTxError(null)}
            className="mt-3 ml-3 inline-flex items-center gap-1 text-xs text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
          >
            Dismiss
          </button>
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
                <span>Long-term LPs also earn a Loyalty Bonus — 10% of every fee, time-weighted</span>
              </span>
              <Link
                href="/holders"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)]/30 hover:text-[var(--accent-deep)]"
              >
                <DiamondIcon className="h-3.5 w-3.5" />
                <span>Prefer to earn without depositing? Hold $MAGPIE → 70% of every fee →</span>
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
                <a href={TELEGRAM_COMMUNITY.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">community Telegram (@magpietalk)</a>
                {" "}for updates.
              </p>
            </div>
          )}

          {/* Position card */}
          <div className="mb-6 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 shadow-sm sm:p-8">
            {!connected ? (
              <div className="text-center py-6">
                {/* Live numbers up top — the actual hook. Show what depositors
                    are currently earning before asking the visitor to connect. */}
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)] mb-1">
                  Pool yield right now
                </p>
                <p className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                  {lpApy !== null ? `${lpApy.toFixed(2)}%` : "—"}
                  <span className="ml-1.5 text-lg text-[var(--ink-soft)]">APY</span>
                </p>
                {lpApy === null && (
                  <p className="mt-1 text-xs text-[var(--ink-faint)]">
                    APY finalizes after the first full week of fees
                  </p>
                )}

                {/* Concrete trust signals: TVL + recent fees. Both come from
                    on-chain + bot API and are present even when disconnected. */}
                {pool && (
                  <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                    {/* Pool TVL is a trust signal only when it reads as one. A
                        small instantaneous balance understates the pool — it
                        swings with a single deposit or withdrawal and says
                        nothing about track record. Below the threshold we show
                        LIFETIME FEES instead, which is the more honest signal
                        of whether this pool actually does anything: it only
                        goes up, and it is earned rather than parked.
                        Tune with NEXT_PUBLIC_TVL_DISPLAY_MIN_SOL. */}
                    {pool.totalDeposits >= TVL_DISPLAY_MIN_SOL * LAMPORTS_PER_SOL ? (
                      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Pool TVL</div>
                        <div className="mt-0.5 font-mono text-base text-[var(--ink)]">
                          {solStr(pool.totalDeposits, 2)} SOL
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Fees · lifetime</div>
                        <div className="mt-0.5 font-mono text-base text-[var(--ink)]">
                          {poolApi?.fees?.lifetime_lamports
                            ? `${solStr(Number(poolApi.fees.lifetime_lamports), 1)} SOL`
                            : "—"}
                        </div>
                      </div>
                    )}
                    <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Fees · last 7d</div>
                      <div className="mt-0.5 font-mono text-base text-[var(--ink)]">
                        {poolApi?.fees
                          ? `${solStr(Number(poolApi.fees.last_7d_lamports), 3)} SOL`
                          : "—"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-dim)]">
                  <svg className="h-5 w-5 text-[var(--accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--ink)]">Connect your wallet to deposit</p>
                <p className="text-xs text-[var(--ink-faint)]">Withdraw anytime · no lockup · yield auto-compounds</p>
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
                  {position && (() => {
                    // Hide rounding noise: anything under 0.0001 SOL renders as
                    // "0.0000" and looks like a bug ("-0.000 SOL earned"). Show
                    // a meaningful status instead while waiting for fees to
                    // accrue past the display threshold.
                    const MIN_DISPLAY_LAMPORTS = 100_000; // 0.0001 SOL
                    if (Math.abs(position.yieldEarned) < MIN_DISPLAY_LAMPORTS) {
                      return (
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          Yield finalizes at the next pool snapshot
                        </p>
                      );
                    }
                    return (
                      <p className={`mt-1 text-sm font-medium ${position.yieldEarned > 0 ? "text-[var(--accent-deep)]" : "text-[var(--bad)]"}`}>
                        {position.yieldEarned > 0 ? "+" : ""}{solStr(position.yieldEarned)} SOL earned
                      </p>
                    );
                  })()}
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
              Per MGP-001 (ratified 2026-06-13), LPs receive <span className="font-semibold text-[var(--ink)]">the 10% LP loyalty slice</span> of every loan fee. Distributed on the same 5–10 day random snapshot cadence as $MAGPIE holder rewards, allocated by <span className="font-mono text-xs">shares × time held</span> — longer-tenured LPs get a bigger slice.
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
              <a href={TELEGRAM_COMMUNITY.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">community Telegram (@magpietalk)</a>
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
                {tab === "deposit" && depositPool && amount && parseFloat(amount) > 0 && (
                  <div className="mb-4 rounded-xl border border-[var(--hairline)] p-3 text-xs space-y-1.5">
                    <InfoRow label="You deposit" value={`${parseFloat(amount).toFixed(4)} SOL`} />
                    <InfoRow
                      label="Pool share"
                      value={depositPool.totalDeposits > 0
                        ? pct(parseFloat(amount) * LAMPORTS_PER_SOL / (depositPool.totalDeposits + parseFloat(amount) * LAMPORTS_PER_SOL), 2)
                        : "100%"}
                    />
                    <InfoRow label="Yield source" value="Borrower loan fees" />
                    <InfoRow label="Pool" value="V4 flagship (in-vault)" />
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
              {connected && positions.length > 0 && (
                <div className="mb-3">
                  {positions.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {positions.map((p) => (
                        <button
                          key={p.version}
                          type="button"
                          onClick={() => {
                            // Reset the form so a stale amount/maxLamports from
                            // the previous pool can't be submitted against the
                            // new one before refresh() reloads pool/position.
                            setActiveVersion(p.version);
                            setAmount("");
                            setMaxLamports(null);
                            setTxError(null);
                            setTxResult(null);
                          }}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            p.version === activeVersion
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-deep)]"
                              : "border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--accent)]"
                          }`}
                        >
                          {versionLabel(p.version)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-[var(--hairline)] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]">
                      Pool: {versionLabel(activeVersion)}
                    </span>
                  )}
                  {(activeVersion === "v1" || activeVersion === "v2" || activeVersion === "v3") && (
                    <p className="mt-2 text-xs text-[var(--ink-faint)]">
                      Your {versionLabel(activeVersion)} deposit is safe and fully withdrawable anytime. New deposits now flow to the V4.1 flagship pool — the Sec3-audited program — and your existing position is unaffected.
                    </p>
                  )}
                </div>
              )}
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
                  Loan events flowing through the pool. Per MGP-001, 10% of each fee is earmarked for LP loyalty distribution.
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
                Per MGP-001, LPs receive <span className="font-semibold text-[var(--ink)]">the 10% LP loyalty share</span> of every loan fee. Distributed periodically (random 5–10 day cadence), allocated by <span className="font-mono text-xs">shares × time held</span> so longer-tenured LPs get a bigger slice.
              </p>

              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] overflow-hidden">
                <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-[var(--hairline)] bg-[var(--surface)] px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <div>Tier</div>
                  <div className="text-right">Borrower fee</div>
                  <div className="text-right">Your LP loyalty share</div>
                </div>
                {[
                  { tier: "Memecoin Express · 30% LTV · 2d",  fee: "3.00%", lp: "0.300%" },
                  { tier: "Memecoin Quick · 25% LTV · 3d",    fee: "2.00%", lp: "0.200%" },
                  { tier: "Memecoin Standard · 20% LTV · 7d", fee: "1.50%", lp: "0.150%" },
                  { tier: "RWA Express · 50% LTV · 7d (v3)",  fee: "2.50%", lp: "0.250%" },
                  { tier: "RWA Quick · 60% LTV · 15d (v3)",   fee: "3.50%", lp: "0.350%" },
                  { tier: "RWA Standard · 70% LTV · 30d (v3)", fee: "5.00%", lp: "0.500%" },
                ].map((row) => (
                  <div key={row.tier} className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-[var(--hairline)] px-2 sm:px-3 py-2 text-xs last:border-b-0">
                    <div className="text-[var(--ink-soft)]">{row.tier}</div>
                    <div className="text-right text-[var(--ink-soft)]">{row.fee}</div>
                    <div className="text-right font-semibold text-[var(--accent-deep)]">{row.lp}</div>
                  </div>
                ))}
              </div>

              <ul className="mt-4 space-y-2 text-[12px] text-[var(--ink-soft)]">
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> No lock-up — withdraw any time (subject to available liquidity)</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Yield is variable, paid in SOL on the snapshot cadence</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Longer-tenured LPs earn proportionally more (shares × time held)</li>
                <li className="flex gap-2"><span className="text-[var(--accent-deep)]">✓</span> Permissionless and on-chain — no off-chain rewards program, no claim step</li>
              </ul>
            </div>

            {/* How it works (mechanics) */}
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
              <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">How it works</h3>
              <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
                <HowStep n={1} text="Deposit SOL into the lending pool — you receive shares proportional to your stake" />
                <HowStep n={2} text="Borrowers take loans against approved collateral (memecoins on v1: 1.5–3% fee; RWA on v3: 2.5–5% fee)" />
                <HowStep n={3} text="Per MGP-001, every loan fee splits 70/10/10/10: 70% to $MAGPIE holders, 10% to LP loyalty (you), 10% to referrer, 10% to protocol reserve" />
                <HowStep n={4} text="Withdraw your principal any time; LP loyalty SOL pays out automatically on the snapshot cadence" />
              </ol>
            </div>

            {/* Yield mechanics — detailed explainer */}
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 shadow-sm sm:p-6">
              <h3 className="font-display text-base font-semibold mb-3 sm:text-lg sm:mb-4">How LP yield works in detail</h3>
              <div className="space-y-3 text-sm text-[var(--ink-soft)]">
                <p>
                  Every loan fee routes 70/10/10/10 to holders / LP loyalty / referrers / reserve (MGP-001), so share value tracks principal. Your yield is the <span className="font-semibold text-[var(--ink)]">10% LP loyalty payout</span> — SOL, snapshot-based.
                </p>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-[12px] text-[var(--ink)] sm:text-[13px]">
                  withdraw = your_shares × (current_vault_balance / total_shares)
                  <br/>
                  loyalty_payout = (your_shares × seconds_held / community_share_seconds) × loyalty_pool
                </div>
                <p>
                  Withdrawals are still instant and pro-rata — you can exit any time the vault has liquidity. The LP loyalty payout pays separately on the same random 5–10 day cadence as $MAGPIE holder distributions, weighted by <span className="font-mono text-[12px]">shares × time held</span> so long-tenured LPs earn proportionally more. The protocol&apos;s own seed liquidity is <span className="font-semibold text-[var(--ink)]">fully excluded</span> from the calculation — it earns no LP fees, so the entire 10% pool is split among community LP providers.
                </p>

                <h4 className="font-semibold pt-2 text-[var(--ink)]">Concrete example (post-MGP-001 model)</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="text-[var(--ink)]">Day 1.</span> Alice deposits 10 SOL when the vault is empty. She gets 10 shares.
                  </li>
                  <li>
                    <span className="text-[var(--ink)]">Day 10.</span> Bob deposits 5 SOL. He gets 5 shares. Vault = 15 SOL across 15 shares (share value still 1.00 SOL — no in-pool interest accrual under MGP-001).
                  </li>
                  <li>
                    <span className="text-[var(--ink)]">Day 30.</span> Across the period, fees totalling 30 SOL flow through the protocol. 3 SOL (the 10% LP loyalty slice) goes into the LP loyalty pool.
                  </li>
                  <li>
                    <span className="text-[var(--ink)]">Snapshot fires.</span> Alice held 10 shares for 30 days = 300 share-days. Bob held 5 shares for 20 days = 100 share-days. Total = 400 share-days. Alice gets 3 × (300/400) = 2.25 SOL. Bob gets 3 × (100/400) = 0.75 SOL.
                  </li>
                  <li>
                    <span className="text-[var(--ink)]">Anytime.</span> Either can withdraw their principal (Alice 10 SOL, Bob 5 SOL) by redeeming shares against the vault. The LP loyalty SOL lands separately at the snapshot.
                  </li>
                </ul>
                <p>
                  Longer-tenured LPs earn more: payouts weight shares × time held, not share-price growth (per MGP-001).
                </p>
              </div>
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
