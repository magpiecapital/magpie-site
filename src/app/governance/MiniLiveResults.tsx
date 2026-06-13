"use client";

import { useEffect, useState } from "react";

interface TallyBody {
  counts: { eligible_voters: number; voters_cast: number };
  weights: {
    yes_weight: string;
    no_weight: string;
    abstain_weight: string;
    cast_weight: string;
  };
  percentages: { participation_pct: number; yes_share_of_cast_pct: number };
  quorum_pct: number;
  threshold_pct: number;
}

interface MiniLiveResultsProps {
  proposalId: string;
  botApiUrl: string;
}

function fmtPct(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

/**
 * Compact live-tally preview for the governance index card. Shows a
 * single horizontal stacked bar (yes / no / abstain) plus a one-line
 * status. Polls every 60s (less aggressive than the proposal page).
 */
export function MiniLiveResults({ proposalId, botApiUrl }: MiniLiveResultsProps) {
  const [tally, setTally] = useState<TallyBody | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchTally() {
      try {
        const r = await fetch(
          `${botApiUrl}/api/v1/governance/tally?proposal_id=${encodeURIComponent(proposalId)}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const body = await r.json();
        if (!cancelled) {
          setTally(body);
          setUnavailable(false);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    }
    fetchTally();
    // Overview mini-card — 3s cadence. Slightly slower than the
    // proposal-detail page (which polls every 2s) since this is
    // peripheral context, not the action surface.
    const id = setInterval(fetchTally, 3_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [proposalId, botApiUrl]);

  if (unavailable) return null;

  if (!tally) {
    return (
      <div className="mt-4 space-y-2">
        <div className="h-1.5 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  const castWeight = BigInt(tally.weights.cast_weight);
  const yesPct = castWeight > 0n
    ? Number((BigInt(tally.weights.yes_weight) * 10000n) / castWeight) / 100
    : 0;
  const noPct = castWeight > 0n
    ? Number((BigInt(tally.weights.no_weight) * 10000n) / castWeight) / 100
    : 0;
  const absPct = Math.max(0, 100 - yesPct - noPct);

  const quorumMet = tally.percentages.participation_pct >= tally.quorum_pct;
  const thresholdMet = tally.percentages.yes_share_of_cast_pct >= tally.threshold_pct;

  return (
    <div className="mt-4">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        {yesPct > 0 && (
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
        )}
        {noPct > 0 && (
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500"
            style={{ width: `${noPct}%` }}
          />
        )}
        {absPct > 0 && castWeight > 0n && (
          <div
            className="h-full bg-white/20 transition-all duration-500"
            style={{ width: `${absPct}%` }}
          />
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-white/55">
        <span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
          <span className="ml-1.5">YES {fmtPct(yesPct)}</span>
        </span>
        <span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 align-middle" />
          <span className="ml-1.5">NO {fmtPct(noPct)}</span>
        </span>
        <span className="text-white/40">
          {tally.counts.voters_cast} of {tally.counts.eligible_voters.toLocaleString()} voted
        </span>
        <span
          className={
            quorumMet && thresholdMet ? "text-emerald-300" : "text-white/40"
          }
        >
          {quorumMet ? "quorum ✓" : `${fmtPct(tally.percentages.participation_pct)} / ${tally.quorum_pct}% quorum`}
        </span>
      </div>
    </div>
  );
}
