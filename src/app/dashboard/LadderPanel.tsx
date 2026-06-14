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
import { armTakeProfit } from "@/lib/solana/site-take-profit";
import { parseStrike } from "@/lib/strike-price-parser";

interface LegDraft {
  id: string;
  strikeText: string;
  slicePct: number; // 1..100
}

interface LegStatus {
  id: string;
  state: "queued" | "signing" | "submitting" | "armed" | "failed";
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

  const totalSlice = useMemo(
    () => legs.reduce((acc, l) => acc + (Number.isFinite(l.slicePct) ? l.slicePct : 0), 0),
    [legs],
  );
  const sumOk = totalSlice > 0 && totalSlice <= 100.0001;

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
      // so user can always add another after if they want more.
      const remaining = Math.max(1, Math.min(25, 100 - prev.reduce((a, l) => a + l.slicePct, 0)));
      return [...prev, newLeg(remaining)];
    });
  }, []);

  const applyPreset = useCallback((slices: number[]) => {
    setLegs((prev) => slices.map((s, i) => ({
      id: prev[i]?.id ?? newLeg(s).id,
      strikeText: prev[i]?.strikeText ?? "",
      slicePct: s,
    })));
  }, []);

  const armAll = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setTopError(null);
    setErrors({});
    setStatuses(Object.fromEntries(legs.map((l) => [l.id, "queued"])));

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const parsed = parsedPerLeg[i];
      if (!parsed.ok) {
        setErrors((e) => ({ ...e, [leg.id]: parsed.error }));
        setStatuses((s) => ({ ...s, [leg.id]: "failed" }));
        setTopError(`Leg ${i + 1}: ${parsed.error}. Stopped before signing.`);
        setBusy(false);
        return;
      }

      setStatuses((s) => ({ ...s, [leg.id]: "signing" }));
      try {
        // Build the target shape matching ArmTakeProfitRequest.
        const target =
          parsed.kind === "multiplier" && parsed.multiplier != null
            ? { kind: "multiplier" as const, multiplier: parsed.multiplier }
            : parsed.kind === "mc_usd" && parsed.usd != null
              ? { kind: "mc_usd" as const, mcDollars: parsed.usd }
              : parsed.kind === "price_usd" && parsed.usd != null
                ? { kind: "price_usd" as const, usd: parsed.usd }
                : null;
        if (!target) throw new Error("Unsupported strike kind");

        setStatuses((s) => ({ ...s, [leg.id]: "submitting" }));
        const armed = await armTakeProfit({
          botApiUrl: props.botApiUrl,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          request: {
            from: publicKey.toBase58(),
            loanIdChain: props.loanIdChain,
            direction: props.isSl ? "below" : "above",
            target,
            slippageBps: Math.round(props.slippagePct * 100),
            sellDestination: "sol",
            slicePctBps: Math.round(leg.slicePct * 100),
          },
        });
        setStatuses((s) => ({ ...s, [leg.id]: "armed" }));
        // Tag the order ID into state so the user sees a tiny confirmation
        // (already implicitly via "armed" state — the parent will refresh
        // and show the actual row).
        void armed;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [leg.id]: msg }));
        setStatuses((s) => ({ ...s, [leg.id]: "failed" }));
        setTopError(`Leg ${i + 1} failed: ${msg}. Remaining legs cancelled.`);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    props.onArmed();
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
                className="flex-1 min-w-0 bg-transparent text-[12px] py-0.5 px-1 border-b border-[var(--d-border)] focus:outline-none focus:border-current"
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
                  className="w-12 bg-transparent text-[12px] py-0.5 px-1 border-b border-[var(--d-border)] focus:outline-none focus:border-current tabular-nums text-right"
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
              {st === "armed" && <span className="text-[10px]" style={{ color: "var(--d-good)" }}>✓ armed</span>}
              {st === "failed" && <span className="text-[10px]" style={{ color: "var(--d-bad)" }}>✗ failed</span>}
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
          {remaining > 0 && <span className="opacity-50">· {remaining.toFixed(0)}% remaining</span>}
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
        <div className="mt-2 p-1.5 rounded text-[10px]" style={{ background: "rgba(220,38,38,0.08)", color: "var(--d-bad)" }}>
          {topError}
        </div>
      )}

      <button
        type="button"
        onClick={armAll}
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
