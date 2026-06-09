import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoteButtons } from "./VoteButtons";
import type { VoteChoice } from "@/lib/solana/site-governance-vote";

interface ProposalQuestion {
  id: string;
  text: string;
  choices?: VoteChoice[];
}

interface Proposal {
  id: string;
  title: string;
  scope_tier: string;
  status: "draft" | "active" | "closed" | "executed" | "failed";
  voting_window: string;
  activated_at?: string;
  closes_at?: string;
  summary: string;
  spec_url: string;
  questions?: ProposalQuestion[];
  parameters?: { label: string; value: string }[];
}

const PROPOSALS: Record<string, Proposal> = {
  "MGP-001": {
    id: "MGP-001",
    title: "Restructure the loan-fee split — 60% to $MAGPIE holders, 30% to SOL LPs",
    scope_tier: "A4 — binding by operator commitment (one-time Tier B → de-facto Tier A exception)",
    status: "active",
    voting_window: "2026-06-09 to 2026-06-12 (3 days)",
    activated_at: "2026-06-09",
    closes_at: "2026-06-12",
    summary:
      "Rescoped on 2026-06-09 from the earlier 10→15% incremental step to put the full long-term target directly on the ballot. Shift 50 percentage points from the SOL LP share (80% → 30%) to the $MAGPIE holder share (10% → 60%). Other splits (referrer 5%, LP loyalty 2%, protocol 3%) unchanged. The 60% holder share is outside the Tier A4 5%–15% bound; this proposal is filed as a one-time operator-committed Tier B → de-facto Tier A exception, the same path documented in MGP-003. Forward-only — does not affect distributions already accrued.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-holder-distribution-share-15pct.md",
    parameters: [
      { label: "Current holder share", value: "10% (1,000 BPS)" },
      { label: "Proposed holder share", value: "60% (6,000 BPS)" },
      { label: "Current LP share", value: "80% (8,000 BPS)" },
      { label: "Proposed LP share", value: "30% (3,000 BPS)" },
      { label: "Source of the 50-pp increase", value: "Reduction of LP share (80% → 30%)" },
      { label: "Other splits", value: "Referrer 5%, LP loyalty 2%, protocol 3% — unchanged" },
      { label: "Effective on", value: "Loans originated after execution (forward-only)" },
      { label: "Scope tier", value: "Outside A4 5–15% bound; one-time operator-committed exception" },
      { label: "Execution path", value: "Single BPS constant change in magpie-bot/src/services/magpie-holder-rewards.js:43 (HOLDER_REWARD_BPS = 1,000 → 6,000)" },
    ],
    questions: [
      {
        id: "Vote",
        text: "Should HOLDER_REWARD_BPS change from 1,000 (10%) to 6,000 (60%), with the implicit 50-pp reduction coming from the LP share (8,000 → 3,000 BPS)? YES to adopt the change. NO to keep the current split. ABSTAIN if you want operator discretion to choose.",
        choices: ["YES", "NO", "ABSTAIN"],
      },
    ],
  },
  "MGP-003": {
    id: "MGP-003",
    title:
      "Allocation decision for the July 1, 2026 $MAGPIE Streamflow unlock (~5% of supply)",
    scope_tier: "A6 — binding by operator commitment (one-time Tier B → de-facto Tier A exception)",
    status: "draft",
    voting_window: "Target: 2026-06-12 to 2026-06-15 (3 days)",
    activated_at: undefined,
    closes_at: "2026-06-15",
    summary:
      "On July 1, 2026 a Streamflow contract holding ~5% of $MAGPIE supply (~50M tokens) unlocks. Five options on the ballot: burn, re-lock 12 months, pro-rata distribution to holders (30-day stream), utility-weighted distribution to protocol users (30-day stream), or hybrid (50% burn + 25% holders + 25% users). Operator commits to honor the winning option as a one-time Tier B → de-facto-Tier-A exception. Execution must complete within 14 days of unlock.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
    parameters: [
      { label: "Streamflow contract", value: "GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc" },
      { label: "Unlock date", value: "2026-07-01" },
      { label: "Allocation size", value: "~5% of total supply (~50M $MAGPIE)" },
      { label: "Quorum requirement", value: "≥ 7.5% of eligible supply (non-ABSTAIN)" },
      { label: "Pass threshold", value: "Plurality, winner > 40% of cast votes" },
      { label: "Operator discretion fallback", value: "Triggered if ABSTAIN ≥ 30% or quorum fails" },
      { label: "Execution window", value: "≤ 14 days after July 1 unlock" },
    ],
    questions: [
      {
        id: "Vote",
        text: "Pick ONE option. A = burn the full ~50M; B = re-lock for 12 months; C = pro-rata distribution to $MAGPIE holders over 30 days; D = utility-weighted distribution to protocol users over 30 days; E = hybrid (50% burn + 25% holders + 25% users); ABSTAIN = defer to operator discretion.",
        choices: ["A", "B", "C", "D", "E", "ABSTAIN"],
      },
    ],
  },
  "MGP-002": {
    id: "MGP-002-withdrawn",
    title: "[WITHDRAWN] Signal poll on the Premium tier",
    scope_tier: "A6 — withdrawn before close",
    status: "failed",
    voting_window: "2026-06-09 (withdrawn same day)",
    activated_at: "2026-06-09",
    closes_at: "2026-06-09",
    summary:
      "Withdrawn 2026-06-09. The operator activated MGP-002 as a non-binding signal poll on whether to add a Premium tier, then chose to ship the tier directly under Tier B operator discretion (with both 15-day and 30-day duration options, tokenized stocks only). Tier B is the legitimate path for loan-duration adjustments and new-tier additions in v0; this poll explored whether to move them into Tier A via a Tier C escalation. The operator's choice not to escalate is within scope. Execution plan: magpie-bot/docs/PREMIUM-TIER-DEPLOY-PLAN-2026-06-09.md.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
    parameters: [
      { label: "Status", value: "Withdrawn before close" },
      { label: "Reason", value: "Operator chose to ship under Tier B discretion (both 15-day + 30-day, stocks only)" },
      { label: "Execution plan", value: "magpie-bot/docs/PREMIUM-TIER-DEPLOY-PLAN-2026-06-09.md" },
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
    description: p.summary,
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
  // Same fallback as StatusClient.tsx + LeaderboardClient.tsx — keeps the
  // vote flow working even if NEXT_PUBLIC_BOT_API_URL isn't set on Vercel.
  const botApiUrl =
    process.env.NEXT_PUBLIC_BOT_API_URL ||
    "https://magpie-bot-production.up.railway.app";

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        <Reveal>
          <Link
            href="/governance"
            className="text-xs uppercase tracking-wider text-white/50 hover:text-white/80"
          >
            ← back to governance
          </Link>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="rounded-md bg-cyan-500/30 px-2 py-0.5 font-mono text-xs text-cyan-100">
              {p.id}
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/70">
              {p.scope_tier}
            </span>
            <span
              className={
                isActive
                  ? "rounded-md bg-cyan-500/30 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan-100"
                  : "rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/60"
              }
            >
              {p.status}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{p.title}</h1>
          <p className="mt-4 text-lg text-white/70">{p.summary}</p>
        </Reveal>

        {/* Voting window */}
        <Reveal delay={0.05}>
          <section className="mt-12 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/50">
                  Voting window
                </p>
                <p className="mt-1 font-medium text-white/90">{p.voting_window}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/50">
                  Voting weight
                </p>
                <p className="mt-1 text-sm text-white/70">
                  1 token = 1 vote, based on your $MAGPIE balance at proposal activation.
                  Mechanism specifics operator-internal in v0.
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Parameters */}
        {p.parameters && (
          <Reveal delay={0.1}>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold">Proposed parameters</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <tbody>
                    {p.parameters.map((row, i) => (
                      <tr
                        key={row.label}
                        className={
                          i % 2 === 0 ? "bg-white/5" : ""
                        }
                      >
                        <td className="px-5 py-3 font-medium text-white/80">{row.label}</td>
                        <td className="px-5 py-3 text-white/70">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </Reveal>
        )}

        {/* Questions */}
        {p.questions && (
          <Reveal delay={0.15}>
            <section className="mt-12">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-semibold">Questions</h2>
                <span className="text-xs uppercase tracking-wider text-white/40">
                  each tallied independently
                </span>
              </div>
              <p className="mt-3 text-white/70">
                Vote YES, NO, or ABSTAIN on each question. A simple-majority YES on any
                individual question signals holder support for that direction.
              </p>
              <div className="mt-5 space-y-3">
                {p.questions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                        {q.id}
                      </span>
                    </div>
                    <p className="mt-3 text-white/90">{q.text}</p>
                    {isActive && q.choices && (
                      <VoteButtons
                        proposalId={p.id}
                        questionId={q.id}
                        choices={q.choices}
                        botApiUrl={botApiUrl}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* How to vote */}
        <Reveal delay={0.2}>
          <section className="mt-12 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">How to vote</h2>
            <p className="mt-3 text-white/70">
              <strong className="text-white/90">v0 voting model:</strong> connect your
              Solana wallet, click a choice on each question above, and approve the
              wallet&apos;s message-sign prompt. No on-chain transaction; no gas. Your signed
              payload is recorded on-server.
            </p>
            <ol className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <strong className="text-white/90">1.</strong> Read the full proposal on{" "}
                <Link href={p.spec_url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
                  GitHub
                </Link>
                .
              </li>
              <li>
                <strong className="text-white/90">2.</strong> Connect a wallet that supports
                signMessage (Phantom, Solflare, Backpack, etc.). Click YES / NO / ABSTAIN
                (or A–E for option-style polls) on each question. The wallet asks you to
                sign a small JSON payload — no SOL moves.
              </li>
              <li>
                <strong className="text-white/90">3.</strong> You can change your vote at
                any time before the voting window closes. The latest valid signature wins
                at tally.
              </li>
              <li>
                <strong className="text-white/90">4.</strong> Aggregate result publishes at
                voting close ({p.closes_at}). Per-wallet vote choices are not published;
                only aggregate weights.
              </li>
            </ol>
            <p className="mt-4 text-xs text-white/50">
              Prefer Telegram? Post your intent in{" "}
              <Link href="https://t.me/magpietalk" className="text-cyan-300 hover:text-cyan-200">
                @magpietalk
              </Link>{" "}
              instead — the operator folds those in too. Wallet-signed votes have priority
              if you submit both.
            </p>
          </section>
        </Reveal>

        {/* Full spec link */}
        <Reveal delay={0.25}>
          <section className="mt-12">
            <Link
              href={p.spec_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:border-cyan-500/30 hover:bg-white/10 hover:text-white"
            >
              Read the full {p.id} spec on GitHub →
            </Link>
          </section>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
