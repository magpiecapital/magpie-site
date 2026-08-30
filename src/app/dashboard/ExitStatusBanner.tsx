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
import { formatUsd } from "@/lib/format-price";
import { useWallet } from "@solana/wallet-adapter-react";
import { armTakeProfit } from "@/lib/solana/site-take-profit";
import type {
  TakeProfitLoan,
  TakeProfitOrder,
  TakeProfitPendingIntent,
  PendingArm,
} from "@/lib/solana/site-take-profit";

// V4 program id. The dashboard reads loan.program_id from the bot's
// site-limit-close response; V4 loans are the ones where the user
// MUST have requested an exit (V4 is exit-only). When such a loan
// has zero orders, that's a SILENT auto-arm failure, not an empty
// state — operator rule feedback_v4_loans_never_show_exit_not_set.md.
const PROGRAM_ID_V4 =
  process.env.NEXT_PUBLIC_PROGRAM_ID_V4 ||
  "HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo";
// V4.1 — memecoin exit lane (audited build). Same "must have an exit" rule.
const PROGRAM_ID_V4_1 = process.env.NEXT_PUBLIC_PROGRAM_ID_V4_1 || null;

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
  /** Tier-2: in-flight pending_arms for THIS wallet. When a pending_arm
   *  exists for this loan, the banner renders "Arming…" instead of
   *  silent-arm-failure recovery. The server's background watcher will
   *  replay every 10s while the user's signature stays fresh (5 min).
   *  See feedback_loan_830_full_postmortem_and_defenses.md (defense C). */
  pendingArms?: PendingArm[];
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
  pendingArms,
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
  const isV4Loan =
    loan?.program_id === PROGRAM_ID_V4 ||
    (!!PROGRAM_ID_V4_1 && loan?.program_id === PROGRAM_ID_V4_1);
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

  // Tier-2 architectural fix (defense C in
  // feedback_loan_830_full_postmortem_and_defenses.md): a pending_arm
  // row for this loan_id_chain means the user's signed envelope is
  // still inside the 5-min freshness window and the background
  // watcher is replaying every 10s. Show a calm "Arming…" pill, NOT
  // the recovery banner. The dashboard will flip to the normal
  // armed state automatically once the watcher's next replay lands.
  const pendingArmForLoan = (pendingArms || []).find(
    (pa) => pa.loan_id_chain === loanIdChain && pa.status === "pending" && pa.seconds_remaining > 0,
  );
  if (isV4Loan && state?.kind === "no_exit_set" && pendingArmForLoan) {
    return (
      <PendingArmBanner
        symbol={collateralSymbol}
        nLegs={Array.isArray(pendingArmForLoan.legs) ? pendingArmForLoan.legs.length : 0}
        secondsRemaining={pendingArmForLoan.seconds_remaining}
      />
    );
  }

  if (isSilentArmFailure && botApiUrl && loanIdChain) {
    // Filter the wallet's pending_intents down to ones for THIS loan
    // AND dedupe by (direction, target_kind, target_value_micro,
    // slice_pct_bps). Repeated user retries before today's server-side
    // dedupe could pile up duplicate rows in arm_intents; the banner
    // must NEVER show duplicates of the same strike+slice — operator
    // saw "4 auto-sells didn't finish arming" with two pairs of
    // identical buttons on SPCX loan 816 (2026-06-17 03:50 UTC).
    // See feedback_no_duplicate_intents_in_recovery_banner_NEVER.md.
    // Keep the MOST RECENT intent of each unique strike+slice group.
    const intentsForLoan = (pendingIntents || []).filter(
      (i) => i.loan_id_chain === loanIdChain,
    );
    const dedupedByStrike = new Map<string, typeof intentsForLoan[number]>();
    for (const i of intentsForLoan) {
      const key = `${i.direction}|${i.target_kind}|${i.target_value_micro}|${i.slice_pct_bps ?? "null"}`;
      const existing = dedupedByStrike.get(key);
      if (!existing || new Date(i.created_at).getTime() > new Date(existing.created_at).getTime()) {
        dedupedByStrike.set(key, i);
      }
    }
    const uniqueIntents = Array.from(dedupedByStrike.values());
    return (
      <V4SilentArmRecoveryBanner
        symbol={collateralSymbol}
        botApiUrl={botApiUrl}
        loanIdChain={loanIdChain}
        intentsForLoan={uniqueIntents}
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

  // Always-prominent balance display. Operator-mandated 2026-06-17 PM
  // (feedback_loan_card_current_value_must_be_prominent.md): the current
  // value of the loan (remaining collateral + accumulated SOL in the
  // V4 vault) MUST appear as the headline of every loan card, regardless
  // of fire state. Previously this only kicked in on partial/complete;
  // for armed/firing/no_exit_set we showed a compact pill that buried
  // the position size. Operator: "we need to do a much better job
  // displaying that current value inside the loan."
  //
  // The vault balance comes from state (when it includes vaultLamports
  // — partial/complete) or from loan.sol_proceeds_amount otherwise.
  // Remaining collateral is read from loan.current_collateral_amount via
  // formatRemainingToken.
  const vaultLamports: bigint = vaultLamportsFor(state, loan);
  const sol = lamportsToSolStr(vaultLamports);
  const hasVault = vaultLamports > 0n;
  let positionParts = formatPositionParts(loan, sym);
  // Fully-sold V4 position: when ALL collateral has been converted
  // (current_collateral_amount explicitly "0") and the vault holds
  // proceeds, synthesize a "0 TICKER" part so this "IN VAULT" banner
  // matches the main loan card's "0 ANSEM + X SOL vault" EXACTLY
  // (operator 2026-06-28, protocol uniformity for all V4). Only for an
  // explicit on-chain zero — a null (pre-remainder-watcher) loan still
  // omits the token part to avoid a misleading zero.
  if (
    !positionParts &&
    hasVault &&
    String(loan?.current_collateral_amount ?? "") === "0"
  ) {
    positionParts = { amount: "0", ticker: symbol || "TOKEN" };
  }
  const hasPosition = !!positionParts;

  // Status line below the headline varies by state. Keeps the visual
  // color (via visualForState) and the pulse animation on for armed/
  // firing so the user can still tell at a glance what the loan is
  // doing — the prominent numbers carry the "current value" weight,
  // the status line carries the "what stage" weight.
  let statusLine: string;
  let headlineLabel: string;
  switch (state?.kind) {
    case "no_exit_set":
      headlineLabel = "Position";
      statusLine = `No exits set — ${sym} loan position`;
      break;
    case "armed":
      headlineLabel = "Position";
      statusLine =
        state.legs.length === 1
          ? "1 leg armed · waiting for trigger"
          : `${state.legs.length} legs armed · waiting for triggers`;
      break;
    case "firing":
      headlineLabel = "Firing";
      statusLine = `${state.inFlightCount} of ${state.totalCount} leg${state.totalCount === 1 ? "" : "s"} firing now`;
      break;
    case "partial":
      headlineLabel = "In vault";
      statusLine = `${state.firedCount} of ${state.totalCount} legs filled`;
      break;
    case "complete":
      headlineLabel = "In vault";
      statusLine = `All ${state.firedCount} legs filled · ready to close`;
      break;
    default:
      headlineLabel = "Position";
      statusLine = "";
  }

  return (
    <div
      className="rounded-lg border px-3.5 py-3 sm:px-4 sm:py-3.5"
      style={{
        borderColor: visual.border,
        background: visual.bg,
        color: visual.text,
      }}
      role="status"
      aria-live="polite"
    >
      {/* Top row: state chip (dot + label) + refresh action. */}
      <div className="flex items-center justify-between gap-3">
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
          <span
            className="text-[10px] uppercase tracking-[0.08em] font-semibold opacity-60"
            style={{ color: visual.text }}
          >
            {headlineLabel}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-[10px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: visual.text }}
            title="Refresh state"
            aria-label="Refresh loan state"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Headline: current value of the loan, ALWAYS shown.
       *  Each value is a {big number} + {small ticker/unit} pair so
       *  collateral and vault SOL share the same typography. A single
       *  middle-dot separator (text on the same baseline) keeps the
       *  line readable on phones at narrow widths. `min-w-0` + flex
       *  `flex-wrap` allows graceful wrap on very small screens
       *  without breaking the big-number rhythm. */}
      <div
        className="mt-2 flex items-baseline gap-x-2 gap-y-1 flex-wrap"
        style={{ color: visual.text }}
      >
        {hasPosition && positionParts && (
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span
              className="font-bold tracking-tight text-[24px] sm:text-[28px] leading-none tabular-nums"
              style={{ color: visual.text }}
            >
              {positionParts.amount}
            </span>
            <span
              className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider opacity-60 truncate max-w-[6.5rem]"
              style={{ color: visual.text }}
            >
              {positionParts.ticker}
            </span>
          </span>
        )}
        {hasPosition && hasVault && (
          <span
            aria-hidden
            className="text-[18px] leading-none opacity-30 select-none -mx-0.5"
            style={{ color: visual.text }}
          >
            ·
          </span>
        )}
        {hasVault && (
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span
              className={
                hasPosition
                  ? "text-[18px] sm:text-[20px] font-bold tracking-tight leading-none tabular-nums opacity-95"
                  : "text-[24px] sm:text-[28px] font-bold tracking-tight leading-none tabular-nums"
              }
              style={{ color: visual.text }}
            >
              {sol}
            </span>
            <span
              className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider opacity-60"
              style={{ color: visual.text }}
            >
              SOL
            </span>
          </span>
        )}
        {/* Empty-state fallback: no collateral, no vault. Render a
         *  neutral em-dash so the headline never collapses to 0px tall. */}
        {!hasPosition && !hasVault && (
          <span
            className="font-bold tracking-tight text-[24px] sm:text-[28px] leading-none tabular-nums opacity-40"
            style={{ color: visual.text }}
          >
            —
          </span>
        )}
      </div>

      {/* Status line: what stage the loan is in. The headline already
       *  carries the position weight; this line carries the action
       *  weight (Armed / Firing / Filled / Ready to close). */}
      {statusLine && (
        <div
          className="mt-1.5 text-[11.5px] sm:text-[12px] leading-relaxed opacity-65"
          style={{ color: visual.text }}
        >
          {statusLine}
        </div>
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
  // 'partial_fired' IS a fired leg (audit 2026-06-28 P1 #3 + P3 #17): a TWAP/
  // chunked exit that sold SOME collateral into the vault lands in
  // 'partial_fired'. Excluding it (a) dropped the order so the banner read
  // "No exit set" despite real vault proceeds, and (b) under-counted fired
  // legs in the "M of N legs filled" ladder rollup. Its proceeds_lamports is
  // populated, so the vault reductions below sum it correctly.
  const fired = loanOrders.filter(
    (o) => o.status === "fired" || o.status === "partial_fired",
  );
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

/* The authoritative "accumulated SOL in the V4 vault" figure for a loan,
 * used by EVERY V4 surface so they all agree (operator 2026-06-28: "make
 * sure this reflects on the display properly across the protocol for all
 * V4"). Prefers the loan mirror (loan.sol_proceeds_amount) — synced from
 * ON-CHAIN truth by the engine's post-fire write + the bot reconciler, so
 * it is authoritative — over state.vaultLamports, which is summed from
 * per-order proceeds_lamports and can read 0 when an order record lagged
 * its loan-mirror write. Takes the larger so "IN VAULT" never shows a
 * stale 0 / em-dash after a fire. */
function vaultLamportsFor(
  state: ExitState | null,
  loan: TakeProfitLoan | null,
): bigint {
  const fromState =
    state && (state.kind === "partial" || state.kind === "complete")
      ? state.vaultLamports
      : 0n;
  const fromLoanMirror = BigInt(loan?.sol_proceeds_amount ?? "0");
  return fromLoanMirror > fromState ? fromLoanMirror : fromState;
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
    const sol = lamportsToSolStr(vaultLamportsFor(state, loan));
    const remaining = formatRemainingToken(loan, symbol);
    return `${state.firedCount} of ${state.totalCount} legs filled · ${sol} SOL in vault${
      remaining ? ` + ${remaining}` : ""
    }`;
  }
  // complete
  const sol = lamportsToSolStr(vaultLamportsFor(state, loan));
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

/* Structured variant of formatRemainingToken used by the prominent
 * loan-card headline (feedback_loan_card_current_value_must_be_prominent.md).
 * Splitting the number from the ticker lets the headline render them
 * with consistent typography against the SOL pair beside it (big number
 * + small ticker / unit label). Returns null when the loan has no
 * usable remaining collateral. */
function formatPositionParts(
  loan: TakeProfitLoan | null,
  symbol: string,
): { amount: string; ticker: string } | null {
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
  return { amount: formatted, ticker: symbol || "TOKEN" };
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
    return formatUsd(usd);
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
/* ────────────────────────────────────────────────────────────────
 * PendingArmBanner — calm "Arming…" pill rendered when the server
 * has a pending_arm row for this loan. The user's signed envelope is
 * still fresh and the background watcher is replaying every 10s.
 * Distinguishes the in-flight race from a true silent-arm failure
 * so the user doesn't see a confusing red banner during the normal
 * cosign-borrow → arm-batch handoff.
 *
 * Tier-2 architectural defense per
 * [[feedback_loan_830_full_postmortem_and_defenses]] (defense C).
 * ──────────────────────────────────────────────────────────────── */
function PendingArmBanner({
  symbol,
  nLegs,
  secondsRemaining,
}: {
  symbol: string | null;
  nLegs: number;
  secondsRemaining: number;
}) {
  const sym = symbol || "loan";
  const remaining = Math.max(0, Math.min(300, secondsRemaining));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const remainingStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{
        background: "rgba(59, 130, 246, 0.08)",
        borderColor: "rgba(59, 130, 246, 0.45)",
        color: "var(--d-ink)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold">
            Arming {nLegs} {nLegs === 1 ? "auto-sell" : "auto-sells"} on {sym}…
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">
            Your signed request is waiting on the borrow to finish landing on-chain.
            We&apos;ll retry automatically every 10 seconds — no re-signing needed.
            Auto-cancels in {remainingStr} if it doesn&apos;t land.
          </div>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0"
          style={{ background: "rgba(59, 130, 246, 0.9)" }}
        />
      </div>
    </div>
  );
}

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
        formatUsd(v);
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
