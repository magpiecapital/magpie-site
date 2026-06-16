/**
 * LadderRollup — per-loan ladder leg display.
 *
 * Renders inside each active-loan card (top of TakeProfitCard) so the
 * user can see exactly what they armed and where each leg stands:
 *
 *   $SPCX ladder · target SOL
 *   ────────────────────────────────────────
 *   1   80%  →  $180.00       Filled · view tx
 *   2   20%  →  $182.00       Armed
 *
 * Status semantics:
 *   - armed                → "Armed" + neutral dot
 *   - firing | twap_in_progress | awaiting_user → "Firing…" + amber pulse
 *   - fired                → "Filled" + green check + view tx
 *   - cancelled            → "Cancelled" + gray strikethrough
 *
 * One rollup per ladder group_id. A loan with no ladder renders
 * nothing — single-strike orders still show via the existing armed
 * badge in LimitSlot.
 */
"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  armTakeProfit,
  cancelTakeProfit,
  type TakeProfitOrder,
  type TakeProfitPendingIntent,
} from "@/lib/solana/site-take-profit";

interface Props {
  orders: TakeProfitOrder[];
  loanDbId: number;
  loanIdChain?: string;
  collateralSymbol: string | null;
  /** Current USD price of the collateral — used for distance-to-fire
   *  pills. Optional; the pill simply hides if absent. */
  currentPriceUsd?: number | null;
  /** Bot API URL — needed for cancel-all + intent retry. */
  botApiUrl?: string;
  /** Pending intents for this wallet — drives intent-aware recovery
   *  banner (operator-mandated, feedback_every_arm_envelope_must_
   *  reach_server.md). Filter to this loan's chain id inside the
   *  component. */
  pendingIntents?: TakeProfitPendingIntent[];
  /** Refresh callback invoked after a cancel-all or intent retry. */
  onMutated?: () => void;
}

interface LegGroup {
  groupId: string;
  direction: "above" | "below";
  legs: TakeProfitOrder[];
}

export function LadderRollup({
  orders,
  loanDbId,
  loanIdChain,
  collateralSymbol,
  currentPriceUsd = null,
  botApiUrl,
  pendingIntents,
  onMutated,
}: Props) {
  // Find ladder orders for this loan, group by ladder_group_id +
  // direction (a loan could theoretically have both a TP ladder and an
  // SL ladder; render each separately).
  const groups = groupLadders(orders, loanDbId);
  if (groups.length === 0) return null;

  // Intent-aware recovery (operator-mandated 2026-06-16 PM,
  // feedback_every_arm_envelope_must_reach_server.md). For each ladder
  // group, find pending intents on the same direction whose strike
  // doesn't match an active order — those are silent-drop victims.
  // Filter by this loan's chain id when available.
  const intentsForLoan = (pendingIntents || []).filter(
    (i) => !loanIdChain || i.loan_id_chain === loanIdChain,
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      {groups.map((g) => (
        <LadderCard
          key={`${g.direction}-${g.groupId}`}
          group={g}
          collateralSymbol={collateralSymbol}
          currentPriceUsd={currentPriceUsd}
          botApiUrl={botApiUrl}
          loanIdChain={loanIdChain}
          missingIntents={intentsForLoan.filter((i) => i.direction === g.direction)}
          onMutated={onMutated}
        />
      ))}
    </div>
  );
}

function groupLadders(orders: TakeProfitOrder[], loanDbId: number): LegGroup[] {
  const byKey = new Map<string, LegGroup>();
  for (const o of orders) {
    // o.loan_id arrives as a STRING from the API (pg bigint serializes
    // to JS string for precision); loanDbId is a number. Without
    // Number() coercion on both sides, !== always returns true and the
    // rollup silently filters out every order — which is the silent-
    // failure case operator hit on 2026-06-15.
    if (Number(o.loan_id) !== Number(loanDbId)) continue;
    // Treat anything missing a group_id as a single-strike order (not
    // a ladder); skip — those still render in LimitSlot's armed badge.
    if (!o.ladder_group_id) continue;
    const dir = (o.trigger_direction ?? "above") as "above" | "below";
    const key = `${dir}::${o.ladder_group_id}`;
    let g = byKey.get(key);
    if (!g) {
      g = { groupId: o.ladder_group_id, direction: dir, legs: [] };
      byKey.set(key, g);
    }
    g.legs.push(o);
  }
  // Sort legs within each group by trigger value (ascending for
  // upside/TP — first leg hits first; descending for downside/SL).
  for (const g of byKey.values()) {
    g.legs.sort((a, b) => {
      const av = Number(a.trigger_value_micro);
      const bv = Number(b.trigger_value_micro);
      return g.direction === "above" ? av - bv : bv - av;
    });
  }
  return Array.from(byKey.values());
}

function LadderCard({
  group,
  collateralSymbol,
  currentPriceUsd,
  botApiUrl,
  loanIdChain,
  missingIntents,
  onMutated,
}: {
  group: LegGroup;
  collateralSymbol: string | null;
  currentPriceUsd: number | null;
  botApiUrl?: string;
  loanIdChain?: string;
  missingIntents?: TakeProfitPendingIntent[];
  onMutated?: () => void;
}) {
  const { publicKey, signMessage } = useWallet();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [retryingIntentId, setRetryingIntentId] = useState<number | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Filter pending intents to ones whose strike + slice are NOT
  // already represented by an armed leg in this group. These are the
  // confirmed silent-drop victims — the user wanted them but they
  // never reached the arm endpoint.
  const unfulfilledIntents = (missingIntents || []).filter((intent) => {
    const intentTv = BigInt(intent.target_value_micro || "0");
    return !group.legs.some(
      (leg) =>
        leg.status === "armed" &&
        BigInt(leg.trigger_value_micro || "0") === intentTv,
    );
  });

  const isSl = group.direction === "below";
  const accentColor = isSl
    ? "rgba(220, 38, 38, 0.95)"
    : "var(--d-accent-deep, var(--d-accent))";
  const borderColor = isSl
    ? "rgba(220, 38, 38, 0.30)"
    : "rgba(34, 197, 94, 0.30)";

  const firedCount = group.legs.filter((l) => l.status === "fired").length;
  const totalCount = group.legs.length;
  const armedLegs = group.legs.filter((l) => l.status === "armed");
  const allFired = firedCount === totalCount;
  const partiallyFired = firedCount > 0 && firedCount < totalCount;
  // Incomplete-ladder detection (operator-mandated 2026-06-16 PM,
  // feedback_ladder_must_fully_arm_or_loudly_recover.md). A ladder where
  // SUM(slice_pct) across active legs < 10000 bps means the user's
  // intent fell short of full coverage. Either Phantom dropped a leg,
  // they dismissed mid-ladder, or they intentionally left budget. Either
  // way, the dashboard should LOUDLY surface the gap with a one-tap
  // recovery path — never silently let the user think they're fully
  // armed when they aren't.
  const activeLegsSliceBps = group.legs
    .filter((l) => l.status === "armed" || l.status === "fired" || l.status === "firing")
    .reduce((acc, l) => acc + (l.slice_pct ?? 10000), 0);
  const remainingSliceBps = Math.max(0, 10000 - activeLegsSliceBps);
  const remainingSlicePct = remainingSliceBps / 100;
  // Only surface the banner when there's a meaningful gap (>= 1% room)
  // AND at least one leg is still armed (no point on a fully-fired
  // ladder). The banner offers the user a one-tap path to add more legs.
  const isIncomplete = remainingSliceBps >= 100 && armedLegs.length > 0;

  // Header sentence — varies based on overall ladder state. Operator
  // emphasized the user should immediately see ladder progression
  // without having to read each leg.
  const headerLabel = isSl ? "Stop-loss ladder" : "Take-profit ladder";
  let statusSummary: string;
  if (allFired) {
    statusSummary = `All ${totalCount} legs filled`;
  } else if (partiallyFired) {
    statusSummary = `${firedCount} of ${totalCount} filled`;
  } else {
    statusSummary = `${totalCount} legs armed`;
  }

  const symbol = collateralSymbol || "collateral";

  // Cancel-all: loops cancelTakeProfit over every armed leg. Each
  // cancel signs its own envelope (bot accepts only one cancel per
  // sig), so the wallet will pop N times. We surface progress as
  // "Cancelling 2 of 4…" so the user knows it's working.
  const [cancelProgress, setCancelProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelAll = async () => {
    if (!publicKey || !signMessage || !botApiUrl || armedLegs.length === 0) return;
    if (
      !confirm(
        `Cancel all ${armedLegs.length} armed leg${armedLegs.length === 1 ? "" : "s"} on this ${headerLabel.toLowerCase()}?`,
      )
    )
      return;
    setCancelling(true);
    setCancelError(null);
    setCancelProgress({ done: 0, total: armedLegs.length });
    try {
      for (let i = 0; i < armedLegs.length; i++) {
        await cancelTakeProfit({
          botApiUrl,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          orderId: armedLegs[i].id,
        });
        setCancelProgress({ done: i + 1, total: armedLegs.length });
      }
      onMutated?.();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
      setCancelProgress(null);
    }
  };

  const canCancelAll =
    botApiUrl != null && armedLegs.length > 0 && publicKey != null;

  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{
        borderColor: borderColor,
        background: "var(--d-bg-card-elevated, var(--d-bg-card))",
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accentColor }}
          >
            {symbol}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{ color: "var(--d-ink-faint)" }}
          >
            · {headerLabel}
          </span>
        </div>
        <span
          className="text-[10px] font-medium"
          style={{ color: "var(--d-ink-soft)" }}
        >
          {statusSummary}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {group.legs.map((leg, idx) => (
          <LadderLeg
            key={leg.id}
            idx={idx + 1}
            leg={leg}
            currentPriceUsd={currentPriceUsd}
          />
        ))}
      </div>

      {/* Intent-aware recovery banner. Operator-mandated 2026-06-16 PM
       *  (feedback_every_arm_envelope_must_reach_server.md). If the
       *  user submitted N legs but only some reached the arm endpoint,
       *  the arm_intents ledger has the missing strikes. We render an
       *  EXACT-RETRY button per intent: "Retry $230 at 50%" — one tap
       *  POSTs armTakeProfit with the precise spec the user submitted.
       *  This is strictly better than the generic "Add remaining N%"
       *  banner below which only fires when slice sum is incomplete
       *  but doesn't know what the user wanted. */}
      {publicKey && botApiUrl && loanIdChain && unfulfilledIntents.length > 0 && (
        <div
          className="mt-2 rounded-md border-2 px-3 py-2.5"
          style={{
            borderColor: "rgba(245, 158, 11, 0.55)",
            background: "rgba(245, 158, 11, 0.10)",
            color: "var(--d-ink)",
          }}
          role="alert"
        >
          <div className="text-[11px] font-semibold mb-1">
            {unfulfilledIntents.length === 1
              ? "1 leg you requested didn't finish arming"
              : `${unfulfilledIntents.length} legs you requested didn't finish arming`}
          </div>
          <div className="text-[10px] opacity-75 mb-2">
            Your intent reached our servers; the Phantom signature didn't.
            Tap to retry — one signature per button.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unfulfilledIntents.map((intent) => {
              const targetUsd = Number(intent.target_value_micro) / 1e6;
              const sliceBps = intent.slice_pct_bps ?? 10000;
              const slicePct = sliceBps / 100;
              const targetLabel =
                intent.target_kind === "price_usd"
                  ? targetUsd >= 1
                    ? `$${targetUsd.toFixed(2)}`
                    : targetUsd >= 0.01
                      ? `$${targetUsd.toFixed(4)}`
                      : `$${targetUsd.toFixed(8)}`
                  : intent.target_kind === "mc_usd"
                    ? targetUsd >= 1e9
                      ? `$${(targetUsd / 1e9).toFixed(2)}B mc`
                      : `$${(targetUsd / 1e6).toFixed(2)}M mc`
                    : `${targetUsd}x`;
              const isRetrying = retryingIntentId === intent.id;
              return (
                <button
                  key={intent.id}
                  type="button"
                  disabled={isRetrying || retryingIntentId != null}
                  onClick={async () => {
                    if (!signMessage || !publicKey) return;
                    setRetryingIntentId(intent.id);
                    setRetryError(null);
                    try {
                      const target =
                        intent.target_kind === "price_usd"
                          ? { kind: "price_usd" as const, usd: targetUsd }
                          : intent.target_kind === "mc_usd"
                            ? { kind: "mc_usd" as const, mcDollars: targetUsd }
                            : { kind: "multiplier" as const, multiplier: targetUsd };
                      await armTakeProfit({
                        botApiUrl,
                        signerPubkey: publicKey.toBase58(),
                        signMessage,
                        request: {
                          from: publicKey.toBase58(),
                          loanIdChain,
                          direction: intent.direction,
                          target,
                          slippageBps: intent.direction === "below" ? 300 : 200,
                          sellDestination: "sol",
                          slicePctBps: sliceBps < 10000 ? sliceBps : undefined,
                        },
                      });
                      onMutated?.();
                    } catch (e) {
                      setRetryError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setRetryingIntentId(null);
                    }
                  }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap disabled:opacity-50"
                  style={{
                    background: "rgba(245, 158, 11, 0.20)",
                    borderColor: "rgba(245, 158, 11, 0.55)",
                    color: "var(--d-ink)",
                  }}
                >
                  {isRetrying ? "Signing…" : `Retry ${targetLabel} (${slicePct.toFixed(0)}%)`}
                </button>
              );
            })}
          </div>
          {retryError && (
            <div className="text-[10px] mt-1.5 rounded px-1.5 py-1"
              style={{ background: "rgba(220,38,38,0.10)", color: "rgb(185, 28, 28)" }}
            >
              {retryError}
            </div>
          )}
        </div>
      )}

      {/* Incomplete-ladder banner. Loud yellow surface when the ladder's
       *  combined active slice% is below 100%. Operator-mandated 2026-
       *  06-16 PM (feedback_ladder_must_fully_arm_or_loudly_recover.md)
       *  after the SPCX loan 798 dropped a leg silently mid-ladder.
       *  Renders a one-tap "Add remaining %" CTA that scrolls + signals
       *  the LimitSlot below (which already exposes the LadderPanel).
       *  Hides when the intent-aware banner above already covers the
       *  gap (avoids double-CTA confusion). */}
      {isIncomplete && unfulfilledIntents.length === 0 && (
        <div
          className="mt-2 rounded-md border-2 px-3 py-2 text-[11px] flex items-center justify-between gap-3"
          style={{
            borderColor: "rgba(245, 158, 11, 0.55)",
            background: "rgba(245, 158, 11, 0.10)",
            color: "var(--d-ink)",
          }}
          role="alert"
        >
          <div>
            <span className="font-semibold">Ladder partially armed.</span>{" "}
            <span className="opacity-80">
              Current legs cover {(activeLegsSliceBps / 100).toFixed(0)}% of your collateral.{" "}
              {remainingSlicePct.toFixed(0)}% slice budget is still unallocated — your{" "}
              {isSl ? "stop-loss" : "take-profit"} won't fully close the position when all
              triggers hit.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              // Scroll into the matching LimitSlot so the user can toggle
              // ladder mode and add legs. The LadderPanel's existingArmed
              // accounting (PR #142) defaults the new leg to the
              // remaining budget so this works in one tap.
              const slotEl = document.querySelector(
                isSl
                  ? '[data-slot-direction="below"]'
                  : '[data-slot-direction="above"]',
              );
              if (slotEl) slotEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="text-[10px] font-semibold px-2 py-1 rounded border whitespace-nowrap"
            style={{
              background: "rgba(245, 158, 11, 0.20)",
              borderColor: "rgba(245, 158, 11, 0.55)",
              color: "var(--d-ink)",
            }}
          >
            Add remaining {remainingSlicePct.toFixed(0)}%
          </button>
        </div>
      )}

      {/* Footer actions — cancel-all when there are armed legs left */}
      {canCancelAll && (
        <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2"
          style={{ borderColor: "var(--d-border)" }}
        >
          {cancelError && (
            <span className="text-[10px]" style={{ color: "rgba(220,38,38,0.95)" }}>
              {cancelError}
            </span>
          )}
          <button
            onClick={cancelAll}
            disabled={cancelling}
            className="text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
            title="Cancel every armed leg in this ladder. Already-fired legs are not affected."
          >
            {cancelling
              ? cancelProgress
                ? `Cancelling ${cancelProgress.done} of ${cancelProgress.total}…`
                : "Cancelling…"
              : `Cancel ladder (${armedLegs.length} armed)`}
          </button>
        </div>
      )}
    </div>
  );
}

function LadderLeg({
  idx,
  leg,
  currentPriceUsd,
}: {
  idx: number;
  leg: TakeProfitOrder;
  currentPriceUsd: number | null;
}) {
  const slicePct = sliceToPct(leg.slice_pct);
  const strikeLabel = formatTriggerInline(leg.trigger_kind, leg.trigger_value_micro);
  const distance = distanceToFire(leg, currentPriceUsd);

  const visual = visualForStatus(leg.status);
  const isCancelled = leg.status === "cancelled";
  const isArmed = leg.status === "armed";

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums"
          style={{
            background: "var(--d-bg-subtle, rgba(0,0,0,0.04))",
            color: "var(--d-ink-soft)",
          }}
        >
          {idx}
        </span>
        <span
          className="font-medium tabular-nums"
          style={{
            color: isCancelled ? "var(--d-ink-faint)" : "var(--d-ink)",
            textDecoration: isCancelled ? "line-through" : undefined,
          }}
        >
          {slicePct}%
        </span>
        <span
          className="text-[var(--d-ink-faint)]"
          aria-hidden
        >
          →
        </span>
        <span
          className="tabular-nums truncate"
          style={{
            color: isCancelled ? "var(--d-ink-faint)" : "var(--d-ink)",
            textDecoration: isCancelled ? "line-through" : undefined,
          }}
        >
          {strikeLabel}
        </span>
        {/* Distance-to-fire pill — only shown on armed legs with a
         *  comparable price (price_usd). Skipped on mc_usd because
         *  current price is per-token, not market cap. */}
        {isArmed && distance && (
          <span
            className="rounded-sm px-1 text-[9px] font-medium tabular-nums"
            style={{
              background: "var(--d-bg-subtle, rgba(0,0,0,0.04))",
              color: "var(--d-ink-soft)",
            }}
            title={`Current price is ${distance.label} the trigger`}
          >
            {distance.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: visual.dot,
            boxShadow: visual.pulse ? `0 0 0 3px ${visual.dot}22` : undefined,
            animation: visual.pulse
              ? "ladder-pulse 1.6s ease-in-out infinite"
              : undefined,
          }}
        />
        <span
          className="text-[10px] font-medium uppercase tracking-[0.04em]"
          style={{ color: visual.text }}
        >
          {visual.label}
        </span>
        {leg.status === "fired" && leg.proceeds_lamports && (
          <span
            className="text-[10px] tabular-nums font-medium"
            style={{ color: "rgb(22, 163, 74)" }}
            title="SOL accumulated into the per-loan sol_proceeds_vault from this leg"
          >
            +{(Number(leg.proceeds_lamports) / 1e9).toFixed(4)} SOL
          </span>
        )}
        {leg.status === "fired" && leg.tx_signature_swap && (
          <a
            href={`https://solscan.io/tx/${leg.tx_signature_swap}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--d-accent-deep, var(--d-accent))" }}
          >
            tx
          </a>
        )}
        {(leg.status === "failed" || leg.status === "max_retries_exceeded") && (
          <span
            className="text-[9px] font-medium uppercase tracking-[0.04em]"
            style={{ color: "rgb(185, 28, 28)" }}
            title={leg.failure_reason ?? "engine fire failed"}
          >
            · {failureReasonLabel(leg.failure_reason)}
          </span>
        )}
      </div>
    </div>
  );
}

/* Compute distance-to-fire as a percentage. Returns null if the
 * trigger isn't a per-token USD price (mc-based triggers need the
 * token's circulating supply to compare against a market-cap target,
 * which we don't carry through here). */
function distanceToFire(
  leg: TakeProfitOrder,
  currentPriceUsd: number | null,
): { label: string } | null {
  if (currentPriceUsd == null || currentPriceUsd <= 0) return null;
  if (leg.trigger_kind !== "price_usd") return null;
  const trigger = Number(leg.trigger_value_micro) / 1e6;
  if (!Number.isFinite(trigger) || trigger <= 0) return null;
  const pct = ((trigger - currentPriceUsd) / currentPriceUsd) * 100;
  // For TP (above), positive % = still need to climb. For SL (below),
  // negative % = still need to drop. Sign + arrow direction here gets
  // confusing fast, so just show "+9.1%" / "-4.3%" + the side-specific
  // arrow elsewhere.
  const sign = pct >= 0 ? "+" : "";
  let display: string;
  if (Math.abs(pct) >= 100) display = `${sign}${pct.toFixed(0)}%`;
  else if (Math.abs(pct) >= 10) display = `${sign}${pct.toFixed(1)}%`;
  else display = `${sign}${pct.toFixed(2)}%`;
  return { label: `${display} away` };
}

function visualForStatus(status: TakeProfitOrder["status"]): {
  label: string;
  dot: string;
  text: string;
  pulse: boolean;
} {
  switch (status) {
    case "fired":
      return {
        label: "Filled",
        dot: "rgb(34, 197, 94)", // emerald-500
        text: "rgb(22, 163, 74)", // emerald-600
        pulse: false,
      };
    case "firing":
    case "twap_in_progress":
    case "awaiting_user":
      return {
        label: "Firing…",
        dot: "rgb(245, 158, 11)", // amber-500
        text: "rgb(180, 83, 9)", // amber-700
        pulse: true,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        dot: "rgb(156, 163, 175)", // gray-400
        text: "var(--d-ink-faint)",
        pulse: false,
      };
    case "failed":
    case "max_retries_exceeded":
      return {
        label: status === "max_retries_exceeded" ? "Failed (retries)" : "Failed",
        dot: "rgb(220, 38, 38)", // red-600
        text: "rgb(185, 28, 28)", // red-700
        pulse: false,
      };
    case "armed":
    default:
      return {
        label: "Armed",
        dot: "var(--d-ink-faint)",
        text: "var(--d-ink-soft)",
        pulse: false,
      };
  }
}

/* Translate engine-side failure_reason codes into a short user-friendly
 * label rendered next to the red status pill. Keep these tight — the
 * full reason is in the tooltip. */
export function failureReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "engine couldn't route";
  const r = reason.toLowerCase();
  if (r.includes("route") || r.includes("no_route") || r.includes("invalidtokenaccount")) return "no Jupiter route";
  if (r.includes("slippage") || r.includes("cap_exceeded")) return "slippage cap exceeded";
  if (r.includes("max_retries") || r.includes("exhausted")) return "retries exhausted";
  if (r.includes("simulate") || r.includes("sim_fail")) return "sim failed";
  if (r.includes("twap") || r.includes("stale")) return "price-feed gap";
  if (r.includes("vault") || r.includes("ata")) return "vault setup issue";
  return reason.slice(0, 40);
}

function sliceToPct(sliceBps?: number): number {
  // slice_pct is stored in basis points (10000 = 100%). Default is
  // 10000 for non-ladder orders — but those never reach this component.
  if (sliceBps == null) return 100;
  return Math.round(sliceBps / 100);
}

/**
 * Inline strike formatter — tighter than the standalone formatTrigger
 * in TakeProfitCard so each leg row stays one line. Tokenized stocks
 * read in plain dollars; memecoins in MC; price-in-SOL is rare but
 * supported for completeness.
 */
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
  // price_sol — rare path
  return `${(n / 1e9).toFixed(6)} SOL`;
}
