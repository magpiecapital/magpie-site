"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { siteCastVote, type VoteChoice, type VoteOption } from "@/lib/solana/site-governance-vote";
import { formatEst } from "@/lib/time";

interface VoteButtonsProps {
  proposalId: string;
  questionId: string;
  options: VoteOption[];
  botApiUrl: string;
  /** ISO timestamp; if set and in the future, buttons render as "voting opens at …" instead of clickable. */
  opensAtIso?: string;
  /**
   * Called the moment a vote signature is accepted by the bot. Parent
   * uses this to bump LiveResults' refresh nonce so the bar moves NOW
   * instead of waiting for the next 2s poll. Operator-flagged: the
   * "I voted and nothing visibly changed" UX was the #1 trust issue
   * on MGP-001 — never reproduce. See feedback_voting_ux_must_feel_solid.md.
   */
  onVoteRecorded?: (choice: VoteChoice) => void;
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
  options,
  botApiUrl,
  opensAtIso,
  onVoteRecorded,
}: VoteButtonsProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [busy, setBusy] = useState<VoteChoice | null>(null);
  const [recorded, setRecorded] = useState<VoteChoice | null>(null);
  // Sub-states so the user knows EXACTLY where they are in the flow.
  // Operator feedback: "didn't feel confident when I locked in my vote."
  // Now the button text walks through: idle → signing → sending → recorded.
  const [phase, setPhase] = useState<"idle" | "signing" | "sending" | "recorded" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [justRecordedAt, setJustRecordedAt] = useState<number | null>(null);

  const walletStr = publicKey ? publicKey.toBase58() : null;
  const opensAt = opensAtIso ? Date.parse(opensAtIso) : null;
  const notYetOpen = opensAt !== null && Date.now() < opensAt;

  async function handleVote(choice: VoteChoice) {
    setError(null);
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage to vote.");
      setPhase("error");
      return;
    }
    setBusy(choice);
    setPhase("signing");
    try {
      // The signMessage prompt opens the wallet; once signed, siteCastVote
      // POSTs to the bot. Phase flips to "sending" right before the POST.
      // We can't intercept the inner wallet step, so we approximate by
      // flipping after a microtask — gives the UI a chance to render
      // "signing…" before the wallet popup steals focus.
      await new Promise((r) => setTimeout(r, 0));
      const result = await siteCastVote({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        proposalId,
        questionId,
        vote: choice,
      });
      setRecorded(choice);
      setPhase("recorded");
      setJustRecordedAt(Date.now());
      // Tell the parent — they bump LiveResults' refreshNonce so the
      // bar moves immediately instead of waiting for the next 2s poll.
      onVoteRecorded?.(choice);
      void result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      setBusy(null);
    }
  }

  if (notYetOpen) {
    const opensFmt = formatEst(new Date(opensAt!));
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

  // Recently-recorded glow lasts 4 seconds so the eye catches it even
  // if the user looks away briefly.
  const recentlyRecorded =
    phase === "recorded" && justRecordedAt !== null && Date.now() - justRecordedAt < 4_000;
  const recordedOption = options.find((o) => o.value === recorded);

  return (
    <div>
      {/* Rich option cards — every ballot option shows its letter, a clear
          label, and a plain-English description. A voter never sees a bare
          letter and has to guess. See feedback_governance_ballots_must_be_self_explanatory.md */}
      <div className="space-y-2.5">
        {options.map((opt) => {
          const isRecorded = recorded === opt.value;
          const isBusy = busy === opt.value;
          const busyLabel =
            phase === "signing" ? "sign in wallet…"
            : phase === "sending" ? "submitting…"
            : "working…";
          return (
            <button
              key={opt.value}
              type="button"
              disabled={busy !== null}
              onClick={() => handleVote(opt.value)}
              className={
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 " +
                choiceTheme(opt.value, isRecorded)
              }
            >
              <span className="mt-0.5 inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 px-1.5 font-mono text-xs font-semibold uppercase tracking-wider">
                {opt.value}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                  {opt.label}
                  {isRecorded && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-200">✓ your vote</span>
                  )}
                  {isBusy && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">{busyLabel}</span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-white/60">
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Prominent success banner — replaces the small grey line that
          operator said didn't feel confidence-inspiring. Big, green,
          tactile, and stays visible. */}
      {recorded && (
        <div
          className={
            "mt-4 rounded-xl border px-4 py-3 transition-all duration-300 " +
            (recentlyRecorded
              ? "border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_32px_-8px_rgba(16,185,129,0.8)]"
              : "border-emerald-500/30 bg-emerald-500/8")
          }
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-emerald-200">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-100">
                Vote signed and submitted — {recordedOption ? `${recordedOption.value} · ${recordedOption.label}` : recorded}
              </p>
              <p className="mt-1 text-xs text-emerald-100/75">
                Your signature is on the server. The tally bars below update
                live; you'll see your weight reflected in the next second or
                two. Re-sign with a different choice anytime before close —
                latest signature wins.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3">
          <p className="text-sm font-medium text-rose-100">Vote failed</p>
          <p className="mt-1 text-xs text-rose-100/80">{error}</p>
          <p className="mt-1 text-xs text-rose-100/60">
            Tap your choice again to retry. Nothing was sent until your wallet
            signs.
          </p>
        </div>
      )}
    </div>
  );
}
