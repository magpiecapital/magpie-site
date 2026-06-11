"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { siteCastVote, type VoteChoice } from "@/lib/solana/site-governance-vote";

interface VoteButtonsProps {
  proposalId: string;
  questionId: string;
  choices: VoteChoice[];
  botApiUrl: string;
  /** ISO timestamp; if set and in the future, buttons render as "voting opens at …" instead of clickable. */
  opensAtIso?: string;
}

// Visual treatment per choice. YES is green, NO is rose, everything
// else is neutral. Falls back gracefully for non-YES/NO ballots
// (e.g. MGP-003 has A/B/C/D/E + ABSTAIN — all render neutral).
function choiceTheme(choice: string, isRecorded: boolean) {
  const norm = choice.toLowerCase();
  if (isRecorded) {
    if (norm === "yes")
      return "border-emerald-400/60 bg-emerald-500/25 text-emerald-50 shadow-[0_0_24px_-8px_rgba(16,185,129,0.6)]";
    if (norm === "no")
      return "border-rose-400/60 bg-rose-500/25 text-rose-50 shadow-[0_0_24px_-8px_rgba(244,63,94,0.6)]";
    return "border-cyan-400/60 bg-cyan-500/25 text-cyan-50 shadow-[0_0_24px_-8px_rgba(34,211,238,0.6)]";
  }
  if (norm === "yes")
    return "border-white/15 bg-white/5 text-white/85 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-100";
  if (norm === "no")
    return "border-white/15 bg-white/5 text-white/85 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100";
  return "border-white/15 bg-white/5 text-white/85 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-100";
}

export function VoteButtons({
  proposalId,
  questionId,
  choices,
  botApiUrl,
  opensAtIso,
}: VoteButtonsProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [busy, setBusy] = useState<VoteChoice | null>(null);
  const [recorded, setRecorded] = useState<VoteChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walletStr = publicKey ? publicKey.toBase58() : null;
  const opensAt = opensAtIso ? Date.parse(opensAtIso) : null;
  const notYetOpen = opensAt !== null && Date.now() < opensAt;

  async function handleVote(choice: VoteChoice) {
    setError(null);
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage to vote.");
      return;
    }
    setBusy(choice);
    try {
      await siteCastVote({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        proposalId,
        questionId,
        vote: choice,
      });
      setRecorded(choice);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (notYetOpen) {
    const opensFmt = new Date(opensAt!).toUTCString();
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-sm font-medium text-amber-100">
          Voting opens {opensFmt}.
        </p>
        <p className="mt-1 text-xs text-amber-100/70">
          Signed payloads must be issued after activation — early signatures are rejected by the server.
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/70">
          Connect a wallet to cast a vote.
        </p>
        <p className="mt-1 text-xs text-white/45">
          Weight = your $MAGPIE balance at the activation snapshot. Tokens you have on-loan as collateral count 1:1 alongside tokens you hold.
        </p>
      </div>
    );
  }

  // n-up grid — 2 cols on mobile for 3-choice ballots, scales up.
  const gridCols =
    choices.length <= 2 ? "grid-cols-2"
    : choices.length === 3 ? "grid-cols-3"
    : choices.length <= 4 ? "grid-cols-2 sm:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3";

  return (
    <div>
      <div className={`grid gap-2 sm:gap-3 ${gridCols}`}>
        {choices.map((c) => {
          const isRecorded = recorded === c;
          const isBusy = busy === c;
          return (
            <button
              key={c}
              type="button"
              disabled={busy !== null}
              onClick={() => handleVote(c)}
              className={
                "rounded-xl border px-4 py-4 font-mono text-sm uppercase tracking-wider transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-5 sm:text-base " +
                choiceTheme(c, isRecorded)
              }
            >
              {isBusy ? "signing…" : isRecorded ? `${c} · recorded` : c}
            </button>
          );
        })}
      </div>
      {recorded && (
        <p className="mt-3 text-xs text-emerald-200/80">
          Vote recorded. Re-sign with a different choice any time before close — latest signature wins.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
