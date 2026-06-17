/**
 * ExitStatusBanner — top-of-card status pill on every loan that can
 * carry an auto-sell. Closes the silent-failure case: a user must
 * always know exactly where their exit stands without scrolling or
 * expanding anything.
 *
 * State machine (per loan):
 *   - no_exit_set   → amber CTA: "No exit set — Set yours now"
 *   - armed         → green: "Exit armed · N legs · next fires at $X"
 *   - firing        → amber pulse: "Exit firing now — N legs in flight"
 *   - partial       → blue: "M of N legs filled · X SOL in vault"
 *   - complete      → emerald: "All N legs filled · X SOL in vault"
 *
 * Renders nothing when the loan isn't eligible for an auto-sell
 * (ineligibility_reasons covers that path elsewhere).
 */
"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { armTakeProfit } from "@/lib/solana/site-take-profit";
import type {
  TakeProfitLoan,
  TakeProfitOrder,
  TakeProfitPendingIntent,
} from "@/lib/solana/site-take-profit";

// V4 program id. The dashboard reads loan.program_id from the bot's
// site-limit-close response; V4 loans are the ones where the user
// MUST have requested an exit (V4 is exit-only). When such a loan
// has zero orders, that's a SILENT auto-arm failure, not an empty
// state — operator rule feedback_v4_loans_never_show_exit_not_set.md.
const PROGRAM_ID_V4 =
  process.env.NEXT_PUBLIC_PROGRAM_ID_V4 ||
  "HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo";

interface Props {
  orders: TakeProfitOrder[];
  loan: TakeProfitLoan | null;
  loanDbId: number;
  collateralSymbol: string | null;
  /** Bot API url — needed for the V4 silent-arm-failure recovery
   *  retry buttons that POST armTakeProfit directly. */
  botApiUrl?: string;
  /** Chain loan_id as a string — what the arm endpoint matches on. */
  loanIdChain?: string;
  /** Pending arm intents for THIS wallet — used by the V4 recovery
   *  banner to render the EXACT user-requested strike/multiplier as
   *  the retry CTA. Falls back to 2x/3x/0.7x defaults only when no
   *  intent exists for this loan. */
  pendingIntents?: TakeProfitPendingIntent[];
  /** Optional: pass the parent's onMutated so the "Refresh" link works. */
  onRefresh?: () => void;
}

type ExitState =
  | { kind: "no_exit_set" }
  | { kind: "armed"; legs: TakeProfitOrder[]; nextLeg: TakeProfitOrder }
  | { kind: "firing"; inFlightCount: number; totalCount: number }
  | { kind: "partial"; firedCount: number; totalCount: number; vaultLamports: bigint }
  | { kind: "complete"; firedCount: number; vaultLamports: bigint };

export function ExitStatusBanner({
  orders,
  loan,
  loanDbId,
  collateralSymbol,
  botApiUrl,
  loanIdChain,
  pendingIntents,
  onRefresh,
}: Props) {
  const state = useMemo<ExitState | null>(
    () => computeExitState(orders, loanDbId),
    [orders, loanDbId],
  );

  // V4 silent-arm-failure detection (operator-mandated 2026-06-16 PM,
  // feedback_v4_loans_never_show_exit_not_set.md). A V4 loan ONLY
  // exists because the user requested exits — V4 is exit-only routing.
  // So if a V4 loan has no orders, the auto-arm flow silently failed
  // (Phantom session blip, useEffect timing race, etc.). Render a
  // loud recovery banner with one-click retry CTAs instead of the
  // generic "Exit not set" empty-CTA copy that pretends no intent
  // existed.
  const isV4Loan = loan?.program_id === PROGRAM_ID_V4;
  const isSilentArmFailure =
    isV4Loan && state?.kind === "no_exit_set" && !!botApiUrl && !!loanIdChain;

  // Loans that aren't eligible for auto-sell skip the banner — the
  // existing ineligibility text in LimitSlot handles those cases.
  if (!loan) return null;

  // V4-EXCLUSIVE POLICY (operator-mandated permanent rule): any loan
  // surfacing exits_require_v4_loan in its ineligibility reasons must
  // NOT show the "Exit not set — set one below" CTA. The whole banner
  // hides; LimitSlot's reasonToLabel will render the V4-only explainer
  // in place of the arm form. Apply to BOTH directions: if either
  // slot is V4-locked, the loan is V4-locked.
  const tpV4Locked = (loan.ineligibility_reasons ?? []).includes("exits_require_v4_loan");
  const slV4Locked = (loan.stoploss_ineligibility_reasons ?? []).includes("exits_require_v4_loan");
  if (tpV4Locked || slV4Locked) return null;

  const eligibleForAny =
    loan.is_eligible_for_takeprofit || (loan.is_eligible_for_stoploss ?? false);
  if (state == null && !eligibleForAny) return null;

  if (isSilentArmFailure && botApiUrl && loanIdChain) {
    // Filter the wallet's pending_intents down to ones for THIS loan
    // (loan_id_chain match) so the banner can render the exact strike
    // the user requested instead of generic 2x/3x/0.7x defaults.
    const intentsForLoan = (pendingIntents || []).filter(
      (i) => i.loan_id_chain === loanIdChain,
    );
    return (
      <V4SilentArmRecoveryBanner
        symbol={collateralSymbol}
        botApiUrl={botApiUrl}
        loanIdChain={loanIdChain}
        intentsForLoan={intentsForLoan}
        onMutated={onRefresh}
      />
    );
  }

  return (
    <BannerShell state={state} symbol={collateralSymbol} loan={loan} onRefresh={onRefresh} />
  );
}

function BannerShell({
  state,
  symbol,
  loan,
  onRefresh,
}: {
  state: ExitState | null;
  symbol: string | null;
  loan: TakeProfitLoan | null;
  onRefresh?: () => void;
}) {
  const sym = symbol || "loan";
  const visual = visualForState(state);

  // Operator-mandated 2026-06-16 PM
  // ([[feedback_clean_dashboard_v4_ux]]): when a loan has actually
  // fired (partial or complete), the vault balance becomes the
  // headline of the card — large, high-contrast, mobile + web parity.
  // Other states (no_exit / armed / firing) keep the original compact
  // pill rendering so the dashboard doesn't grow excessively when
  // nothing has filled yet.
  const showProminentVault = state?.kind === "partial" || state?.kind === "complete";

  if (showProminentVault) {
    const sol = lamportsToSolStr(state.vaultLamports);
    const remaining = formatRemainingToken(loan, sym);
    const fillSummary =
      state.kind === "complete"
        ? `All ${state.firedCount} legs filled`
        : `${state.firedCount} of ${state.totalCount} legs filled`;
    return (
      <div
        className="rounded-md border px-3 py-3 sm:px-4 sm:py-3.5"
        style={{
          borderColor: visual.border,
          background: visual.bg,
          color: visual.text,
        }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{
                background: visual.dot,
                animation: visual.pulse
                  ? "ladder-pulse 1.6s ease-in-out infinite"
                  : undefined,
              }}
            />
            <span
              className="text-[10px] uppercase tracking-wide font-semibold opacity-70"
              style={{ color: visual.text }}
            >
              In vault
            </span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-[10px] underline opacity-60 hover:opacity-100 flex-shrink-0"
              style={{ color: visual.text }}
              title="Refresh state"
            >
              Refresh
            </button>
          )}
        </div>
        <div
          className="mt-1.5 flex items-baseline gap-1.5 sm:gap-2 flex-wrap"
          style={{ color: visual.text }}
        >
          <span
            className="font-bold tracking-tight text-[22px] leading-none sm:text-[26px] tabular-nums transition-opacity"
            style={{ color: visual.text }}
          >
            {sol}
          </span>
          <span className="text-[13px] sm:text-[14px] font-semibold opacity-75">SOL</span>
          {remaining && (
            <>
              <span className="text-[12px] opacity-50 mx-0.5">+</span>
              <span className="text-[13px] sm:text-[14px] font-semibold opacity-85 tabular-nums">
                {remaining}
              </span>
            </>
          )}
        </div>
        <div
          className="mt-1 text-[11px] opacity-70"
          style={{ color: visual.text }}
        >
          {fillSummary}
          {state.kind === "complete" ? " · ready to close" : ""}
        </div>
      </div>
    );
  }

  // Default compact pill for no_exit / armed / firing states.
  const message = messageForState(state, sym, loan);
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
      style={{
        borderColor: visual.border,
        background: visual.bg,
        color: visual.text,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block h-2 w-2 rounded-full flex-shrink-0"
          style={{
            background: visual.dot,
            animation: visual.pulse
              ? "ladder-pulse 1.6s ease-in-out infinite"
              : undefined,
          }}
        />
        <span className="text-[12px] font-medium truncate" style={{ color: visual.text }}>
          {message}
        </span>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="text-[10px] underline opacity-60 hover:opacity-100 flex-shrink-0"
          style={{ color: visual.text }}
          title="Refresh state"
        >
          Refresh
        </button>
      )}
    </div>
  );
}

/* ─── State computation ─── */

function computeExitState(
  orders: TakeProfitOrder[],
  loanDbId: number,
): ExitState | null {
  // Number() coercion on both sides: o.loan_id is a string from the
  // API (pg bigint), loanDbId is a number. Without coercion, !==
  // always wins and the banner sees zero matching orders → would
  // wrongly say "Exit not set" even when a ladder is armed. Mirror
  // the same fix made in TakeProfitCard + LadderRollup for the
  // operator-reported 2026-06-15 "not eligible" regression.
  const loanOrders = orders.filter(
    (o) => Number(o.loan_id) === Number(loanDbId),
  );
  if (loanOrders.length === 0) {
    // No state row at all — clean slate, exit not set.
    return { kind: "no_exit_set" };
  }

  const armed = loanOrders.filter((o) => o.status === "armed");
  const inFlight = loanOrders.filter(
    (o) =>
      o.status === "firing" ||
      o.status === "twap_in_progress" ||
      o.status === "awaiting_user",
  );
  const fired = loanOrders.filter((o) => o.status === "fired");
  // Cancelled orders are ignored for status — they're terminal but
  // shouldn't make the banner say "exit not set" (the user did
  // affirmative work; cancelled state shows in the rollup).
  const activeTotal = armed.length + inFlight.length + fired.length;

  if (activeTotal === 0) {
    // Only cancelled orders remain — treat as exit-not-set so the user
    // gets the CTA again.
    return { kind: "no_exit_set" };
  }

  if (inFlight.length > 0) {
    return {
      kind: "firing",
      inFlightCount: inFlight.length,
      totalCount: activeTotal,
    };
  }

  if (fired.length > 0 && armed.length === 0) {
    // All non-cancelled legs have fired — execution complete.
    const vault = fired.reduce(
      (acc, o) => acc + BigInt(o.proceeds_lamports ?? "0"),
      0n,
    );
    return {
      kind: "complete",
      firedCount: fired.length,
      vaultLamports: vault,
    };
  }

  if (fired.length > 0 && armed.length > 0) {
    const vault = fired.reduce(
      (acc, o) => acc + BigInt(o.proceeds_lamports ?? "0"),
      0n,
    );
    return {
      kind: "partial",
      firedCount: fired.length,
      totalCount: activeTotal,
      vaultLamports: vault,
    };
  }

  // armed-only — pick the next-to-fire (closest strike to current
  // direction). TP ladders sort ascending; SL ladders sort descending.
  // We don't have current price here, so just pick the nearest-by-
  // value within each direction.
  if (armed.length > 0) {
    const nextLeg = pickNextLeg(armed);
    return {
      kind: "armed",
      legs: armed,
      nextLeg,
    };
  }

  return { kind: "no_exit_set" };
}

function pickNextLeg(armed: TakeProfitOrder[]): TakeProfitOrder {
  // TP (above): lowest trigger fires first.
  // SL (below): highest trigger fires first.
  // Mixed direction: pick the TP first (most common).
  const tp = armed.filter(
    (o) => (o.trigger_direction ?? "above") === "above",
  );
  const sl = armed.filter((o) => o.trigger_direction === "below");
  const pool = tp.length > 0 ? tp : sl;
  return pool.reduce((best, o) => {
    const isTp = (o.trigger_direction ?? "above") === "above";
    const a = BigInt(o.trigger_value_micro);
    const b = BigInt(best.trigger_value_micro);
    if (isTp) return a < b ? o : best;
    return a > b ? o : best;
  });
}

/* ─── Visual + copy ─── */

function visualForState(state: ExitState | null): {
  bg: string;
  border: string;
  text: string;
  dot: string;
  pulse: boolean;
} {
  if (!state || state.kind === "no_exit_set") {
    return {
      bg: "rgba(247, 201, 72, 0.10)",
      border: "rgba(247, 201, 72, 0.35)",
      text: "var(--d-ink)",
      dot: "rgb(247, 201, 72)",
      pulse: false,
    };
  }
  if (state.kind === "firing") {
    return {
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.35)",
      text: "var(--d-ink)",
      dot: "rgb(245, 158, 11)",
      pulse: true,
    };
  }
  if (state.kind === "armed") {
    return {
      bg: "rgba(34, 197, 94, 0.08)",
      border: "rgba(34, 197, 94, 0.30)",
      text: "var(--d-ink)",
      dot: "rgb(34, 197, 94)",
      pulse: false,
    };
  }
  // partial / complete — emerald, slightly deeper
  return {
    bg: "rgba(16, 185, 129, 0.10)",
    border: "rgba(16, 185, 129, 0.32)",
    text: "var(--d-ink)",
    dot: "rgb(16, 185, 129)",
    pulse: false,
  };
}

function messageForState(
  state: ExitState | null,
  symbol: string,
  loan: TakeProfitLoan | null,
): string {
  if (!state || state.kind === "no_exit_set") {
    return `Exit not set on this ${symbol} loan — set a take-profit or stop-loss below`;
  }
  if (state.kind === "armed") {
    const n = state.legs.length;
    const next = formatTriggerInline(
      state.nextLeg.trigger_kind,
      state.nextLeg.trigger_value_micro,
    );
    const noun = n === 1 ? "leg" : "legs";
    return `Exit armed · ${n} ${noun} · next fires at ${next}`;
  }
  if (state.kind === "firing") {
    return `Auto-sell firing now · ${state.inFlightCount} of ${state.totalCount} in flight`;
  }
  if (state.kind === "partial") {
    const sol = lamportsToSolStr(state.vaultLamports);
    const remaining = formatRemainingToken(loan, symbol);
    return `${state.firedCount} of ${state.totalCount} legs filled · ${sol} SOL in vault${
      remaining ? ` + ${remaining}` : ""
    }`;
  }
  // complete
  const sol = lamportsToSolStr(state.vaultLamports);
  const remaining = formatRemainingToken(loan, symbol);
  return `All ${state.firedCount} legs filled · ${sol} SOL in vault${
    remaining ? ` + ${remaining}` : ""
  } · ready to close`;
}

/* Format the remaining SPL collateral as "X.XX TOKEN" for the partial /
 * complete banner. Returns null when no current_collateral_amount is
 * available (pre-remainder-watcher loans) so the caller can omit the
 * "+ remaining" suffix cleanly instead of showing a misleading zero. */
function formatRemainingToken(
  loan: TakeProfitLoan | null,
  symbol: string,
): string | null {
  if (!loan) return null;
  const raw = loan.current_collateral_amount;
  if (raw == null) return null;
  const decimals = loan.collateral_decimals ?? 9;
  let amount: number;
  try {
    amount = Number(raw) / Math.pow(10, decimals);
  } catch {
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let formatted: string;
  if (amount >= 1e6) formatted = `${(amount / 1e6).toFixed(2)}M`;
  else if (amount >= 1e3) formatted = `${(amount / 1e3).toFixed(2)}K`;
  else if (amount >= 1) formatted = amount.toFixed(2);
  else if (amount >= 0.01) formatted = amount.toFixed(4);
  else formatted = amount.toFixed(6);
  return `${formatted} ${symbol || "TOKEN"} remaining`;
}

function lamportsToSolStr(lamports: bigint): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1) return sol.toFixed(3);
  if (sol >= 0.01) return sol.toFixed(4);
  return sol.toFixed(6);
}

function formatTriggerInline(kind: string, valueMicro: string): string {
  const n = Number(valueMicro);
  if (kind === "mc_usd") {
    const usd = n / 1e6;
    if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B mc`;
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M mc`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K mc`;
    return `$${usd.toFixed(2)} mc`;
  }
  if (kind === "price_usd") {
    const usd = n / 1e6;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(8)}`;
  }
  return `${(n / 1e9).toFixed(6)} SOL`;
}

/* ─── V4 silent-arm-failure recovery banner ─────────────────────────
 * Operator-mandated 2026-06-16 PM
 * (feedback_v4_loans_never_show_exit_not_set.md +
 *  feedback_tg_v4_must_match_site_quality.md). A V4 loan with no
 * orders means the auto-arm flow silently failed somewhere between
 * the post-borrow useEffect (or TG /sell, /takeprofit, /stoploss,
 * /bracket) and the bot's arm endpoint. NEVER show the generic
 * "Exit not set" copy here — render this loud recovery banner.
 *
 * INTENT-AWARE rendering (2026-06-16 PM follow-up): if the wallet
 * has recorded `arm_intents` for this loan, render one retry button
 * per intent showing the EXACT requested strike/multiplier/slice
 * the user asked for. Operator caught a 1.3x request being shown
 * as a 2x default; that mismatch is forbidden. Hardcoded 2x/3x/0.7x
 * defaults render only as a SECONDARY tier when no intent exists.
 */
function V4SilentArmRecoveryBanner({
  symbol,
  botApiUrl,
  loanIdChain,
  intentsForLoan,
  onMutated,
}: {
  symbol: string | null;
  botApiUrl: string;
  loanIdChain: string;
  intentsForLoan: TakeProfitPendingIntent[];
  onMutated?: () => void;
}) {
  const { publicKey, signMessage } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  type RetryTarget =
    | { kind: "multiplier"; multiplier: number }
    | { kind: "price_usd"; usd: number }
    | { kind: "mc_usd"; mcDollars: number };

  const retry = async (
    label: string,
    target: RetryTarget,
    direction: "above" | "below",
    sliceBps?: number,
  ) => {
    if (!publicKey || !signMessage) {
      setError("Connect your wallet to retry.");
      return;
    }
    setBusy(label);
    setError(null);
    try {
      await armTakeProfit({
        botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        request: {
          from: publicKey.toBase58(),
          loanIdChain,
          direction,
          target,
          slippageBps: direction === "below" ? 300 : 200,
          sellDestination: "sol",
          slicePctBps: sliceBps && sliceBps < 10000 ? sliceBps : undefined,
        },
      });
      onMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const sym = symbol || "this loan";
  const hasIntents = intentsForLoan.length > 0;

  // Render one button per pending intent. Format strike from the
  // intent's target_kind: multiplier → "1.3x", price_usd → "$0.0045",
  // mc_usd → "$150M mc", trailing → "trail 8%".
  const intentButtons = intentsForLoan.map((intent, idx) => {
    const v = Number(intent.target_value_micro) / 1e6;
    const sliceBps = intent.slice_pct_bps ?? 10000;
    const slicePct = sliceBps / 100;
    let label: string;
    let target: RetryTarget;
    if (intent.target_kind === "price_usd") {
      label =
        v >= 1 ? `$${v.toFixed(2)}` : v >= 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(8)}`;
      target = { kind: "price_usd", usd: v };
    } else if (intent.target_kind === "mc_usd") {
      label =
        v >= 1e9
          ? `$${(v / 1e9).toFixed(2)}B mc`
          : `$${(v / 1e6).toFixed(2)}M mc`;
      target = { kind: "mc_usd", mcDollars: v };
    } else if (intent.target_kind === "trailing") {
      // Trailing intents are SL-only; show as percentage and use the
      // existing armTakeProfit path with a multiplier shim (the engine
      // recomputes from peak). Keep this informational + best-effort.
      label = `trail ${(v).toFixed(1)}%`;
      target = { kind: "multiplier", multiplier: 1 - v / 100 };
    } else {
      // multiplier
      label = `${v}x`;
      target = { kind: "multiplier", multiplier: v };
    }
    const directionWord = intent.direction === "above" ? "Sell at" : "Stop at";
    const slicePart = sliceBps < 10000 ? ` (${slicePct.toFixed(0)}% slice)` : "";
    const buttonLabel = `${directionWord} ${label}${slicePart}`;
    const busyKey = `intent-${intent.id}-${idx}`;
    const isSl = intent.direction === "below";
    return (
      <button
        key={`intent-${intent.id}`}
        type="button"
        onClick={() => retry(busyKey, target, intent.direction, sliceBps)}
        disabled={!!busy || !publicKey}
        className="text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap disabled:opacity-50"
        style={{
          background: isSl ? "rgba(220, 38, 38, 0.12)" : "rgba(34, 197, 94, 0.15)",
          borderColor: isSl ? "rgba(220, 38, 38, 0.85)" : "rgba(34, 197, 94, 0.85)",
          color: "var(--d-ink)",
        }}
      >
        {busy === busyKey ? "Signing…" : buttonLabel}
      </button>
    );
  });

  const defaultButtons = (
    <>
      <button
        type="button"
        onClick={() => retry("2x", { kind: "multiplier", multiplier: 2 }, "above")}
        disabled={!!busy || !publicKey}
        className="text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap disabled:opacity-50"
        style={{
          background: "rgba(34, 197, 94, 0.15)",
          borderColor: "rgba(34, 197, 94, 0.55)",
          color: "var(--d-ink)",
        }}
      >
        {busy === "2x" ? "Signing…" : "Sell at 2x"}
      </button>
      <button
        type="button"
        onClick={() => retry("3x", { kind: "multiplier", multiplier: 3 }, "above")}
        disabled={!!busy || !publicKey}
        className="text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap disabled:opacity-50"
        style={{
          background: "rgba(34, 197, 94, 0.15)",
          borderColor: "rgba(34, 197, 94, 0.55)",
          color: "var(--d-ink)",
        }}
      >
        {busy === "3x" ? "Signing…" : "Sell at 3x"}
      </button>
      <button
        type="button"
        onClick={() => retry("0.7x", { kind: "multiplier", multiplier: 0.7 }, "below")}
        disabled={!!busy || !publicKey}
        className="text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap disabled:opacity-50"
        style={{
          background: "rgba(220, 38, 38, 0.12)",
          borderColor: "rgba(220, 38, 38, 0.50)",
          color: "var(--d-ink)",
        }}
      >
        {busy === "0.7x" ? "Signing…" : "Sell at 0.7x"}
      </button>
    </>
  );

  const headline = hasIntents
    ? intentsForLoan.length === 1
      ? `Your auto-sell didn't finish arming on this ${sym} loan`
      : `${intentsForLoan.length} auto-sells didn't finish arming on this ${sym} loan`
    : `Your auto-sell didn't finish arming on this ${sym} loan`;

  const subline = hasIntents
    ? "We have your exact strike on file. One click retries it without losing the original target."
    : "We routed this loan to V4 because you set up an auto-sell — the arming step didn't complete (likely a wallet session blip). Pick a quick-retry option:";

  return (
    <div
      className="rounded-md border-2 px-3 py-2.5 flex flex-col gap-2"
      style={{
        borderColor: "rgba(245, 158, 11, 0.55)",
        background: "rgba(245, 158, 11, 0.10)",
        color: "var(--d-ink)",
      }}
      role="alert"
    >
      <div className="text-[12px] font-semibold">{headline}</div>
      <div className="text-[11px] opacity-80">{subline}</div>
      <div className="flex flex-wrap gap-1.5">
        {hasIntents ? intentButtons : defaultButtons}
      </div>
      {error && (
        <div
          className="text-[10px] rounded px-1.5 py-1"
          style={{ background: "rgba(220,38,38,0.10)", color: "rgb(185, 28, 28)" }}
        >
          {error}
        </div>
      )}
      <div className="text-[10px] opacity-60">
        Or use the slot form below to set a custom strike or ladder.
      </div>
    </div>
  );
}
