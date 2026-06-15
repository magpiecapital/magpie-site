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

import { useMemo } from "react";
import type {
  TakeProfitLoan,
  TakeProfitOrder,
} from "@/lib/solana/site-take-profit";

interface Props {
  orders: TakeProfitOrder[];
  loan: TakeProfitLoan | null;
  loanDbId: number;
  collateralSymbol: string | null;
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
  onRefresh,
}: Props) {
  const state = useMemo<ExitState | null>(
    () => computeExitState(orders, loanDbId),
    [orders, loanDbId],
  );

  // Loans that aren't eligible for auto-sell skip the banner — the
  // existing ineligibility text in LimitSlot handles those cases.
  if (!loan) return null;
  const eligibleForAny =
    loan.is_eligible_for_takeprofit || (loan.is_eligible_for_stoploss ?? false);
  if (state == null && !eligibleForAny) return null;

  return (
    <BannerShell state={state} symbol={collateralSymbol} onRefresh={onRefresh} />
  );
}

function BannerShell({
  state,
  symbol,
  onRefresh,
}: {
  state: ExitState | null;
  symbol: string | null;
  onRefresh?: () => void;
}) {
  const sym = symbol || "loan";
  const visual = visualForState(state);
  const message = messageForState(state, sym);

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
  const loanOrders = orders.filter((o) => o.loan_id === loanDbId);
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

function messageForState(state: ExitState | null, symbol: string): string {
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
    return `${state.firedCount} of ${state.totalCount} legs filled · ${sol} SOL in vault`;
  }
  // complete
  const sol = lamportsToSolStr(state.vaultLamports);
  return `All ${state.firedCount} legs filled · ${sol} SOL in vault · ready to close`;
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
