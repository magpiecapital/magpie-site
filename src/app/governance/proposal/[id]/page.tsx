import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoteButtons } from "./VoteButtons";
import { VotingCountdown } from "./VotingCountdown";
import { LiveResults } from "./LiveResults";
import { VoteAndLiveResults } from "./VoteAndLiveResults";
import type { VoteOption } from "@/lib/solana/site-governance-vote";
import { resolveProposalStatus } from "@/lib/governance";
import { GovernanceAutoAdvance } from "../../GovernanceAutoAdvance";
import { formatEst } from "@/lib/time";

// force-dynamic = re-resolve against the current second on every request, so the
// vote UI opens/closes exactly on schedule; GovernanceAutoAdvance flips a watched page.
export const dynamic = "force-dynamic";

interface ProposalQuestion {
  id: string;
  text: string;
  /** The ballot, with a plain-English label + description per option. */
  options?: VoteOption[];
}

// NOTE: status/opens/closes are NOT stored here — they are DERIVED from
// src/lib/governance.ts (resolveProposalStatus). This page only holds the
// proposal's presentation content. Never hand-type a status string here.
interface Proposal {
  id: string;
  title: string;
  tldr: string;
  voting_window_human: string;
  summary: string;
  spec_url: string;
  questions?: ProposalQuestion[];
  parameters?: { label: string; value: string }[];
}

const PROPOSALS: Record<string, Proposal> = {
  "MGP-001": {
    id: "MGP-001",
    title: "Restructure the loan-fee split — 70/10/10/10",
    tldr:
      "PASSED + IN EFFECT. The 70/10/10/10 split is now live for every loan fee. Final tally at 2026-06-13 22:00 UTC: 98% YES, 8.72% participation, both quorum (5%) and threshold (66.6%) cleared.",
    voting_window_human: "Opened Jun 10, 2026 6:00 PM EST · closed Jun 13, 2026 6:00 PM EST (72h)",
    summary:
      "Restructure the loan-fee split so 70% goes to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, and 10% to the protocol reserve. Replaces the current 10% holder share with a holder-first split. Forward-only — distributions already accrued under the old split are not retroactively re-cut.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-fee-split-70-10-10-10.md",
    parameters: [
      { label: "$MAGPIE holders", value: "70% (7,000 BPS)" },
      { label: "SOL LPs", value: "10% (1,000 BPS)" },
      { label: "Referrers", value: "10% (1,000 BPS)" },
      { label: "Protocol reserve", value: "10% (1,000 BPS)" },
      { label: "Total", value: "100% (10,000 BPS)" },
      { label: "Effective on", value: "Loans originated after execution" },
      { label: "Execution path", value: "Operator-committed; bot config + v3 program constants" },
    ],
    questions: [
      {
        id: "Vote",
        text: "Should Magpie adopt the 70/10/10/10 loan-fee split?",
        options: [
          { value: "YES", label: "Adopt 70/10/10/10", description: "Send 70% of every loan fee to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, 10% to the protocol reserve. Holder-first." },
          { value: "NO", label: "Keep the current split", description: "Leave the existing 10% holder share unchanged." },
          { value: "ABSTAIN", label: "Defer to operator", description: "No preference — defer to operator discretion." },
        ],
      },
    ],
  },
  "MGP-002": {
    id: "MGP-002",
    title: "[WITHDRAWN] Signal poll on the Premium tier",
    tldr:
      "Operator activated this as a non-binding signal poll, then chose to ship the Premium tier under Tier B discretion. Withdrawn before close.",
    voting_window_human: "Withdrawn 2026-06-09",
    summary:
      "Withdrawn 2026-06-09. The operator activated MGP-002 as a non-binding signal poll on whether to add a Premium tier, then chose to ship the tier directly under Tier B operator discretion (with both 15-day and 30-day duration options, tokenized stocks only).",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
    parameters: [
      { label: "Status", value: "Withdrawn before close" },
      { label: "Reason", value: "Operator shipped under Tier B discretion" },
    ],
  },
  "MGP-003": {
    id: "MGP-003",
    title: "July 1, 2026 $MAGPIE Streamflow unlock allocation (~5% of supply)",
    tldr:
      "On July 1, 2026, a Streamflow contract holding ~5% of $MAGPIE supply (~50M) unlocks. Four options on the ballot — patience (long re-lock), loyalty (24-mo holder vest), build (locked growth treasury), or discipline + build (50% burn + 50% treasury). No option releases tokens at once.",
    voting_window_human:
      "Opens Jun 24, 2026 8:00 PM EST · closes Jun 29, 2026 8:00 PM EST (5 days)",
    summary:
      "On July 1, 2026 a Streamflow contract holding ~5% of $MAGPIE supply (~50M tokens) unlocks. The proposal asks token holders to choose one of four capital strategies. Each option is structured to avoid any single-event liquidity release. Operator commits to honor the winning option. Execution must complete within 14 days of unlock.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
    parameters: [
      { label: "Streamflow contract", value: "GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc" },
      { label: "Unlock date", value: "2026-07-01" },
      { label: "Allocation size", value: "~5% of total supply (~50M $MAGPIE)" },
      { label: "Voting window", value: "5 days (Jun 24 → Jun 29, 2026)" },
      { label: "Quorum requirement", value: "≥ 7.5% of eligible supply (non-ABSTAIN)" },
      { label: "Pass threshold", value: "Plurality, winner > 40% of cast votes" },
      { label: "Execution window", value: "≤ 14 days after July 1 unlock" },
    ],
    questions: [
      {
        id: "Vote",
        text:
          "On July 1, 2026 a Streamflow contract holding ~5% of $MAGPIE supply (~50M tokens) unlocks. Pick ONE option for what happens to it. No option releases tokens to the market at once. The winning option (>40% of cast votes) binds the operator's execution within 14 days.",
        options: [
          { value: "A", label: "Patience — 36-month re-lock", description: "Re-lock 100% of the ~50M into a new Streamflow vest ending July 2029. No spend, no distribution, no supply change today. Keeps every option open for later." },
          { value: "B", label: "Loyalty — 24-month holder vest", description: "Distribute 100% to current $MAGPIE holders via a 24-month linear vest (snapshot at proposal close, ~0.137%/day per holder, same exempt-wallet rules as today). Rewards today's holders; no instant dump." },
          { value: "C", label: "Build — locked Growth Treasury", description: "Move 100% to a multi-sig Magpie Treasury locked ≥24 months, spendable only on pre-declared categories (deep-LP backing, partner integrations, security audits, x402 grants, matched LP top-ups), fully logged on /distributions." },
          { value: "D", label: "Discipline + Build — 50% burn / 50% treasury", description: "Permanently burn 50% (~25M, −2.5% of supply) and lock the other 50% in the same Growth Treasury (24-month lock, Option C spend rules). Tightens supply and funds growth." },
          { value: "ABSTAIN", label: "Defer to operator", description: "No preference. If ABSTAIN reaches ≥30% of weight, the operator chooses among A–D." },
        ],
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = PROPOSALS[id.toUpperCase()];
  if (!p) return { title: `Proposal not found | Magpie` };
  return {
    title: `${p.id}: ${p.title} | Magpie Governance`,
    description: p.tldr,
  };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = PROPOSALS[id.toUpperCase()];
  if (!p) notFound();

  // Status + dates are derived from the single source of truth, not stored here.
  const status = resolveProposalStatus(p.id);
  const isActive = status?.votingOpen ?? false;
  const badgeLabel =
    status?.kind === "active"
      ? "live"
      : status?.kind === "upcoming"
        ? "draft"
        : status?.kind === "tallying"
          ? "voting closed"
          : status?.kind === "passed"
            ? status.terminal && status.terminal.kind === "passed" && status.terminal.executed_at_iso
              ? "executed"
              : "passed"
            : (status?.kind ?? "draft");
  const botApiUrl =
    process.env.NEXT_PUBLIC_BOT_API_URL ||
    "https://magpie-bot-production.up.railway.app";
  const question = p.questions?.[0];

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <GovernanceAutoAdvance thresholdsIso={status ? [status.activates_at_iso, status.closes_at_iso] : []} />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        {/* ── Heading ─────────────────────────────────────────── */}
        <Reveal>
          <Link
            href="/governance"
            className="text-xs uppercase tracking-wider text-white/45 transition hover:text-white/80"
          >
            ← Governance
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-cyan-500/25 px-2.5 py-1 font-mono text-[11px] text-cyan-100">
              {p.id}
            </span>
            <span
              className={
                isActive
                  ? "inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-100"
                  : "rounded-md bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60"
              }
            >
              {isActive && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              )}
              {badgeLabel}
            </span>
          </div>
          <h1 className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">
            {p.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            {p.tldr}
          </p>
        </Reveal>

        {/* ── Vote card (the primary action) ──────────────────── */}
        {isActive && question && (
          <Reveal delay={0.05}>
            <section className="mt-8 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.08] to-transparent">
              <div className="border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
                    Cast vote
                  </h2>
                  <VotingCountdown closesAtIso={status?.closes_at_iso ?? ""} />
                </div>
                <p className="mt-2 text-xs text-white/45">
                  Official close:{" "}
                  <span className="font-medium text-white/75">{formatEst(status?.closes_at_iso ?? "")}</span>
                </p>
              </div>
              <div className="px-5 py-6 sm:px-6">
                <p className="mb-5 text-sm leading-relaxed text-white/75">
                  {question.text}
                </p>
                {question.options && (
                  <VoteAndLiveResults
                    proposalId={p.id}
                    questionId={question.id}
                    options={question.options}
                    botApiUrl={botApiUrl}
                    opensAtIso={status?.activates_at_iso ?? ""}
                  />
                )}
              </div>
            </section>
          </Reveal>
        )}

        {!isActive && (
          <Reveal delay={0.05}>
            <section className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6">
              <p className="text-sm text-white/70">
                <strong className="text-white/90">{p.voting_window_human}.</strong>{" "}
                {p.summary}
              </p>
            </section>
          </Reveal>
        )}

        {/* Final results — once voting has CLOSED (tallying / passed / failed), show the
            per-option result + winner banner. Not shown for "upcoming" (voting hasn't
            happened yet). LiveResults self-draws the post-close outcome from the tally API. */}
        {!isActive && status && status.kind !== "upcoming" && question?.options && (
          <Reveal delay={0.08}>
            <section className="mt-6 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.08] to-transparent">
              <div className="border-b border-white/5 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
                  Final results — voting closed
                </h2>
              </div>
              <div className="px-5 py-6 sm:px-6">
                <LiveResults
                  proposalId={p.id}
                  botApiUrl={botApiUrl}
                  options={question.options}
                  isClosed
                />
              </div>
            </section>
          </Reveal>
        )}

        {/* ── Voter eligibility note ──────────────────────────── */}
        {isActive && (
          <Reveal delay={0.15}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
                Who can vote
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Anyone holding $MAGPIE. Your voting weight = your $MAGPIE balance at <strong className="text-white/95">vote close</strong> (current holders), including tokens you have <strong className="text-white/95">on-loan as collateral</strong> (counted 1:1) — using Magpie doesn&apos;t reduce your governance weight. Buying during the window counts; selling before close removes your weight.
              </p>
              <p className="mt-3 text-xs text-white/45">
                Whale cap: 2% per wallet. Re-vote any time before close.
              </p>
            </section>
          </Reveal>
        )}

        {/* ── Details (collapsible-feel, low chrome) ──────────── */}
        {p.parameters && (
          <Reveal delay={0.2}>
            <section className="mt-6">
              <details className="group rounded-2xl border border-white/10 bg-white/[0.025] open:bg-white/[0.04]">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white/55 sm:px-6">
                  Details
                  <span className="text-white/40 transition group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="border-t border-white/5 px-5 pb-5 pt-4 sm:px-6">
                  <dl className="divide-y divide-white/5">
                    {p.parameters.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                      >
                        <dt className="text-xs uppercase tracking-wider text-white/45">
                          {row.label}
                        </dt>
                        <dd className="text-sm text-white/85 sm:text-right">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {isActive && (
                    <p className="mt-5 border-t border-white/5 pt-5 text-sm leading-relaxed text-white/65">
                      {p.summary}
                    </p>
                  )}
                </div>
              </details>
            </section>
          </Reveal>
        )}

        {/* ── Footer actions ──────────────────────────────────── */}
        <Reveal delay={0.25}>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={p.spec_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-cyan-500/30 hover:bg-white/10 hover:text-white"
            >
              Full spec on GitHub
            </Link>
            {isActive && (
              <Link
                href="https://t.me/magpie_capital_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-cyan-500/30 hover:bg-white/10 hover:text-white"
              >
                Vote via @magpie_capital_bot
              </Link>
            )}
          </div>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
