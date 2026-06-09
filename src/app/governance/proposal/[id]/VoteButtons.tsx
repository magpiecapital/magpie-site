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
      <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="text-sm font-medium text-amber-200">
          Voting opens {opensFmt}.
        </p>
        <p className="mt-1 text-xs text-amber-200/70">
          Buttons unlock at the open time. The signed payloads need to be issued AFTER
          activation; the server rejects votes signed earlier.
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <p className="mt-4 text-sm text-white/50">
        Connect your wallet to cast a vote. Your vote weight is based on your $MAGPIE
        balance at proposal activation.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
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
                isRecorded
                  ? "rounded-md border border-cyan-400/60 bg-cyan-500/30 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-cyan-100"
                  : "rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-white/80 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-white disabled:opacity-50"
              }
            >
              {isBusy ? `signing ${c}...` : isRecorded ? `${c} ✓` : c}
            </button>
          );
        })}
      </div>
      {recorded && (
        <p className="mt-2 text-xs text-cyan-300">
          Vote recorded on-server. You can resign with a different choice until voting
          closes; the most recent valid signature is what counts at tally.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
