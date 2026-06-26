"use client";

/**
 * TakeProfitCard — inline UI under each active loan that lets the
 * user arm OR cancel autonomous limit-close orders.
 *
 * 2026-06-13: extended from TP-only to TP + SL. The engine + bot
 * agent + TG /stoploss have always supported direction-aware
 * triggers; the site form just didn't expose SL. Now renders TWO
 * slots — one for take-profit (above), one for stop-loss (below) —
 * because the schema (migration 047) allows both armed concurrently
 * on the same loan.
 *
 * Behavior per slot:
 *   - If wallet not custodial: the parent renders a single CTA
 *     explaining the user needs a Magpie custodial keypair. No slots
 *     — the engine literally cannot fire without one.
 *   - If loan ineligible for THIS slot (size, already armed, etc.):
 *     show the reason for that slot.
 *   - If no order armed in this slot: collapsed CTA → expands to a
 *     small form with multiplier presets + custom USD input.
 *   - If order armed: show trigger + slippage + Cancel button.
 *
 * Lives next to the Active Loans list on the dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchTakeProfitState, armTakeProfit, cancelTakeProfit, modifyTakeProfit,
  preflightArmTakeProfit,
  type TakeProfitOrder, type TakeProfitLoan, type TakeProfitState,
} from "@/lib/solana/site-take-profit";
import { parseStrike } from "@/lib/strike-price-parser";
import { robustTokenPriceUsd } from "@/lib/robust-price";
import { LadderPanel } from "./LadderPanel";
import { LadderRollup } from "./LadderRollup";
import { ExitStatusBanner } from "./ExitStatusBanner";

/**
 * Collapse stale failure/cancellation rows when a later order with the
 * SAME composite intent key (loan + direction + kind + trigger value +
 * slice) is fired or armed. Operator-mandated 2026-06-16 PM
 * ([[feedback_clean_dashboard_v4_ux]]) after the SPCX V4 loan #804
 * dashboard showed "Failed · borrower_wallet_changed" on order #18
 * despite order #19 having filled the same $205/40% intent.
 *
 * Rules:
 *   - Failed/cancelled orders are SUPPRESSED if another order with the
 *     same composite key has status in {fired, firing, armed,
 *     twap_in_progress, awaiting_user}.
 *   - Original-fired ORDERS are always shown (they're the receipt).
 *   - Currently-armed orders are always shown (live ladder state).
 *
 * Pure function — no side effects, doesn't mutate the input array.
 */
function filterSupersededOrders(orders: TakeProfitOrder[]): TakeProfitOrder[] {
  if (!Array.isArray(orders) || orders.length === 0) return orders;
  const ACTIVE_STATES = new Set([
    "armed",
    "firing",
    "twap_in_progress",
    "awaiting_user",
    "fired",
  ]);
  // Build a set of active composite keys.
  const activeKeys = new Set<string>();
  for (const o of orders) {
    if (!ACTIVE_STATES.has(o.status)) continue;
    const key = [
      String(o.loan_id),
      o.trigger_direction ?? "above",
      o.trigger_kind,
      String(o.trigger_value_micro),
      String(o.slice_pct ?? 10000),
    ].join("|");
    activeKeys.add(key);
  }
  // Filter out failed/cancelled orders whose composite key has an
  // active sibling.
  return orders.filter((o) => {
    if (o.status !== "failed" && o.status !== "cancelled" && o.status !== "max_retries_exceeded") {
      return true;
    }
    const key = [
      String(o.loan_id),
      o.trigger_direction ?? "above",
      o.trigger_kind,
      String(o.trigger_value_micro),
      String(o.slice_pct ?? 10000),
    ].join("|");
    return !activeKeys.has(key);
  });
}

/**
 * One-shot preview helper for the free-text strike input. Wraps the
 * shared parser with a tighter shape the JSX renderer can render
 * directly. Reused below by both LimitSlot variants.
 */
function parseStrikePreview(raw: string, isSl: boolean):
  | { ok: true; kind: "mc_usd" | "price_usd" | "price_sol" | "multiplier"; usd: number | null; multiplier: number | null; display: string }
  | { ok: false; error: string }
{
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "" };
  const r = parseStrike(trimmed, {
    bareNumberDefaultKind: isSl ? "price_usd" : undefined,
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.impliedDirection && ((isSl && r.impliedDirection === "above") || (!isSl && r.impliedDirection === "below"))) {
    return {
      ok: false,
      error: r.impliedDirection === "above"
        ? "That's an upside target — use Take-Profit, not Stop-Loss."
        : "That's a downside target — use Stop-Loss, not Take-Profit.",
    };
  }
  return {
    ok: true,
    kind: r.kind,
    usd: r.kind === "mc_usd" || r.kind === "price_usd"
      ? Number(r.valueMicro!) / 1e6
      : null,
    multiplier: r.multiplier,
    display: r.normalizedDisplay,
  };
}

// Adaptive poll cadence (operator-mandated 2026-06-16 PM,
// feedback_ladder_end_to_end_confidence_protocol.md). When any order
// is in an active state (armed / firing / twap_in_progress /
// awaiting_user), drop to fast poll so a fire is visible within
// seconds. When everything is idle (no armed/firing orders), back
// off to the standard interval to save bandwidth + DB load.
const POLL_MS_IDLE = 60_000;
const POLL_MS_ACTIVE = 5_000;
const TP_PRESETS = [1.5, 2, 3, 5] as const;
// SL presets: "sell when price drops to X% of current". 0.5 = -50%.
// Operator-friendly anchors that match the TG /stoploss command's
// common recipes. Users wanting tighter SL can use the custom input.
const SL_PRESETS = [0.9, 0.8, 0.7, 0.5] as const;

interface Props {
  botApiUrl: string;
  loanIdChain: string;     // chain loan_id
  loanDbId: number;        // DB primary key — matches order.loan_id
  collateralSymbol: string | null;
  /** Collateral mint — needed for the in-card price lookup that drives
   *  the pre-arm preview ("current → fires at") and the distance-to-
   *  trigger context on the armed badge. Optional for back-compat;
   *  when omitted, the price-driven hints quietly hide. */
  collateralMint?: string | null;
  /** Lifted state — parent fetches once for all loans + passes the slice down */
  state: TakeProfitState | null;
  /** Called when the parent should refetch state (after arm/cancel) */
  onMutated: () => void;
}

export function TakeProfitCard(props: Props) {
  const linked = props.state?.linked ?? false;
  const custodial = props.state?.custodial ?? false;
  const loan = useMemo<TakeProfitLoan | null>(
    // Match by the on-chain loan_id (which the dashboard ALWAYS has)
    // rather than the DB id (which /api/v1/loans does NOT return —
    // so props.loanDbId defaults to 0 and any id-based match fails).
    // The chain id is a string on both sides ("116755458128207700"),
    // so direct === works without coercion.
    //
    // History: Operator's $TROLL V4 loan on 2026-06-15 surfaced
    // "Auto-sell on rise: not eligible" even though the API reported
    // eligible_tp=True. Tracing showed /api/v1/loans returns no DB id
    // field, so loanDbId came in as 0 and Number(l.id) === 0 always
    // failed → loan resolved to null → eligible defaulted to false.
    () => props.state?.loans.find((l) => l.loan_id === props.loanIdChain) ?? null,
    [props.state, props.loanIdChain],
  );

  // The "real" DB id for this loan, derived from the limit-close
  // state. This is what downstream order-lookups need, NOT the
  // possibly-zero props.loanDbId. Pass this down to LimitSlot,
  // LadderRollup, and ExitStatusBanner instead.
  const resolvedLoanDbId = loan?.id != null ? Number(loan.id) : Number(props.loanDbId) || 0;

  // Lift the live collateral USD price to the card scope so both
  // LadderRollup (distance-to-fire pills) and the individual
  // LimitSlots can share a single fetch + a single cache hit.
  const [cardPriceUsd, setCardPriceUsd] = useState<number | null>(null);
  useEffect(() => {
    if (!props.collateralMint) return;
    let cancelled = false;
    fetchCurrentPriceUsd(props.collateralMint).then((p) => {
      if (!cancelled) setCardPriceUsd(p);
    });
    return () => { cancelled = true; };
  }, [props.collateralMint]);

  // Loading sliver if state hasn't loaded yet
  if (!props.state) {
    return (
      <div className="mt-1.5 text-[11px] text-[var(--d-ink-faint)]">
        Loading limit-order state…
      </div>
    );
  }

  // Not linked → single CTA (slots aren't useful yet because the bot
  // hasn't auto-linked this wallet on any signed envelope path).
  //
  // 2026-06-17 PM — DROPPED the `|| !custodial` half of the condition.
  // V4 auto-sells fire with the LENDER keypair, not the borrower's, so
  // a non-custodial wallet (no encrypted_secret) can ABSOLUTELY arm and
  // execute V4 auto-sells. The card MUST render normally so the user
  // can see their armed orders. Operator hit this on
  // 3J1Ut4tK1... after the first 4 gates were already removed.
  // See feedback_v4_takeprofit_card_must_render_for_noncustodial.md.
  if (!linked) {
    return (
      <div className="mt-2 text-[11px] text-[var(--d-ink-faint)]">
        <span className="opacity-70">Auto-sells:</span>{" "}
        <span>
          link this wallet to a Magpie account to enable automatic sells on price triggers.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {/* Exit status — top-of-card pill that always tells the user
       *  exactly where their auto-sell stands: not set, armed, firing,
       *  partial, or complete. Closes the silent-failure case where a
       *  ladder didn't arm and the user had no way to know. */}
      <ExitStatusBanner
        orders={filterSupersededOrders(props.state.orders)}
        loan={loan}
        loanDbId={resolvedLoanDbId}
        collateralSymbol={props.collateralSymbol}
        botApiUrl={props.botApiUrl}
        loanIdChain={props.loanIdChain}
        pendingIntents={props.state.pending_intents}
        pendingArms={props.state.pending_arms}
        onRefresh={props.onMutated}
      />
      {/* Ladder rollup — renders only when this loan has a ladder
       *  (orders sharing a ladder_group_id). Lets the user see every
       *  leg with its strike, slice %, distance-to-fire, and fire
       *  status without having to expand any slot. Cancel-ladder
       *  button in the footer cancels every armed leg sequentially. */}
      <LadderRollup
        orders={filterSupersededOrders(props.state.orders)}
        loanDbId={resolvedLoanDbId}
        loanIdChain={props.loanIdChain}
        collateralSymbol={props.collateralSymbol}
        currentPriceUsd={cardPriceUsd}
        botApiUrl={props.botApiUrl}
        pendingIntents={props.state.pending_intents}
        onMutated={props.onMutated}
      />
      <div data-slot-direction="above">
        <LimitSlot
          direction="above"
          loan={loan}
          orders={filterSupersededOrders(props.state.orders)}
          loanIdChain={props.loanIdChain}
          loanDbId={resolvedLoanDbId}
          collateralSymbol={props.collateralSymbol}
          collateralMint={props.collateralMint ?? null}
          botApiUrl={props.botApiUrl}
          onMutated={props.onMutated}
        />
      </div>
      <div data-slot-direction="below">
        <LimitSlot
          direction="below"
          loan={loan}
          orders={filterSupersededOrders(props.state.orders)}
          loanIdChain={props.loanIdChain}
          loanDbId={resolvedLoanDbId}
          collateralSymbol={props.collateralSymbol}
          collateralMint={props.collateralMint ?? null}
          botApiUrl={props.botApiUrl}
          onMutated={props.onMutated}
        />
      </div>
    </div>
  );
}

/* ───────────────── LimitSlot ───────────────── */

interface SlotProps {
  direction: "above" | "below";
  loan: TakeProfitLoan | null;
  orders: TakeProfitOrder[];
  loanIdChain: string;
  loanDbId: number;
  collateralSymbol: string | null;
  collateralMint: string | null;
  botApiUrl: string;
  onMutated: () => void;
}

/* In-memory price cache per collateral mint — many LimitSlots can
 * render on the same dashboard view; each loan has 2 slots (TP+SL),
 * so 5 active loans = 10 mounts. Without a cache that's 10 DexScreener
 * round-trips on every dashboard render. Keyed by mint, 60s TTL —
 * the engine's fire-side cross-source price is the load-bearing
 * source of truth, this is purely UX preview math.
 */
const PRICE_CACHE = new Map<string, { usd: number; at: number }>();
const PRICE_TTL_MS = 60_000;

async function fetchCurrentPriceUsd(mint: string): Promise<number | null> {
  const cached = PRICE_CACHE.get(mint);
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.usd;
  // ROBUST cross-sourced price (Jupiter-primary, DexScreener outlier-rejected)
  // — a single mis-priced pair can never skew a take-profit valuation.
  // See lib/robust-price.
  const usd = await robustTokenPriceUsd(mint);
  if (usd != null && usd > 0) {
    PRICE_CACHE.set(mint, { usd, at: Date.now() });
    return usd;
  }
  return null;
}

function formatPctMove(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  if (Math.abs(pct) >= 100) return `${sign}${pct.toFixed(0)}%`;
  if (Math.abs(pct) >= 10) return `${sign}${pct.toFixed(1)}%`;
  return `${sign}${pct.toFixed(2)}%`;
}

function formatUsdPerToken(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(4)}`;
  if (usd >= 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(8)}`;
}

function LimitSlot(props: SlotProps) {
  const { publicKey, signMessage } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUsd, setCurrentUsd] = useState<number | null>(null);
  // Modify form state for armed orders. Hidden until the user taps Edit.
  const [editing, setEditing] = useState(false);
  const [editPriceUsd, setEditPriceUsd] = useState<string>("");
  const [editSlippagePct, setEditSlippagePct] = useState<number | null>(null);
  // Trailing distance editor — only meaningful when armed.trailing_distance_bps != null.
  // Stays null until the user pulls the slider; modify() compares against
  // the live distance to decide whether to send Trailing in the envelope.
  const [editTrailingPct, setEditTrailingPct] = useState<number | null>(null);

  // Lazy-load the live price the first time the slot opens its form OR
  // renders an armed badge. Keeps the dashboard's initial render cheap
  // (no preview-only fetches for collapsed cards). Refreshes once per
  // expand/cancel cycle — the 60s cache keeps thrash down.
  useEffect(() => {
    if (!props.collateralMint) return;
    let cancelled = false;
    fetchCurrentPriceUsd(props.collateralMint).then((p) => {
      if (!cancelled) setCurrentUsd(p);
    });
    return () => { cancelled = true; };
  }, [props.collateralMint]);

  const isSl = props.direction === "below";
  // Plain-language slot labels — the operator's "TP/SL is jargon"
  // sweep continues here. We keep the take-profit / stop-loss form in
  // parens once at the very top of the card (in armedTitle below) for
  // search/SEO, but the button + body verbs lead with the verb.
  const slotLabel = isSl ? "Auto-sell on drop" : "Auto-sell on rise";
  const slotVerb = isSl ? "Set downside auto-sell" : "Set upside auto-sell";
  const slotPresets = isSl ? SL_PRESETS : TP_PRESETS;
  const defaultMultiplier = isSl ? 0.7 : 2;
  const armColor = isSl
    ? "rgba(220, 38, 38, 0.95)"     // SL = red accent
    : "var(--d-accent-deep, var(--d-accent))";
  const armedBorderColor = isSl
    ? "rgba(220, 38, 38, 0.30)"
    : "rgba(34, 197, 94, 0.30)";
  const armedBg = isSl
    ? "rgba(220, 38, 38, 0.08)"
    : "rgba(34, 197, 94, 0.08)";

  const armed = useMemo<TakeProfitOrder | null>(
    () =>
      props.orders.find(
        (o) =>
          // Same string-vs-number coercion fix as the loan lookup above.
          // o.loan_id is "762" from the API; loanDbId is the number 762.
          Number(o.loan_id) === Number(props.loanDbId) &&
          o.status === "armed" &&
          (o.trigger_direction ?? "above") === props.direction,
      ) ?? null,
    [props.orders, props.loanDbId, props.direction],
  );

  const eligible = isSl
    ? (props.loan?.is_eligible_for_stoploss ?? false)
    : (props.loan?.is_eligible_for_takeprofit ?? false);
  const ineligibilityReason = isSl
    ? props.loan?.stoploss_ineligibility_reasons?.[0]
    : props.loan?.ineligibility_reasons?.[0];

  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(defaultMultiplier);
  const [customUsd, setCustomUsd] = useState<string>("");
  const [slippagePct, setSlippagePct] = useState<number>(isSl ? 3 : 2);
  // Trailing-stop state. Only meaningful on SL slots; TP form ignores.
  // When trailingEnabled is true, the user picks a percent distance and
  // the target/customUsd inputs are ignored — peak seeds at current
  // price at arm time and floats with each new high.
  const [trailingEnabled, setTrailingEnabled] = useState<boolean>(false);
  const [trailingPct, setTrailingPct] = useState<number>(10); // 10% default
  // Ladder mode — when enabled, the slot renders a multi-leg picker
  // (LadderPanel) instead of the single-strike form. Multi-leg arming
  // signs N envelopes sequentially with a shared ladder_group_id.
  const [ladderEnabled, setLadderEnabled] = useState<boolean>(false);

  const arm = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError(`Connect your wallet to set an auto-sell.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const slippageBps = Math.round(slippagePct * 100);

      // Build the request shape once so both preflight and the real arm
      // see identical inputs. Preflight runs first — operator-mandated
      // 2026-06-15: surface ineligibility BEFORE asking Phantom to sign.
      let request: import("@/lib/solana/site-take-profit").ArmTakeProfitRequest;

      if (isSl && trailingEnabled) {
        const bps = Math.round(trailingPct * 100);
        request = {
          from: publicKey.toBase58(),
          loanIdChain: props.loanIdChain,
          direction: "below",
          trailingDistanceBps: bps,
          slippageBps,
          sellDestination: "sol",
        };
      } else {
        let target:
          | { kind: "price_usd"; usd: number }
          | { kind: "mc_usd"; mcDollars: number }
          | { kind: "multiplier"; multiplier: number };
        if (customUsd.trim()) {
          const p = parseStrikePreview(customUsd, isSl);
          if (!p.ok) {
            throw new Error(p.error || "Couldn't parse the target.");
          }
          if (p.kind === "multiplier" && p.multiplier != null) {
            target = { kind: "multiplier", multiplier: p.multiplier };
          } else if (p.kind === "mc_usd" && p.usd != null) {
            target = { kind: "mc_usd", mcDollars: p.usd };
          } else if (p.kind === "price_usd" && p.usd != null) {
            target = { kind: "price_usd", usd: p.usd };
          } else {
            throw new Error("Only USD price, market cap, or multiplier strikes are supported for arming today.");
          }
        } else {
          target = { kind: "multiplier", multiplier: selectedMultiplier };
        }
        request = {
          from: publicKey.toBase58(),
          loanIdChain: props.loanIdChain,
          direction: props.direction,
          target,
          slippageBps,
          sellDestination: "sol",
        };
      }

      // ── Preflight: dry-run validate BEFORE asking Phantom to sign ──
      // V4 Hardening T3 (operator-mandated): if the server would reject
      // this arm for any reason (V4-eligibility, slice overflow, already
      // armed, parse error), surface it now rather than waste a Phantom
      // popup. Translates the server's error/detail into a clean message.
      const pre = await preflightArmTakeProfit({
        botApiUrl: props.botApiUrl,
        wallet: publicKey.toBase58(),
        request,
      });
      if (!pre.ok) {
        // Map the server reason to a human message the loud error UI
        // can then classify further (phantom_session / network / etc.).
        const reason = pre.error || "preflight_failed";
        const detail = pre.detail || "";
        if (reason === "exits_require_v4_loan") {
          throw new Error("This loan is on a legacy pool. Repay and re-open the borrow with the exit set; the new loan will land on V4 automatically.");
        }
        if (reason === "take_profit_already_armed" || reason === "stop_loss_already_armed") {
          throw new Error("There's already an armed order on this direction. Cancel it before adding another.");
        }
        if (reason === "slice_overflow") {
          throw new Error(detail || "Existing ladder legs already use this slice.");
        }
        if (reason === "wallet_not_linked") {
          throw new Error("This wallet isn't linked to a Magpie account yet. Open the Telegram bot once to link, then come back.");
        }
        if (reason === "loan_not_found_for_signer") {
          throw new Error("Couldn't find this loan under your wallet. Did the wallet change since the borrow?");
        }
        if (reason === "collateral_not_enabled") {
          throw new Error("This collateral isn't currently enabled for new arms.");
        }
        if (reason === "multiplier_resolve_failed") {
          throw new Error(`Couldn't resolve the target price from the oracle: ${detail}`);
        }
        if (reason === "preflight_network_error") {
          throw new Error(`Network issue reaching the bot — retry in a moment (${detail.slice(0, 60)})`);
        }
        throw new Error(`${reason}${detail ? ": " + detail : ""}`);
      }

      // Preflight green — proceed to signMessage + real arm.
      await armTakeProfit({
        botApiUrl: props.botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        request,
      });
      setExpanded(false);
      props.onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    publicKey, signMessage, isSl, selectedMultiplier, customUsd, slippagePct,
    trailingEnabled, trailingPct, props,
  ]);

  const cancel = useCallback(async () => {
    if (!publicKey || !signMessage || !armed) return;
    if (!confirm(`Cancel your ${isSl ? "downside" : "upside"} auto-sell on this loan?`)) return;
    setError(null);
    setBusy(true);
    try {
      await cancelTakeProfit({
        botApiUrl: props.botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        orderId: armed.id,
      });
      props.onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, armed, isSl, props]);

  // Modify the armed order in place — no cancel/re-arm gap. Sends only
  // the fields the user changed; the bot rejects no_changes_supplied
  // if everything stayed the same.
  const modify = useCallback(async () => {
    if (!publicKey || !signMessage || !armed) return;
    const newPrice = editPriceUsd ? Number(editPriceUsd) : null;
    const newSlippageBps =
      editSlippagePct != null ? Math.round(editSlippagePct * 100) : null;
    // Trailing distance — only meaningful when the armed order is
    // already a trailing stop. State stays at the current distance by
    // default; a change here sends Trailing: <bps>.
    const currentTrailingPct = armed.trailing_distance_bps != null
      ? armed.trailing_distance_bps / 100
      : null;
    const newTrailingPct = editTrailingPct;
    const trailingChanged =
      currentTrailingPct != null &&
      newTrailingPct != null &&
      Math.abs(newTrailingPct - currentTrailingPct) > 0.01;
    const newTrailingBps = trailingChanged
      ? Math.round(newTrailingPct * 100)
      : null;
    if (newPrice == null && newSlippageBps == null && newTrailingBps == null) {
      setError("Change price, slippage, or trailing distance before saving.");
      return;
    }
    if (newPrice != null && !(Number.isFinite(newPrice) && newPrice > 0)) {
      setError("Price must be a positive number.");
      return;
    }
    if (newTrailingBps != null && (newTrailingBps < 50 || newTrailingBps > 5000)) {
      setError("Trailing distance must be 0.5%-50% (50-5000 bps).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await modifyTakeProfit({
        botApiUrl: props.botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        request: {
          orderId: armed.id,
          priceUsd: newPrice ?? undefined,
          slippageBps: newSlippageBps ?? undefined,
          trailingDistanceBps: newTrailingBps ?? undefined,
        },
      });
      setEditing(false);
      setEditPriceUsd("");
      setEditSlippagePct(null);
      setEditTrailingPct(null);
      props.onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, armed, editPriceUsd, editSlippagePct, editTrailingPct, props]);

  // Ineligible reason that's specific to this slot (not generic loan
  // size / collateral disabled). The "other-slot-armed" case is
  // implicit — don't crowd the UI.
  if (!armed && !eligible) {
    const reason = ineligibilityReason;
    // The "same-slot already armed" code can't happen here (armed
    // would be non-null). Generic-loan reasons get a shared message
    // so the TP and SL rows don't duplicate the same line.
    if (reason === "take_profit_already_armed" || reason === "stop_loss_already_armed") {
      return null; // already covered by the armed branch above
    }
    // Hide the V4-locked explainer entirely on V1/V2/V3 loans
    // (operator-mandated 2026-06-17 PM —
    // feedback_v4_locked_explainer_must_not_appear_on_legacy_loans.md).
    // The user previously saw "exits live on V4. To use one, repay this
    // loan and re-open the borrow…" as a regression on every plain
    // (non-V4) borrow. That message is information, not an option, and
    // contradicts the rule "Exit strategies must NEVER appear as
    // options anywhere on V1/V2/V3 surfaces." Silent hide is the
    // correct behavior — the pre-borrow exit picker is the chosen
    // surface for setting exits.
    if (reason === "exits_require_v4_loan") {
      return null;
    }
    return (
      <div className="text-[11px] text-[var(--d-ink-faint)]">
        <span className="opacity-70">{slotLabel}:</span>{" "}
        <span>{reasonToLabel(reason)}</span>
      </div>
    );
  }

  // Armed → show + cancel
  if (armed) {
    const trig = formatTrigger(armed.trigger_kind, armed.trigger_value_micro);
    // Distance label: how far the current price is from the trigger.
    // Only meaningful for price_usd / mc_usd — price_sol's denominator
    // moves and the headline number isn't directly comparable.
    let distanceLabel: string | null = null;
    if (currentUsd != null && currentUsd > 0 && armed.trigger_kind === "price_usd") {
      const triggerUsd = Number(armed.trigger_value_micro) / 1e6;
      if (Number.isFinite(triggerUsd) && triggerUsd > 0) {
        const pctMove = ((triggerUsd - currentUsd) / currentUsd) * 100;
        distanceLabel = `${formatPctMove(pctMove)} from current`;
      }
    }
    return (
      <div className="rounded-md border px-2.5 py-1.5 text-[11px]"
        style={{
          borderColor: armedBorderColor,
          background: armedBg,
          color: "var(--d-ink)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span>
            <span className="font-medium">
              {armed.trailing_distance_bps != null
                ? `Trailing ${(armed.trailing_distance_bps / 100).toFixed(1)}%`
                : `${slotLabel} armed`}
            </span>
            <span className="opacity-70"> · {trig} · slip {(armed.slippage_bps / 100).toFixed(1)}%</span>
            {armed.trailing_distance_bps != null && armed.peak_price_micros && (
              <span className="opacity-70"> · peak {(() => {
                const peak = Number(armed.peak_price_micros) / 1e6;
                if (peak >= 1) return `$${peak.toFixed(4)}`;
                if (peak >= 0.01) return `$${peak.toFixed(6)}`;
                return `$${peak.toFixed(8)}`;
              })()}</span>
            )}
            {distanceLabel && <span className="opacity-70"> · {distanceLabel}</span>}
            {armed.source !== "site" && (
              <span className="opacity-50"> · via {armed.source === "tg" ? "Telegram" : "agent"}</span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <button
                onClick={() => {
                  setEditing(true);
                  setError(null);
                  // Seed the form with current values so the user can
                  // see what they're editing and tweak from there.
                  if (armed.trigger_kind === "price_usd") {
                    const usd = Number(armed.trigger_value_micro) / 1e6;
                    setEditPriceUsd(Number.isFinite(usd) ? String(usd) : "");
                  }
                  setEditSlippagePct(armed.slippage_bps / 100);
                }}
                disabled={busy}
                className="text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
              >
                Edit
              </button>
            )}
            <button
              onClick={cancel}
              disabled={busy}
              className="text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
            >
              {busy ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        </div>
        {editing && (
          <div className="mt-2 border-t pt-2"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            {armed.trigger_kind === "price_usd" && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] opacity-60 w-14">Price $</span>
                <input
                  type="number"
                  step="any"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  disabled={busy}
                  className="flex-1 max-w-[140px] bg-transparent border-b border-[var(--d-border)] text-[12px] py-0.5 focus:outline-none focus:border-current"
                />
                <span className="text-[10px] opacity-60">/ token</span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] opacity-60 w-14">Slip</span>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={editSlippagePct ?? armed.slippage_bps / 100}
                onChange={(e) => setEditSlippagePct(Number(e.target.value))}
                disabled={busy}
                className="flex-1"
                style={{ accentColor: "var(--d-accent)" }}
              />
              <span className="text-[11px] tabular-nums w-10 text-right">
                {(editSlippagePct ?? armed.slippage_bps / 100).toFixed(1)}%
              </span>
            </div>
            {/* Trailing distance editor — only renders when the armed
              * order is a trailing stop. The bot's modify path supports
              * Trailing: <bps> for live retuning; first-time enabling
              * trailing on a fixed SL goes through the arm form, not
              * the edit panel, because it requires a fresh peak seed. */}
            {armed.trailing_distance_bps != null && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] opacity-60 w-14">Trail</span>
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={editTrailingPct ?? armed.trailing_distance_bps / 100}
                  onChange={(e) => setEditTrailingPct(Number(e.target.value))}
                  disabled={busy}
                  className="flex-1"
                  style={{ accentColor: "var(--d-accent)" }}
                />
                <span className="text-[11px] tabular-nums w-10 text-right">
                  {(editTrailingPct ?? armed.trailing_distance_bps / 100).toFixed(1)}%
                </span>
              </div>
            )}
            {error && (
              <div className="text-[10px] mb-1.5 rounded px-1.5 py-1"
                style={{ background: "rgba(220,38,38,0.08)", color: "var(--bad, #ef4444)" }}
              >
                {error}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={modify}
                disabled={busy}
                className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                style={{
                  background: armColor,
                  color: "var(--d-bg-panel, white)",
                  borderColor: armColor,
                }}
              >
                {busy ? "Signing…" : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditPriceUsd("");
                  setEditSlippagePct(null);
                  setEditTrailingPct(null);
                  setError(null);
                }}
                disabled={busy}
                className="text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not armed + eligible → CTA / form
  if (!expanded) {
    const hint = isSl
      ? "auto-close + sell if it drops to your floor"
      : "auto-close + sell when it hits your target";
    return (
      <div>
        <button
          onClick={() => setExpanded(true)}
          className="text-[11px] font-medium hover:underline"
          style={{ color: armColor }}
        >
          {slotVerb} →
        </button>
        {props.collateralSymbol && (
          <span className="text-[11px] text-[var(--d-ink-faint)]"> {hint}</span>
        )}
      </div>
    );
  }

  const multLabelSuffix = isSl ? " × current" : "× current";
  const customPlaceholder = isSl ? "floor (e.g. 0.0009)" : "0.0025";

  return (
    <div className="rounded-md border p-2.5"
      style={{
        borderColor: "var(--d-border)",
        background: "var(--d-bg-elevated, var(--d-bg-panel))",
      }}
    >
      <div className="text-[11px] font-medium mb-1.5 flex items-center justify-between">
        <span>{slotLabel} — {trailingEnabled && isSl ? "auto-close + sell if price retraces from peak by:" : (isSl ? "auto-close + sell if price drops to:" : "auto-close + sell when:")}</span>
        <button
          onClick={() => { setExpanded(false); setError(null); }}
          className="text-[10px] opacity-60 hover:opacity-100"
        >
          dismiss
        </button>
      </div>
      {/* Trailing-stop toggle — SL slots only. When on, the form
          switches to a distance picker (% from peak) and hides the
          fixed-floor presets + custom USD input. */}
      {isSl && (
        <div className="mb-2 flex items-center gap-2 text-[10px]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={trailingEnabled}
              onChange={(e) => { setTrailingEnabled(e.target.checked); if (e.target.checked) setLadderEnabled(false); }}
              disabled={busy || ladderEnabled}
              className="accent-current"
              style={{ accentColor: armColor }}
            />
            <span className="font-medium">Trailing stop</span>
          </label>
          <span className="opacity-60">— floats with peak as price climbs</span>
        </div>
      )}
      {/* Ladder toggle — multi-leg partial sells at different strikes. */}
      <div className="mb-2 flex items-center gap-2 text-[10px]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={ladderEnabled}
            onChange={(e) => { setLadderEnabled(e.target.checked); if (e.target.checked) setTrailingEnabled(false); }}
            disabled={busy || (isSl && trailingEnabled)}
            className="accent-current"
            style={{ accentColor: armColor }}
          />
          <span className="font-medium">Ladder (multi-leg)</span>
        </label>
        <span className="opacity-60">— sell portions at 2–6 different prices</span>
      </div>
      {/* When ladder mode is on, render the dedicated panel and skip
          all other inputs. The LadderPanel signs N envelopes when the
          user clicks "Arm N legs". */}
      {ladderEnabled && (
        <LadderPanel
          botApiUrl={props.botApiUrl}
          loanIdChain={props.loanIdChain}
          isSl={isSl}
          accentColor={armColor}
          slippagePct={slippagePct}
          onArmed={() => { setLadderEnabled(false); setExpanded(false); props.onMutated(); }}
          onCancel={() => setLadderEnabled(false)}
          existingArmedSlicePct={
            // Sum slice% across already-armed orders on this loan/direction
            // so the LadderPanel's cap reflects the true 100% budget the
            // server enforces. Without this the user could draft a 70%
            // leg, sign Phantom, and then hit slice_overflow.
            props.orders
              .filter(
                (o) =>
                  Number(o.loan_id) === Number(props.loanDbId) &&
                  (o.trigger_direction ?? "above") === props.direction &&
                  o.status === "armed",
              )
              .reduce((acc, o) => acc + (o.slice_pct ?? 10000) / 100, 0)
          }
        />
      )}
      {/* Fixed-floor presets + custom USD: hidden when trailing or
          ladder mode is on since they're conceptually incompatible. */}
      {!(isSl && trailingEnabled) && !ladderEnabled && (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {slotPresets.map((m) => (
          <button
            key={m}
            onClick={() => { setSelectedMultiplier(m); setCustomUsd(""); }}
            disabled={busy}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              !customUsd && selectedMultiplier === m
                ? "border-current"
                : "border-[var(--d-border)] text-[var(--d-ink-faint)] hover:text-[var(--d-ink)]"
            }`}
            style={{
              color: !customUsd && selectedMultiplier === m ? armColor : undefined,
              background: !customUsd && selectedMultiplier === m
                ? (isSl ? "rgba(220,38,38,0.10)" : "rgba(34,197,94,0.10)")
                : undefined,
            }}
          >
            {m}{multLabelSuffix}
          </button>
        ))}
      </div>
      )}
      {!(isSl && trailingEnabled) && !ladderEnabled && (
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-60">or type a target</span>
          <input
            type="text"
            placeholder={isSl ? "$0.005 · 5M mc · down 30% · 0.7x" : "$0.01 · 17M mc · 2x · +50%"}
            value={customUsd}
            onChange={(e) => setCustomUsd(e.target.value)}
            disabled={busy}
            className="flex-1 bg-transparent border-b border-[var(--d-border)] text-[12px] py-0.5 focus:outline-none focus:border-current"
            style={{ borderColor: customUsd ? armColor : undefined }}
          />
        </div>
        {/* Inline parse preview — when user has typed anything that
            looks like a strike, run it through the shared parser
            (byte-equivalent to TG /tp + Pip target_text) and show
            "Got it: $17M MC" or the parse error. Pure feedback —
            doesn't enforce, the arm path re-parses authoritatively. */}
        {customUsd.trim() && (() => {
          // Lazy import via dynamic require would block SSR; use top-level import.
          // (Added at file top — see import { parseStrike } above.)
          const r = parseStrikePreview(customUsd, isSl);
          return (
            <div className="text-[10px] pl-2" style={{ color: r.ok ? armColor : "var(--d-bad)" }}>
              {r.ok ? `Got it: ${r.display}` : r.error}
            </div>
          );
        })()}
      </div>
      )}
      {/* Trailing distance picker: percentage from peak. Replaces the
          fixed-floor presets when trailing is enabled. */}
      {isSl && trailingEnabled && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] opacity-60 w-20">Trail by</span>
          <input
            type="range"
            min="0.5"
            max="50"
            step="0.5"
            value={trailingPct}
            onChange={(e) => setTrailingPct(Number(e.target.value))}
            disabled={busy}
            className="flex-1"
            style={{ accentColor: armColor }}
          />
          <span className="text-[11px] tabular-nums w-12 text-right" style={{ color: armColor }}>
            {trailingPct.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] opacity-60">Slippage</span>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={slippagePct}
          onChange={(e) => setSlippagePct(Number(e.target.value))}
          disabled={busy}
          className="flex-1"
          style={{ accentColor: "var(--d-accent)" }}
        />
        <span className="text-[11px] tabular-nums w-10 text-right">{slippagePct.toFixed(1)}%</span>
      </div>
      {/* Ladder mode owns its own preview + arm UI; skip the single-leg
          machinery below entirely so the slot doesn't render a stale
          single-target preview alongside the ladder picker. */}
      {ladderEnabled ? null : (<>
      {/* ── Pre-arm preview ──
          Computes the resolved target USD from either the selected
          multiplier (× current) or the custom USD input, then shows
          "current ~$X → fires at $Y (Z%)" so the user sees both
          numbers before signing. Catches the "I picked 0.5× but
          actually wanted 0.95×" mistake at the form, not at fire-
          time. Hidden when we don't have a price OR the trigger is
          on the wrong side of current (the arm endpoint will reject
          and the error block below renders the message). */}
      {currentUsd != null && currentUsd > 0 && (() => {
        // Trailing case: starting "trigger" is current × (1 - trailing/100).
        // Show it as the floor that would apply RIGHT NOW; the floor
        // rises as the watcher tracks new peaks post-arm.
        if (isSl && trailingEnabled) {
          const initialFloor = currentUsd * (1 - trailingPct / 100);
          return (
            <div className="text-[10px] mb-1.5 rounded px-1.5 py-1 leading-tight"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--d-ink-faint)",
              }}
            >
              <div>Current ~ {formatUsdPerToken(currentUsd)}/token</div>
              <div>
                Initial floor at {formatUsdPerToken(initialFloor)} (-{trailingPct.toFixed(1)}% from current).
                Floor rises with each new high; fires when price retraces {trailingPct.toFixed(1)}% from peak.
              </div>
            </div>
          );
        }
        const usd = customUsd ? Number(customUsd) : null;
        const targetUsd =
          usd && usd > 0 ? usd : currentUsd * selectedMultiplier;
        if (!Number.isFinite(targetUsd) || targetUsd <= 0) return null;
        const pctMove = ((targetUsd - currentUsd) / currentUsd) * 100;
        // Wrong-side warning: TP must be > current, SL must be < current.
        const wrongSide =
          (isSl && targetUsd >= currentUsd) ||
          (!isSl && targetUsd <= currentUsd);
        const fireText = `Fires at ${formatUsdPerToken(targetUsd)} (${formatPctMove(pctMove)})`;
        const currentText = `Current ~ ${formatUsdPerToken(currentUsd)}/token`;
        return (
          <div className="text-[10px] mb-1.5 rounded px-1.5 py-1 leading-tight"
            style={{
              background: wrongSide
                ? "rgba(220,38,38,0.08)"
                : "rgba(255,255,255,0.04)",
              color: wrongSide ? "var(--bad, #ef4444)" : "var(--d-ink-faint)",
            }}
          >
            <div>{currentText}</div>
            <div className={wrongSide ? "font-medium" : ""}>
              {wrongSide
                ? `${isSl ? "Stop-loss" : "Take-profit"} must fire ${isSl ? "below" : "above"} current — your target is on the wrong side. Adjust the price or switch slots.`
                : fireText}
            </div>
          </div>
        );
      })()}
      {error && (() => {
        // Classify the arm error so we can show class-specific cleanup
        // steps instead of a generic line. Operator-mandated 2026-06-15
        // PM: arming errors must be unmissable and actionable, because
        // a silent failure means a strike that should have sold doesn't.
        const m = error.toLowerCase();
        const cls =
          /method.*not.*authorized|account.*not.*authorized|wallet.*session/i.test(m)
            ? "phantom_session" as const
            : /user rejected|rejected the request|user declined|cancel.*sign/i.test(m)
              ? "user_rejected" as const
              : /fetch failed|network|timeout|ECONNRESET|502|503|504/i.test(m)
                ? "network" as const
                : "other" as const;
        const title =
          cls === "phantom_session" ? "Phantom session needs a reset"
          : cls === "user_rejected" ? "You rejected the Phantom popup"
          : cls === "network" ? "Network blip"
          : "Couldn't arm";
        const action =
          cls === "phantom_session"
            ? "Open Phantom → Settings → Trusted Apps → find magpie.capital → Revoke, then reload this page and reconnect. Then click Arm again."
            : cls === "user_rejected"
              ? "Click Arm again — approve the Phantom signature this time."
              : cls === "network"
                ? "Click Arm again — already-saved fields are kept."
                : "Try again; if it keeps failing, message support with this error.";
        return (
          <div
            role="alert"
            className="mt-2 mb-2 rounded-lg border-2 p-2.5 flex items-start gap-2"
            style={{
              background: "rgba(220,38,38,0.10)",
              borderColor: "rgba(220,38,38,0.55)",
              color: "var(--d-ink)",
            }}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgb(220,38,38)" strokeWidth="2.25" strokeLinecap="round"
              strokeLinejoin="round" className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1 min-w-0 text-[11px] leading-snug">
              <div className="font-semibold mb-0.5" style={{ color: "rgb(220,38,38)" }}>
                {title}
              </div>
              <div className="opacity-90">{action}</div>
              <div className="mt-1 text-[10px] opacity-60 truncate">
                Details: {error.slice(0, 120)}
              </div>
            </div>
          </div>
        );
      })()}
      <button
        onClick={arm}
        disabled={busy}
        className="w-full text-[11px] font-medium py-1.5 rounded transition-opacity disabled:opacity-50"
        style={{
          background: armColor,
          color: "var(--d-bg-panel, white)",
        }}
      >
        {busy ? "Signing…" : `Arm ${isSl ? "downside" : "upside"} auto-sell`}
      </button>
      </>)}
      <div className="mt-1.5 text-[10px] opacity-60 leading-tight">
        {isSl
          ? "I'll repay your loan + sell the collateral the moment price drops to your floor. 1% protocol fee on proceeds. You can cancel any time."
          : "I'll repay your loan + sell the collateral the moment the trigger hits. 1% protocol fee on proceeds. You can cancel any time."}
      </div>
    </div>
  );
}

/* ───────────────── helpers ───────────────── */

function formatTrigger(kind: string, valueMicro: string): string {
  const n = Number(valueMicro);
  if (kind === "mc_usd") {
    const usd = n / 1e6;
    if (usd >= 1e9) return `MC $${(usd / 1e9).toFixed(2)}B`;
    if (usd >= 1e6) return `MC $${(usd / 1e6).toFixed(2)}M`;
    if (usd >= 1e3) return `MC $${(usd / 1e3).toFixed(2)}K`;
    return `MC $${usd.toFixed(2)}`;
  }
  if (kind === "price_usd") {
    const usd = n / 1e6;
    return `$${usd < 0.01 ? usd.toFixed(8) : usd < 1 ? usd.toFixed(6) : usd.toFixed(4)}/token`;
  }
  return `${(n / 1e9).toFixed(9)} SOL/token`;
}

function reasonToLabel(reason: string | undefined): string {
  switch (reason) {
    case "exits_require_v4_loan":
      // V4-exclusive policy (operator-mandated rule, permanent). Show
      // the explainer instead of letting the user click through to a
      // doomed sign + DM rejection cycle. The button is intentionally
      // not the "Set auto-sell" CTA elsewhere — this branch hides it.
      return "exits live on V4. To use one, repay this loan and re-open the borrow with an exit selected — the new loan will land on V4 automatically.";
    case "loan_below_minimum_size":
      return "this loan is below the 1 SOL limit-order minimum.";
    case "collateral_not_enabled":
      return "this collateral isn't currently enabled in the protocol.";
    case "rwa_collateral_not_supported_in_v1":
      // Unreachable since 2026-06-13 (bot PR #161 flipped the gate +
      // engine PR #16 shipped V2 fill path). Kept defensively in the
      // switch with a retry-prompt — a stale agent SDK or cached
      // client could still bubble this code.
      return "limit-close on this collateral is now live — please reload + try again.";
    case "loan_already_has_active_order":
    case "take_profit_already_armed":
    case "stop_loss_already_armed":
      return "another order is already armed on this loan.";
    default:
      return reason ? `ineligible (${reason}).` : "not eligible.";
  }
}

/* ────────────────────────────────────────────────────────────────
 * Provider hook — fetches state once, exposes refresh + poll
 *
 * Lifted up to the dashboard root so we don't fire N requests when
 * there are N loans (one per card). Parent passes the slice down.
 * ──────────────────────────────────────────────────────────────── */

export function useTakeProfitState(botApiUrl: string, wallet: string | null) {
  const [state, setState] = useState<TakeProfitState | null>(null);
  const [_loading, setLoading] = useState(false);

  const fetchOnce = useCallback(async () => {
    if (!wallet) { setState(null); return; }
    setLoading(true);
    try {
      const s = await fetchTakeProfitState({ botApiUrl, wallet });
      setState(s);
    } catch {
      // keep last good — never throw inside the dashboard render tree
    } finally {
      setLoading(false);
    }
  }, [botApiUrl, wallet]);

  // Derive active-vs-idle from current state. Any armed/firing class
  // status anywhere in the user's portfolio drops the cadence to 5s
  // so a fire surfaces fast. Idle reverts to 60s.
  const hasActiveOrders = useMemo(() => {
    if (!state?.orders) return false;
    return state.orders.some(
      (o) =>
        o.status === "armed" ||
        o.status === "firing" ||
        o.status === "twap_in_progress" ||
        o.status === "awaiting_user",
    );
  }, [state?.orders]);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    let id: ReturnType<typeof setInterval> | null = null;
    fetchOnce();
    const cadence = hasActiveOrders ? POLL_MS_ACTIVE : POLL_MS_IDLE;
    id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!cancelled) fetchOnce();
    }, cadence);
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
    // hasActiveOrders is intentional in the dep list — when the user's
    // first order arms, the effect re-runs and the new 5s cadence kicks
    // in immediately. When all orders are repaid/fired/cancelled, we
    // automatically back off to 60s.
  }, [wallet, fetchOnce, hasActiveOrders]);

  return { state, refresh: fetchOnce };
}
