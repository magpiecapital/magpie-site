import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoteButtons } from "./VoteButtons";
import { VotingCountdown } from "./VotingCountdown";
import { LiveResults } from "./LiveResults";
import type { VoteChoice } from "@/lib/solana/site-governance-vote";

interface ProposalQuestion {
  id: string;
  text: string;
  choices?: VoteChoice[];
}

interface Proposal {
  id: string;
  title: string;
  tldr: string;
  status: "draft" | "active" | "closed" | "executed" | "failed";
  opens_at_iso: string;
  closes_at_iso: string;
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
      "Send 70% of every loan fee to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, and 10% to the protocol reserve. Replaces the current 10% holder share.",
    status: "active",
    opens_at_iso: "2026-06-10T20:40:00Z",
    closes_at_iso: "2026-06-13T20:40:00Z",
    voting_window_human: "Opens 2026-06-10 20:40 UTC · closes 2026-06-13 20:40 UTC (72h)",
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
        text:
          "Adopt the 70/10/10/10 loan-fee split? YES adopts the split. NO keeps the current split. ABSTAIN defers to operator discretion.",
        choices: ["YES", "NO", "ABSTAIN"],
      },
    ],
  },
  "MGP-002": {
    id: "MGP-002",
    title: "[WITHDRAWN] Signal poll on the Premium tier",
    tldr:
      "Operator activated this as a non-binding signal poll, then chose to ship the Premium tier under Tier B discretion. Withdrawn before close.",
    status: "failed",
    opens_at_iso: "2026-06-09T00:00:00Z",
    closes_at_iso: "2026-06-09T23:59:59Z",
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
      "On July 1, 2026, a Streamflow contract holding ~5% of $MAGPIE supply unlocks. Vote on what happens with it — burn, re-lock, distribute to holders, distribute to users, or hybrid.",
    status: "active",
    opens_at_iso: "2026-06-12T00:00:00Z",
    closes_at_iso: "2026-06-15T23:59:59Z",
    voting_window_human: "Opens 2026-06-12 · closes 2026-06-15 (3 days)",
    summary:
      "On July 1, 2026 a Streamflow contract holding ~5% of $MAGPIE supply (~50M tokens) unlocks. Five options on the ballot: burn, re-lock 12 months, pro-rata distribution to holders (30-day stream), utility-weighted distribution to protocol users (30-day stream), or hybrid (50% burn + 25% holders + 25% users). Operator commits to honor the winning option. Execution must complete within 14 days of unlock.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
    parameters: [
      { label: "Streamflow contract", value: "GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc" },
      { label: "Unlock date", value: "2026-07-01" },
      { label: "Allocation size", value: "~5% of total supply (~50M $MAGPIE)" },
      { label: "Quorum requirement", value: "≥ 7.5% of eligible supply (non-ABSTAIN)" },
      { label: "Pass threshold", value: "Plurality, winner > 40% of cast votes" },
      { label: "Execution window", value: "≤ 14 days after July 1 unlock" },
    ],
    questions: [
      {
        id: "Vote",
        text:
          "Pick ONE option. A = burn the full ~50M. B = re-lock for 12 months. C = pro-rata distribution to $MAGPIE holders over 30 days. D = utility-weighted distribution to protocol users over 30 days. E = hybrid (50% burn + 25% holders + 25% users). ABSTAIN = defer to operator discretion.",
        choices: ["A", "B", "C", "D", "E", "ABSTAIN"],
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

  const isActive = p.status === "active";
  const botApiUrl =
    process.env.NEXT_PUBLIC_BOT_API_URL ||
    "https://magpie-bot-production.up.railway.app";
  const question = p.questions?.[0];

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
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
              {p.status === "active" ? "live" : p.status}
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
                  <VotingCountdown closesAtIso={p.closes_at_iso} />
                </div>
              </div>
              <div className="px-5 py-6 sm:px-6">
                {question.choices && (
                  <VoteButtons
                    proposalId={p.id}
                    questionId={question.id}
                    choices={question.choices}
                    botApiUrl={botApiUrl}
                    opensAtIso={p.opens_at_iso}
                  />
                )}
                <p className="mt-4 text-xs leading-relaxed text-white/45">
                  Wallet message-sign only. No SOL moves, no gas. Re-vote any time before close — latest signature wins.
                </p>
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

        {/* ── Live results ─────────────────────────────────────── */}
        {isActive && question?.choices && (
          <Reveal delay={0.1}>
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
                  Live results
                </h2>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200/80">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  refreshes every 30s
                </span>
              </div>
              <LiveResults
                proposalId={p.id}
                botApiUrl={botApiUrl}
                choices={question.choices}
              />
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
                Anyone holding $MAGPIE at the activation snapshot. Tokens you have <strong className="text-white/95">on-loan as collateral</strong> count 1:1 alongside tokens in your wallet — using Magpie doesn&apos;t reduce your governance weight. LP providers in the SOL pool are also credited.
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
