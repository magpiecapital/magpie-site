"use client";

/**
 * Client-side bridge that lets VoteButtons trigger an immediate
 * refetch in LiveResults the moment a vote is recorded. Without this
 * the user signs their vote, sees the small confirmation, then waits
 * up to 2s for the next poll cycle before the bar moves — which felt
 * like the vote didn't land (operator-flagged 2026-06-18). With this,
 * the bar moves within ~200ms of the bot's 200 OK.
 *
 * Why a separate component: the parent ProposalPage is a server
 * component (server-rendered metadata + SEO), so it can't hold
 * useState. This wrapper is the smallest possible client boundary.
 *
 * See feedback_voting_ux_must_feel_solid.md.
 */

import { useState } from "react";
import type { VoteOption } from "@/lib/solana/site-governance-vote";
import { VoteButtons } from "./VoteButtons";
import { LiveResults } from "./LiveResults";

interface VoteAndLiveResultsProps {
  proposalId: string;
  questionId: string;
  options: VoteOption[];
  botApiUrl: string;
  opensAtIso?: string;
}

export function VoteAndLiveResults({
  proposalId,
  questionId,
  options,
  botApiUrl,
  opensAtIso,
}: VoteAndLiveResultsProps) {
  // Bumping this counter is the "vote just landed" signal.
  // LiveResults watches it as a useEffect dep + triggers an immediate
  // fetch the moment it changes.
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <>
      <VoteButtons
        proposalId={proposalId}
        questionId={questionId}
        options={options}
        botApiUrl={botApiUrl}
        opensAtIso={opensAtIso}
        onVoteRecorded={() => setRefreshNonce((n) => n + 1)}
      />
      <p className="mt-4 text-xs leading-relaxed text-white/45">
        Wallet message-sign only. No SOL moves, no gas. Re-vote any time before
        close — latest signature wins.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
            Live results
          </h2>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200/80">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            updates instantly on your vote
          </span>
        </div>
        <LiveResults
          proposalId={proposalId}
          botApiUrl={botApiUrl}
          options={options}
          refreshNonce={refreshNonce}
        />
      </div>
    </>
  );
}
