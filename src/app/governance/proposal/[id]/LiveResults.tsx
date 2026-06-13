"use client";

import { useEffect, useState } from "react";
import { formatEst } from "@/lib/time";

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
  };
  percentages: { participation_pct: number; yes_share_of_cast_pct: number };
  computed_at: string;
}

interface LiveResultsProps {
  proposalId: string;
  botApiUrl: string;
  choices: string[];
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

export function LiveResults({ proposalId, botApiUrl, choices }: LiveResultsProps) {
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
    // Tight cadence for near-instant tally updates after a vote lands.
    // 2s polling is the v0 path; v1 will move to SSE / Postgres LISTEN
    // for true push semantics. At 2s the user perceives "instant" on
    // their own vote because they tabbed back to the page in ~1s and
    // the next poll catches the new state.
    const id = setInterval(fetchTally, 2_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [proposalId, botApiUrl]);

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
  // Distribute the choice weights by name. The tally only stores yes/no/abstain
  // explicitly, so for non-YES-NO ballots (e.g. MGP-003 A/B/C/D/E) the bot
  // will return 0 weights — that's fine, the bars just render empty.
  const perChoice: { label: string; weight: bigint; pct: number; color: string }[] = choices.map(
    (c) => {
      const norm = c.toLowerCase();
      let w = 0n;
      if (norm === "yes") w = BigInt(tally.weights.yes_weight);
      else if (norm === "no") w = BigInt(tally.weights.no_weight);
      else if (norm === "abstain") w = BigInt(tally.weights.abstain_weight);
      const pct = castWeight > 0n ? Number((w * 10000n) / castWeight) / 100 : 0;
      const color =
        norm === "yes"
          ? "from-emerald-500 to-emerald-400"
          : norm === "no"
            ? "from-rose-500 to-rose-400"
            : "from-white/40 to-white/30";
      return { label: c, weight: w, pct, color };
    },
  );

  const quorumMet = tally.percentages.participation_pct >= tally.quorum_pct;
  const thresholdMet = tally.percentages.yes_share_of_cast_pct >= tally.threshold_pct;

  return (
    <div className="space-y-5">
      {/* Per-choice bars */}
      <div className="space-y-3">
        {perChoice.map((c) => (
          <div key={c.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-white/90">{c.label}</span>
              <span className="font-mono text-white/70 tabular-nums">
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
        ))}
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
          <p className="text-[10px] uppercase tracking-wider text-white/40">YES share</p>
          <p className="mt-0.5 font-mono text-sm text-white/90 tabular-nums">
            {fmtPct(tally.percentages.yes_share_of_cast_pct)}{" "}
            <span className="text-xs text-white/40">/ {tally.threshold_pct}% req</span>
          </p>
        </div>
      </div>

      <p className="text-[11px] text-white/40">
        Live tally, refreshes every 30s. Aggregate weights only — per-wallet choices
        stay private. Whale-cap 2% applied. Updated {formatEst(tally.computed_at)}.
      </p>
    </div>
  );
}
