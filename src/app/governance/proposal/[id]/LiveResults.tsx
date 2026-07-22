"use client";

import { useEffect, useState } from "react";
import { formatEst } from "@/lib/time";
import type { VoteChoice, VoteOption } from "@/lib/solana/site-governance-vote";

interface TallyBody {
  proposal_id: string;
  voting_started_at_iso?: string;
  voting_ends_at_iso?: string;
  quorum_pct: number;
  threshold_pct: number;
  counts: { eligible_voters: number; voters_cast: number };
  weights: {
    yes_weight: string;
    no_weight: string;
    abstain_weight: string;
    cast_weight: string;
    total_eligible_capped: string;
    per_choice?: Record<string, string>;
  };
  percentages: { participation_pct: number; yes_share_of_cast_pct: number };
  computed_at: string;
  /** Present only after close, once the autopilot has recorded the final result. */
  outcome?: {
    result: string; // "A" | "passed" | "failed" | "operator_discretion"
    closed_at?: string;
    winner_choice?: string | null;
    winner_share_pct?: number;
    quorum_met?: boolean;
    threshold_met?: boolean;
  };
}

interface LiveResultsProps {
  proposalId: string;
  botApiUrl: string;
  options: VoteOption[];
  /** The viewer's own recorded choice — its bar gets a "you voted" marker. */
  userVote?: VoteChoice | null;
  /**
   * Bumping this counter from the parent triggers an immediate refetch.
   * VoteButtons calls onVoteRecorded → parent bumps this → bar moves NOW
   * instead of waiting for the next 2s poll cycle. Prevents the "I voted
   * and nothing happened for 2 seconds" UX issue operator flagged.
   */
  refreshNonce?: number;
  /** When true, voting has closed: render a FINAL (non-live) tally — no 2s poll, no "live" footer/pulse. */
  isClosed?: boolean;
}

// Convert raw $MAGPIE (6 decimals) to a short human string.
function fmtMagpie(raw: string): string {
  const n = Number(raw) / 1e6;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtPct(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

export function LiveResults({
  proposalId,
  botApiUrl,
  options,
  userVote,
  refreshNonce = 0,
  isClosed = false,
}: LiveResultsProps) {
  const [tally, setTally] = useState<TallyBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchTally() {
      try {
        const r = await fetch(
          `${botApiUrl}/api/v1/governance/tally?proposal_id=${encodeURIComponent(proposalId)}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          if (!cancelled) setError(body.error || `HTTP ${r.status}`);
          return;
        }
        const body = await r.json();
        if (!cancelled) {
          setTally(body);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    fetchTally();
    // 2s poll. The refreshNonce dependency below triggers an immediate
    // refetch the moment a vote is recorded — no need for SSE/LISTEN
    // to feel instant in the common case. Once voting has CLOSED the tally is
    // final, so fetch once and do NOT poll (no "live"-feeling animation).
    const id = isClosed ? null : setInterval(fetchTally, 2_000);
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [proposalId, botApiUrl, refreshNonce, isClosed]);

  if (error) {
    return (
      <p className="text-sm text-white/40">Live results unavailable: {error}</p>
    );
  }
  if (!tally) {
    return (
      <div className="space-y-3">
        <div className="h-2 animate-pulse rounded-full bg-white/10" />
        <div className="h-2 animate-pulse rounded-full bg-white/10" />
        <div className="h-2 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  const castWeight = BigInt(tally.weights.cast_weight);
  const perChoiceMap = tally.weights.per_choice || {};

  const perChoice: { value: string; label: string; weight: bigint; pct: number; color: string }[] = options.map(
    (opt) => {
      const c = opt.value;
      const norm = c.toLowerCase();
      // Prefer the bot's per_choice map (correct for multi-choice ballots).
      // Fall back to legacy yes/no/abstain fields for older proposals that
      // haven't been re-tallied since the API got per_choice support.
      let w = 0n;
      const fromPerChoice = perChoiceMap[c.toUpperCase()] ?? perChoiceMap[c];
      if (fromPerChoice) {
        w = BigInt(fromPerChoice);
      } else if (norm === "yes") {
        w = BigInt(tally.weights.yes_weight);
      } else if (norm === "no") {
        w = BigInt(tally.weights.no_weight);
      } else if (norm === "abstain") {
        w = BigInt(tally.weights.abstain_weight);
      }
      const pct = castWeight > 0n ? Number((w * 10000n) / castWeight) / 100 : 0;
      const color =
        norm === "yes"
          ? "from-emerald-500 to-emerald-400"
          : norm === "no"
            ? "from-rose-500 to-rose-400"
            : "from-cyan-500 to-cyan-400";
      return { value: c, label: opt.label, weight: w, pct, color };
    },
  );

  const quorumMet = tally.percentages.participation_pct >= tally.quorum_pct;
  // Threshold check uses yes_share for YES/NO proposals.
  // For multi-choice (no YES in the choice set), use the leading-choice share.
  const hasYesChoice = options.some((o) => o.value.toLowerCase() === "yes");
  const leadingChoicePct = hasYesChoice
    ? tally.percentages.yes_share_of_cast_pct
    : Math.max(0, ...perChoice.filter((p) => p.value.toLowerCase() !== "abstain").map((p) => p.pct));
  const thresholdMet = leadingChoicePct >= tally.threshold_pct;

  return (
    <div className="space-y-5">
      {/* Final result banner — appears automatically once voting closes and the
          autopilot records the outcome. No manual edit. */}
      {tally.outcome && (() => {
        const o = tally.outcome;
        const isWinner = /^[A-E]$/.test(o.result);
        const winLabel = isWinner ? options.find((opt) => opt.value === o.result)?.label : null;
        const passed = isWinner || o.result === "passed";
        const heading = isWinner
          ? `Winner — Option ${o.result}${winLabel ? `: ${winLabel}` : ""}`
          : o.result === "passed" ? "Passed"
          : o.result === "operator_discretion" ? "No clear winner — operator discretion"
          : "Did not pass";
        const sub = isWinner && o.winner_share_pct != null
          ? `${fmtPct(o.winner_share_pct)} of cast · quorum ${o.quorum_met ? "met" : "missed"}`
          : o.result === "operator_discretion"
            ? "ABSTAIN reached the discretion threshold (or an exact tie) — the operator decides among the options."
            : `quorum ${o.quorum_met ? "met" : "missed"} · threshold ${o.threshold_met ? "met" : "missed"}`;
        return (
          <div className={"rounded-xl border px-4 py-3 " + (passed ? "border-emerald-400/50 bg-emerald-500/12" : "border-white/15 bg-white/5")}>
            <p className={"text-sm font-semibold " + (passed ? "text-emerald-100" : "text-white/85")}>
              ✓ Final result — {heading}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {sub}{o.closed_at ? ` · closed ${formatEst(o.closed_at)}` : ""}
            </p>
          </div>
        );
      })()}

      {/* Per-choice bars */}
      <div className="space-y-3">
        {perChoice.map((c) => {
          const isYours = userVote != null && c.value === userVote;
          return (
            <div key={c.value} className={isYours ? "rounded-lg -mx-2 px-2 py-1.5 ring-1 ring-emerald-400/40 bg-emerald-500/[0.06]" : undefined}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px] font-semibold uppercase text-white/70">
                    {c.value}
                  </span>
                  <span className="truncate font-medium text-white/90">{c.label}</span>
                  {isYours && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-200">
                      ✓ you voted
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-white/70 tabular-nums">
                  {fmtPct(c.pct)}
                  <span className="ml-2 text-xs text-white/40">
                    {fmtMagpie(c.weight.toString())}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${c.color} transition-all duration-700`}
                  style={{ width: `${Math.min(100, c.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quorum + threshold + voter count */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Voters</p>
          <p className="mt-0.5 font-mono text-sm text-white/90 tabular-nums">
            {tally.counts.voters_cast}{" "}
            <span className="text-xs text-white/40">/ {tally.counts.eligible_voters.toLocaleString()}</span>
          </p>
        </div>
        <div
          className={
            "rounded-lg border px-4 py-3 " +
            (quorumMet
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-white/10 bg-white/5")
          }
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Participation
          </p>
          <p className="mt-0.5 font-mono text-sm text-white/90 tabular-nums">
            {fmtPct(tally.percentages.participation_pct)}{" "}
            <span className="text-xs text-white/40">/ {tally.quorum_pct}% req</span>
          </p>
        </div>
        <div
          className={
            "rounded-lg border px-4 py-3 " +
            (thresholdMet
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-white/10 bg-white/5")
          }
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            {hasYesChoice ? "YES share" : "Leading choice"}
          </p>
          <p className="mt-0.5 font-mono text-sm text-white/90 tabular-nums">
            {fmtPct(leadingChoicePct)}{" "}
            <span className="text-xs text-white/40">/ {tally.threshold_pct}% req</span>
          </p>
        </div>
      </div>

      <p className="text-[11px] text-white/40">
        {isClosed
          ? "Final tally — voting closed."
          : "Live tally — updates in real time (and instantly on your own vote)."}{" "}
        Aggregate weights only — per-wallet choices stay private. Whale-cap 2%
        applied. Updated {formatEst(tally.computed_at)}.
      </p>
    </div>
  );
}
