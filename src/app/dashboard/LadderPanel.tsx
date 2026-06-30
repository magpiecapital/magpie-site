"use client";

/**
 * LadderPanel — multi-leg ladder arming UI for the dashboard's
 * TakeProfitCard. Sits inside an expanded LimitSlot when the user
 * toggles "Ladder mode" on. Mobile-first; renders the same on
 * desktop + phone.
 *
 * UX contract:
 *   - 2–6 leg rows; each is {strike (free text), slice %}
 *   - Sum-of-slices indicator: progress bar + "X% of 100% used"
 *   - Smart presets: Conservative, Balanced, Aggressive — populate
 *     the legs based on direction (TP scales up, SL scales down)
 *   - "Arm N legs" button signs N envelopes sequentially; shows
 *     per-leg status (queued → signing → confirming → armed/failed)
 *   - First-leg failure cancels remaining legs and surfaces the reason
 *   - On full success: collapses + calls onArmed() so the parent
 *     refreshes its order list
 *
 * Cross-pool: each arm carries the loan's program_id implicitly via
 * the bot's arm-core (loan.program_id stamped into engine_program_id).
 * No site-side pool awareness needed.
 */

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { armTakeProfit, preflightArmTakeProfit } from "@/lib/solana/site-take-profit";
import { parseStrike } from "@/lib/strike-price-parser";

interface LegDraft {
  id: string;
  strikeText: string;
  slicePct: number; // 1..100
}

interface LegStatus {
  id: string;
  state: "queued" | "signing" | "submitting" | "arming" | "armed" | "failed";
  error?: string;
  orderId?: number;
}

interface Props {
  botApiUrl: string;
  loanIdChain: string;
  isSl: boolean;
  /** Color the parent passed for visual cohesion with TP/SL pill */
  accentColor: string;
  slippagePct: number;
  /** Called once after all legs arm successfully so parent can refetch */
  onArmed: () => void;
  /** Called when user cancels back to single-leg mode */
  onCancel: () => void;
  /**
   * Cumulative slice% already armed on this loan in this direction
   * (sum of slice_pct across status='armed' orders matching direction).
   * Used to pre-bound the local ladder so the new legs + already-armed
   * legs <= 100%. Prevents the server-side `slice_overflow` rejection
   * that's caught at preflight but wastes a click.
   * Operator-mandated client-side validation, 2026-06-16 PM.
   */
  existingArmedSlicePct?: number;
}

const PRESETS = [
  { label: "Conservative", slices: [70, 20, 10] },
  { label: "Balanced",     slices: [50, 30, 20] },
  { label: "Aggressive",   slices: [30, 30, 20, 10, 10] },
];

function newLeg(slice = 50): LegDraft {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `leg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    strikeText: "",
    slicePct: slice,
  };
}

export function LadderPanel(props: Props) {
  const { publicKey, signMessage } = useWallet();
  const [legs, setLegs] = useState<LegDraft[]>(() => [newLeg(70), newLeg(30)]);
  const [statuses, setStatuses] = useState<Record<string, LegStatus["state"]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const existingArmed = Math.max(0, Math.min(100, props.existingArmedSlicePct ?? 0));
  const localTotal = useMemo(
    () => legs.reduce((acc, l) => acc + (Number.isFinite(l.slicePct) ? l.slicePct : 0), 0),
    [legs],
  );
  const totalSlice = localTotal + existingArmed;
  // Budget includes already-armed legs on this loan/direction. The DB
  // trigger checks cumulative slice across armed orders, so the
  // client-side cap must too — otherwise the user wastes a Phantom
  // sign on a leg the server will reject with `slice_overflow`.
  const sumOk = localTotal > 0 && totalSlice <= 100.0001;

  // Per-leg parse results — drives live preview + arm-button enablement.
  const parsedPerLeg = useMemo(
    () => legs.map((l) => {
      if (!l.strikeText.trim()) return { ok: false as const, error: "empty" };
      const r = parseStrike(l.strikeText, { bareNumberDefaultKind: props.isSl ? "price_usd" : undefined });
      if (!r.ok) return { ok: false as const, error: r.error };
      if (r.impliedDirection && ((props.isSl && r.impliedDirection === "above") || (!props.isSl && r.impliedDirection === "below"))) {
        return {
          ok: false as const,
          error: r.impliedDirection === "above"
            ? "Upside target — switch slot to Take-Profit."
            : "Downside target — switch slot to Stop-Loss.",
        };
      }
      return { ok: true as const, kind: r.kind, usd: r.kind === "mc_usd" || r.kind === "price_usd" ? Number(r.valueMicro!) / 1e6 : null, multiplier: r.multiplier, display: r.normalizedDisplay };
    }),
    [legs, props.isSl],
  );

  const allParseOk = parsedPerLeg.every((p) => p.ok);
  const canArm = !busy && sumOk && allParseOk && publicKey && signMessage;

  const updateLeg = useCallback((id: string, patch: Partial<LegDraft>) => {
    setLegs((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const removeLeg = useCallback((id: string) => {
    setLegs((prev) => prev.length <= 2 ? prev : prev.filter((l) => l.id !== id));
  }, []);

  const addLeg = useCallback(() => {
    setLegs((prev) => {
      if (prev.length >= 6) return prev;
      // Default the new leg to whatever budget remains, capped at 25%
      // so user can always add another after if they want more. Budget
      // accounts for already-armed legs (existingArmed) so we don't
      // overshoot the cumulative 100% cap.
      const localUsed = prev.reduce((a, l) => a + l.slicePct, 0);
      const budgetRemaining = Math.max(0, 100 - existingArmed - localUsed);
      const remaining = Math.max(1, Math.min(25, budgetRemaining));
      return [...prev, newLeg(remaining)];
    });
  }, [existingArmed]);

  const applyPreset = useCallback((slices: number[]) => {
    setLegs((prev) => slices.map((s, i) => ({
      id: prev[i]?.id ?? newLeg(s).id,
      strikeText: prev[i]?.strikeText ?? "",
      slicePct: s,
    })));
  }, []);

  // Resume state — when a leg fails, we remember the index so a "Retry
  // from leg N" button can pick up without re-signing already-armed legs.
  const [failedAtIndex, setFailedAtIndex] = useState<number | null>(null);

  // Classify an error so the UI can show the right cleanup steps.
  // Operator-mandated 2026-06-15: arm errors must be unmissable and
  // actionable. Phantom session errors get explicit revoke instructions.
  const classifyArmError = (msg: string): "phantom_session" | "user_rejected" | "network" | "other" => {
    const m = msg.toLowerCase();
    if (/method.*not.*authorized|account.*not.*authorized|wallet.*session/i.test(m)) {
      return "phantom_session";
    }
    if (/user rejected|rejected the request|user declined|cancel.*sign/i.test(m)) {
      return "user_rejected";
    }
    if (/fetch failed|network|timeout|ECONNRESET|502|503|504/i.test(m)) {
      return "network";
    }
    return "other";
  };

  const armAll = useCallback(async (_startIndex: number = 0) => {
    // Operator-mandated 2026-06-16 PM (feedback_one_signature_for_n_
    // legs_always.md): ALL N legs arm via a SINGLE batch envelope and
    // ONE Phantom signature. No more sequential signMessage loop —
    // that was the root cause of every silent-leg-drop UX disaster.
    // _startIndex preserved for caller compat but ignored: batches
    // are atomic, so "resume from leg N" doesn't make sense anymore.
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setTopError(null);
    setFailedAtIndex(null);
    setErrors({});
    setStatuses(Object.fromEntries(legs.map((l) => [l.id, "queued"])));

    // Pre-validate all legs locally before asking Phantom for anything.
    // Any parse failure halts the batch — no point signing if a leg's
    // strike is unparseable.
    const legSpecs: import("@/lib/solana/site-take-profit").ArmBatchLegSpec[] = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const parsed = parsedPerLeg[i];
      if (!parsed.ok) {
        setErrors((e) => ({ ...e, [leg.id]: parsed.error }));
        setStatuses((s) => ({ ...s, [leg.id]: "failed" }));
        setTopError(`Leg ${i + 1}: ${parsed.error}. Fix the strike and try again.`);
        setFailedAtIndex(i);
        setBusy(false);
        return;
      }
      let kind: "price_usd" | "mc_usd" | "price_sol";
      let value: number;
      if (parsed.kind === "multiplier" && parsed.multiplier != null) {
        // The bot's arm-core handles multiplier→price resolution per
        // leg server-side. For batch wire format we send it as
        // price_usd because the bot resolves multipliers at single-
        // arm time only. For now, refuse multiplier inputs in the
        // batch path — they're rare in this UI which uses literal
        // strikes. Falls back to single-arm if/when a future picker
        // routes multipliers here.
        setErrors((e) => ({ ...e, [leg.id]: "multiplier strikes not supported in batch UI yet" }));
        setStatuses((s) => ({ ...s, [leg.id]: "failed" }));
        setTopError(`Leg ${i + 1}: multiplier strikes require single-leg arm. Use price_usd or mc_usd in the strike field.`);
        setFailedAtIndex(i);
        setBusy(false);
        return;
      } else if (parsed.kind === "mc_usd" && parsed.usd != null) {
        kind = "mc_usd";
        value = parsed.usd;
      } else if (parsed.kind === "price_usd" && parsed.usd != null) {
        kind = "price_usd";
        value = parsed.usd;
      } else {
        setErrors((e) => ({ ...e, [leg.id]: "unsupported strike kind" }));
        setStatuses((s) => ({ ...s, [leg.id]: "failed" }));
        setFailedAtIndex(i);
        setBusy(false);
        return;
      }
      legSpecs.push({
        direction: (props.isSl ? "below" : "above") as "above" | "below",
        kind,
        value,
        sliceBps: Math.round(leg.slicePct * 100),
        slippageBps: Math.round(props.slippagePct * 100),
      });
    }

    // All legs valid — flip every status to signing (single Phantom
    // popup is about to open for all of them at once).
    setStatuses(Object.fromEntries(legs.map((l) => [l.id, "signing"])));
    try {
      const { armTakeProfitBatch } = await import("@/lib/solana/site-take-profit");
      const result = await armTakeProfitBatch({
        botApiUrl: props.botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        loanIdChain: props.loanIdChain,
        legs: legSpecs,
      });
      // Tier-2 race-tolerant path
      // (feedback_loan_830_full_postmortem_and_defenses.md, defense C):
      // server queued the arm because the borrow's DB-write hadn't
      // landed yet. Background watcher replays every 10s while the
      // signature is fresh (5 min). UI: show "Arming…" and let the
      // dashboard's own poll loop flip to armed once orders appear.
      // No banner, no failure copy — the signature is still valid.
      const next: Record<string, LegStatus["state"]> = {};
      if (result.pending) {
        for (let i = 0; i < legs.length; i++) {
          next[legs[i].id] = "arming";
        }
        setStatuses(next);
        setBusy(false);
        props.onArmed();
        return;
      }
      // Atomic success — every leg gets an order id.
      for (let i = 0; i < legs.length; i++) {
        next[legs[i].id] = "armed";
      }
      setStatuses(next);
      setBusy(false);
      void result;
      props.onArmed();
    } catch (err) {
      // Atomic failure — NO orders were inserted.
      const msg = err instanceof Error ? err.message : String(err);
      const cls = classifyArmError(msg);
      const next: Record<string, LegStatus["state"]> = {};
      for (const leg of legs) next[leg.id] = "failed";
      setStatuses(next);
      // Surface a SINGLE top banner explaining what to do — class-
      // aware so the user knows whether it's their Phantom session,
      // their rejection, or a server-side issue.
      if (cls === "phantom_session") {
        setTopError(
          "Phantom session is stale. Open Phantom → Settings → Trusted Apps → find magpie.capital → Revoke, " +
          "then reload this page and reconnect. Re-click \"Arm N legs\" after that.",
        );
      } else if (cls === "user_rejected") {
        setTopError(
          "You rejected the Phantom popup. Click \"Arm N legs\" again — approve the signature this time.",
        );
      } else if (cls === "network") {
        setTopError(`Network blip (${msg.slice(0, 80)}). No legs were armed. Try again.`);
      } else {
        setTopError(`Batch arm failed: ${msg.slice(0, 200)}. No legs were armed.`);
      }
      setFailedAtIndex(0);
      setBusy(false);
    }
  }, [legs, parsedPerLeg, publicKey, signMessage, props]);

  const remaining = Math.max(0, 100 - totalSlice);

  return (
    <div className="mt-2 p-3 rounded-lg" style={{ background: "var(--d-bg-elevated)", border: "1px solid var(--d-border)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: props.accentColor }}>
          Ladder ({legs.length} {legs.length === 1 ? "leg" : "legs"})
        </div>
        <button
          type="button"
          onClick={props.onCancel}
          disabled={busy}
          className="text-[10px] underline opacity-60 hover:opacity-100"
        >
          back to single leg
        </button>
      </div>

      {/* Presets row */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.slices)}
            disabled={busy}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{ borderColor: "var(--d-border)" }}
          >
            {p.label} ({p.slices.join("/")})
          </button>
        ))}
      </div>

      {/* Leg rows */}
      <div className="flex flex-col gap-1.5">
        {legs.map((leg, i) => {
          const p = parsedPerLeg[i];
          const st = statuses[leg.id];
          return (
            <div
              key={leg.id}
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 p-2 rounded"
              style={{
                background: st === "armed" ? "rgba(34,197,94,0.06)" : st === "failed" ? "rgba(220,38,38,0.06)" : "var(--d-bg)",
                border: "1px solid var(--d-border)",
              }}
            >
              <span className="text-[10px] w-5 font-mono opacity-60 text-center shrink-0">{i + 1}</span>
              <input
                type="text"
                value={leg.strikeText}
                onChange={(e) => updateLeg(leg.id, { strikeText: e.target.value })}
                placeholder={props.isSl ? "$0.005 · 5M mc · 0.7x" : "$0.01 · 17M mc · 2x"}
                disabled={busy}
                className="flex-1 min-w-0 bg-transparent text-base sm:text-[12px] py-0.5 px-1 border-b border-[var(--d-border)] focus:outline-none focus:border-current"
                style={{ borderColor: p.ok ? props.accentColor : undefined }}
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={leg.slicePct}
                  onChange={(e) => updateLeg(leg.id, { slicePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  disabled={busy}
                  className="w-12 bg-transparent text-base sm:text-[12px] py-0.5 px-1 border-b border-[var(--d-border)] focus:outline-none focus:border-current tabular-nums text-right"
                />
                <span className="text-[10px] opacity-60">%</span>
                {legs.length > 2 && !busy && (
                  <button
                    type="button"
                    onClick={() => removeLeg(leg.id)}
                    className="text-[12px] w-5 h-5 leading-none opacity-50 hover:opacity-100"
                    title="Remove this leg"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* Status badge or parse error */}
              {st === "signing" && <span className="text-[10px] opacity-70">signing…</span>}
              {st === "submitting" && <span className="text-[10px] opacity-70">arming…</span>}
              {st === "arming" && <span className="text-[10px] opacity-70">arming… (waiting for borrow to land)</span>}
              {st === "armed" && <span className="text-[10px]" style={{ color: "var(--d-good)" }}>arm landed</span>}
              {st === "failed" && <span className="text-[10px]" style={{ color: "var(--d-bad)" }}>failed</span>}
              {!st && p.ok && <span className="text-[10px] opacity-70">{p.display}</span>}
              {!st && !p.ok && leg.strikeText.trim() && <span className="text-[10px]" style={{ color: "var(--d-bad)" }}>{p.error}</span>}
              {errors[leg.id] && <span className="text-[10px] truncate" style={{ color: "var(--d-bad)" }}>{errors[leg.id].slice(0, 80)}</span>}
            </div>
          );
        })}
      </div>

      {/* Add leg + sum indicator */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <button
          type="button"
          onClick={addLeg}
          disabled={busy || legs.length >= 6 || totalSlice >= 100}
          className="text-[11px] px-2 py-1 rounded border"
          style={{ borderColor: "var(--d-border)" }}
        >
          + Add leg
        </button>
        <div className="text-[11px] tabular-nums flex-1 text-right">
          <span style={{ color: sumOk ? "inherit" : "var(--d-bad)" }}>
            {totalSlice.toFixed(0)}%
          </span>
          <span className="opacity-60"> of 100% used </span>
          {existingArmed > 0 && (
            <span className="opacity-50">
              (existing {existingArmed.toFixed(0)}% + new {localTotal.toFixed(0)}%)
            </span>
          )}
          {remaining > 0 && <span className="opacity-50"> · {remaining.toFixed(0)}% remaining</span>}
        </div>
      </div>

      {/* Sum progress bar */}
      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--d-border)" }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(100, totalSlice)}%`,
            background: sumOk ? props.accentColor : "var(--d-bad)",
          }}
        />
      </div>

      {topError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border-2 p-3 flex items-start gap-2.5"
          style={{
            background: "rgba(220,38,38,0.10)",
            borderColor: "rgba(220,38,38,0.55)",
            color: "var(--d-ink)",
          }}
        >
          {/* Warning icon — keeps the message unmissable even when the
              card is partially off-screen. */}
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="rgb(220,38,38)" strokeWidth="2.25" strokeLinecap="round"
            strokeLinejoin="round" className="shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1 min-w-0 text-[12px] leading-snug">
            <div className="font-semibold mb-1" style={{ color: "rgb(220,38,38)" }}>
              Arming stopped
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--d-ink)" }}>
              {topError}
            </div>
          </div>
        </div>
      )}

      {/* Retry-from-failed-leg CTA — keeps already-armed legs intact and
          resumes from the failed index. Critical UX so a partial ladder
          arm isn't a dead-end. Operator-mandated 2026-06-15. */}
      {failedAtIndex !== null && !busy && (
        <button
          type="button"
          onClick={() => armAll(failedAtIndex)}
          disabled={!publicKey || !signMessage}
          className="mt-2 w-full text-[12px] font-semibold py-2 rounded transition disabled:opacity-50"
          style={{
            background: "rgb(220,38,38)",
            color: "white",
          }}
        >
          Retry from leg {failedAtIndex + 1} ({legs.length - failedAtIndex} {legs.length - failedAtIndex === 1 ? "leg" : "legs"} remaining)
        </button>
      )}

      <button
        type="button"
        onClick={() => armAll(0)}
        disabled={!canArm}
        className="mt-2 w-full text-[12px] font-semibold py-1.5 rounded transition disabled:opacity-50"
        style={{
          background: canArm ? props.accentColor : "var(--d-border)",
          color: canArm ? "white" : "var(--d-ink-faint)",
        }}
      >
        {busy ? `Arming… (${Object.values(statuses).filter((s) => s === "armed").length}/${legs.length})` : `Arm ${legs.length} ${props.isSl ? "SL" : "TP"} ${legs.length === 1 ? "leg" : "legs"}`}
      </button>

      <div className="mt-1 text-[10px] opacity-55 leading-snug">
        Each leg signs a separate envelope. When triggered, the engine sells that leg's slice% of original collateral, sends you the proceeds, and re-borrows on the remainder so the other legs continue. 1% protocol fee per leg + borrow origination fee per re-borrow.
      </div>
    </div>
  );
}
