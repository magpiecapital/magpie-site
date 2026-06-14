"use client";

/**
 * TakeProfitCard — inline UI under each active loan that lets the
 * user arm OR cancel an autonomous take-profit ("limit-close") order.
 *
 * Behavior:
 *   - If wallet not custodial: render a thin CTA explaining the user
 *     needs a Magpie custodial keypair to enable take-profit. No arm
 *     form — the engine literally cannot fire without one.
 *   - If loan ineligible (size, already armed): show the reason. As of
 *     2026-06-13 RWA collateral is supported (bot PR #161 + engine
 *     PR #16); the rwa_collateral_not_supported_in_v1 case in the
 *     switch is kept defensively but unreachable.
 *   - If no order armed: collapsed CTA "Lock in upside" → expands to
 *     a small form with multiplier presets (1.5×, 2×, 3×, 5×) plus
 *     an explicit USD-price input.
 *   - If order armed: show trigger + slippage + Cancel button.
 *
 * Lives next to the Active Loans list on the dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchTakeProfitState, armTakeProfit, cancelTakeProfit,
  type TakeProfitOrder, type TakeProfitLoan, type TakeProfitState,
} from "@/lib/solana/site-take-profit";

const POLL_MS = 60_000;
const PRESET_MULTIPLIERS = [1.5, 2, 3, 5] as const;

interface Props {
  botApiUrl: string;
  loanIdChain: string;     // chain loan_id
  loanDbId: number;        // DB primary key — matches order.loan_id
  collateralSymbol: string | null;
  /** Lifted state — parent fetches once for all loans + passes the slice down */
  state: TakeProfitState | null;
  /** Called when the parent should refetch state (after arm/cancel) */
  onMutated: () => void;
}

export function TakeProfitCard(props: Props) {
  const { publicKey, signMessage } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = props.state?.linked ?? false;
  const custodial = props.state?.custodial ?? false;
  const loan = useMemo<TakeProfitLoan | null>(
    () => props.state?.loans.find((l) => l.id === props.loanDbId) ?? null,
    [props.state, props.loanDbId],
  );
  const armed = useMemo<TakeProfitOrder | null>(
    () =>
      props.state?.orders.find(
        (o) => o.loan_id === props.loanDbId && o.status === "armed",
      ) ?? null,
    [props.state, props.loanDbId],
  );

  /* ── Arm ── */

  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(2);
  const [customUsd, setCustomUsd] = useState<string>("");
  const [slippagePct, setSlippagePct] = useState<number>(2); // 2% default

  const arm = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Connect your wallet to set a take-profit.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const slippageBps = Math.round(slippagePct * 100);
      const usd = customUsd ? Number(customUsd) : null;
      const target =
        usd && usd > 0
          ? { kind: "price_usd" as const, usd }
          : { kind: "multiplier" as const, multiplier: selectedMultiplier };
      await armTakeProfit({
        botApiUrl: props.botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        request: {
          from: publicKey.toBase58(),
          loanIdChain: props.loanIdChain,
          target,
          slippageBps,
          sellDestination: "sol",
        },
      });
      setExpanded(false);
      props.onMutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    publicKey, signMessage, selectedMultiplier, customUsd, slippagePct,
    props.botApiUrl, props.loanIdChain, props,
  ]);

  /* ── Cancel ── */

  const cancel = useCallback(async () => {
    if (!publicKey || !signMessage || !armed) return;
    if (!confirm(`Cancel your take-profit on this loan?`)) return;
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
  }, [publicKey, signMessage, armed, props]);

  /* ── Render ── */

  // Loading sliver if state hasn't loaded yet
  if (!props.state) {
    return (
      <div className="mt-1.5 text-[11px] text-[var(--d-ink-faint)]">
        Loading take-profit state…
      </div>
    );
  }

  // Not linked or not custodial → CTA
  if (!linked || !custodial) {
    return (
      <div className="mt-2 text-[11px] text-[var(--d-ink-faint)]">
        <span className="opacity-70">Take-profit:</span>{" "}
        <span>
          {linked
            ? "needs a Magpie custodial keypair — connect via the Telegram bot to enable."
            : "link this wallet to a Magpie account to enable autonomous take-profit."}
        </span>
      </div>
    );
  }

  // Ineligible loan
  if (loan && !loan.is_eligible_for_takeprofit && !armed) {
    const reasonLabel = reasonToLabel(loan.ineligibility_reasons[0]);
    return (
      <div className="mt-2 text-[11px] text-[var(--d-ink-faint)]">
        <span className="opacity-70">Take-profit:</span>{" "}
        <span>{reasonLabel}</span>
      </div>
    );
  }

  // Armed → show + cancel
  if (armed) {
    const trig = formatTrigger(armed.trigger_kind, armed.trigger_value_micro);
    return (
      <div className="mt-2 rounded-md border px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2"
        style={{
          borderColor: "rgba(34,197,94,0.30)",
          background: "rgba(34,197,94,0.08)",
          color: "var(--d-ink)",
        }}
      >
        <span>
          <span className="font-medium">Take-profit armed</span>
          <span className="opacity-70"> · {trig} · slip {(armed.slippage_bps / 100).toFixed(1)}%</span>
          {armed.source !== "site" && (
            <span className="opacity-50"> · via {armed.source === "tg" ? "Telegram" : "agent"}</span>
          )}
        </span>
        <button
          onClick={cancel}
          disabled={busy}
          className="text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
        >
          {busy ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    );
  }

  // Not armed + eligible → CTA / form
  if (!expanded) {
    return (
      <div className="mt-2">
        <button
          onClick={() => setExpanded(true)}
          className="text-[11px] font-medium hover:underline"
          style={{ color: "var(--d-accent-deep, var(--d-accent))" }}
        >
          Set take-profit →
        </button>
        {props.collateralSymbol && (
          <span className="text-[11px] text-[var(--d-ink-faint)]"> auto-close + sell ${props.collateralSymbol} when it hits your target</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border p-2.5"
      style={{
        borderColor: "var(--d-border)",
        background: "var(--d-bg-elevated, var(--d-bg-panel))",
      }}
    >
      <div className="text-[11px] font-medium mb-1.5 flex items-center justify-between">
        <span>Take-profit — auto-close + sell when:</span>
        <button
          onClick={() => { setExpanded(false); setError(null); }}
          className="text-[10px] opacity-60 hover:opacity-100"
        >
          dismiss
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESET_MULTIPLIERS.map((m) => (
          <button
            key={m}
            onClick={() => { setSelectedMultiplier(m); setCustomUsd(""); }}
            disabled={busy}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              !customUsd && selectedMultiplier === m
                ? "border-[var(--d-accent)] text-[var(--d-accent)] bg-[var(--d-accent)]/10"
                : "border-[var(--d-border)] text-[var(--d-ink-faint)] hover:text-[var(--d-ink)]"
            }`}
          >
            {m}× current
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] opacity-60">or custom $</span>
        <input
          type="number"
          step="any"
          placeholder="0.0025"
          value={customUsd}
          onChange={(e) => setCustomUsd(e.target.value)}
          disabled={busy}
          className="flex-1 max-w-[120px] bg-transparent border-b border-[var(--d-border)] text-[12px] py-0.5 focus:outline-none focus:border-[var(--d-accent)]"
        />
        <span className="text-[10px] opacity-60">/ token</span>
      </div>
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
        />
        <span className="text-[11px] tabular-nums w-10 text-right">{slippagePct.toFixed(1)}%</span>
      </div>
      {error && (
        <div className="text-[10px] mb-1.5 rounded px-1.5 py-1"
          style={{ background: "rgba(220,38,38,0.08)", color: "var(--bad, #ef4444)" }}
        >
          {error}
        </div>
      )}
      <button
        onClick={arm}
        disabled={busy}
        className="w-full text-[11px] font-medium py-1.5 rounded transition-opacity disabled:opacity-50"
        style={{
          background: "var(--d-accent-deep, var(--d-accent))",
          color: "var(--d-bg-panel, white)",
        }}
      >
        {busy ? "Signing…" : "Arm take-profit"}
      </button>
      <div className="mt-1.5 text-[10px] opacity-60 leading-tight">
        I&apos;ll repay your loan + sell the collateral the moment the trigger hits.
        1% protocol fee on proceeds. You can cancel any time.
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
    case "loan_below_minimum_size":
      return "this loan is below the 1 SOL take-profit minimum.";
    case "collateral_not_enabled":
      return "this collateral isn't currently enabled in the protocol.";
    case "rwa_collateral_not_supported_in_v1":
      // Unreachable since 2026-06-13 (bot PR #161 flipped the gate +
      // engine PR #16 shipped V2 fill path). Kept defensively in the
      // switch with a retry-prompt — a stale agent SDK or cached
      // client could still bubble this code.
      return "take-profit on this collateral is now live — please reload + try again.";
    case "loan_already_has_active_order":
      return "another take-profit is already armed on this loan.";
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

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    let id: ReturnType<typeof setInterval> | null = null;
    fetchOnce();
    id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!cancelled) fetchOnce();
    }, POLL_MS);
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [wallet, fetchOnce]);

  return { state, refresh: fetchOnce };
}
