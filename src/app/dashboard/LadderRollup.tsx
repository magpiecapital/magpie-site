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

import type { TakeProfitOrder } from "@/lib/solana/site-take-profit";

interface Props {
  orders: TakeProfitOrder[];
  loanDbId: number;
  collateralSymbol: string | null;
}

interface LegGroup {
  groupId: string;
  direction: "above" | "below";
  legs: TakeProfitOrder[];
}

export function LadderRollup({ orders, loanDbId, collateralSymbol }: Props) {
  // Find ladder orders for this loan, group by ladder_group_id +
  // direction (a loan could theoretically have both a TP ladder and an
  // SL ladder; render each separately).
  const groups = groupLadders(orders, loanDbId);
  if (groups.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {groups.map((g) => (
        <LadderCard
          key={`${g.direction}-${g.groupId}`}
          group={g}
          collateralSymbol={collateralSymbol}
        />
      ))}
    </div>
  );
}

function groupLadders(orders: TakeProfitOrder[], loanDbId: number): LegGroup[] {
  const byKey = new Map<string, LegGroup>();
  for (const o of orders) {
    if (o.loan_id !== loanDbId) continue;
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
}: {
  group: LegGroup;
  collateralSymbol: string | null;
}) {
  const isSl = group.direction === "below";
  const accentColor = isSl
    ? "rgba(220, 38, 38, 0.95)"
    : "var(--d-accent-deep, var(--d-accent))";
  const borderColor = isSl
    ? "rgba(220, 38, 38, 0.30)"
    : "rgba(34, 197, 94, 0.30)";

  const firedCount = group.legs.filter((l) => l.status === "fired").length;
  const totalCount = group.legs.length;
  const allFired = firedCount === totalCount;
  const partiallyFired = firedCount > 0 && firedCount < totalCount;

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
          <LadderLeg key={leg.id} idx={idx + 1} leg={leg} />
        ))}
      </div>
    </div>
  );
}

function LadderLeg({ idx, leg }: { idx: number; leg: TakeProfitOrder }) {
  const slicePct = sliceToPct(leg.slice_pct);
  const strikeLabel = formatTriggerInline(leg.trigger_kind, leg.trigger_value_micro);

  const visual = visualForStatus(leg.status);
  const isCancelled = leg.status === "cancelled";

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
      </div>

      {/* Pulse keyframes are global; defined once at the bottom of
       *  this file via a styled-jsx tag so SSR + hydration agree. */}
    </div>
  );
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
