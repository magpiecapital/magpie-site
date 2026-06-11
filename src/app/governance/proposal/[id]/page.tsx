import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoteButtons } from "./VoteButtons";
import { VotingCountdown } from "./VotingCountdown";
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        {/* ── Heading ─────────────────────────────────────────── */}
        <Reveal>
          <Link
            href="/governance"
            className="text-xs uppercase tracking-wider text-white/50 hover:text-white/80"
          >
            ← back to governance
          </Link>
          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="rounded-md bg-cyan-500/30 px-2.5 py-1 font-mono text-xs text-cyan-100">
              {p.id}
            </span>
            <span
              className={
                isActive
                  ? "rounded-md bg-emerald-500/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-100"
                  : "rounded-md bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60"
              }
            >
              {p.status === "active" ? "voting open" : p.status}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {p.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/75">{p.tldr}</p>
        </Reveal>

        {/* ── Vote card (the action) ──────────────────────────── */}
        {isActive && p.questions && (
          <Reveal delay={0.05}>
            <section className="mt-10 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-cyan-500/0 p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold">Cast your vote</h2>
                <VotingCountdown closesAtIso={p.closes_at_iso} />
              </div>
              <p className="mt-2 text-sm text-white/60">{p.voting_window_human}</p>

              {p.questions.map((q) => (
                <div key={q.id} className="mt-5">
                  <p className="text-white/85">{q.text}</p>
                  {q.choices && (
                    <VoteButtons
                      proposalId={p.id}
                      questionId={q.id}
                      choices={q.choices}
                      botApiUrl={botApiUrl}
                      opensAtIso={p.opens_at_iso}
                    />
                  )}
                </div>
              ))}

              <p className="mt-5 text-xs text-white/50">
                Wallet message-sign only. No SOL moves. Re-vote any time before close — latest signature wins.
              </p>
            </section>
          </Reveal>
        )}

        {!isActive && (
          <Reveal delay={0.05}>
            <section className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
              <p className="text-sm text-white/70">
                <strong className="text-white/90">{p.voting_window_human}.</strong>{" "}
                {p.summary}
              </p>
            </section>
          </Reveal>
        )}

        {/* ── Details ─────────────────────────────────────────── */}
        {p.parameters && (
          <Reveal delay={0.1}>
            <section className="mt-12">
              <h2 className="text-xl font-semibold">Details</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <tbody>
                    {p.parameters.map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? "bg-white/5" : ""}>
                        <td className="px-5 py-3 font-medium text-white/80">{row.label}</td>
                        <td className="px-5 py-3 text-white/70">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isActive && (
                <p className="mt-5 text-sm leading-relaxed text-white/70">{p.summary}</p>
              )}
            </section>
          </Reveal>
        )}

        {/* ── How to vote ──────────────────────────────────────── */}
        {isActive && (
          <Reveal delay={0.15}>
            <section className="mt-12 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-semibold">How to vote</h2>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-white/70">
                <li>
                  <strong className="text-white/90">1.</strong> Connect a Phantom / Solflare / Backpack wallet (any that supports signMessage).
                </li>
                <li>
                  <strong className="text-white/90">2.</strong> Click YES / NO / ABSTAIN above. The wallet pops a tiny message-sign — no SOL leaves your wallet, no gas.
                </li>
                <li>
                  <strong className="text-white/90">3.</strong> Your voting weight is your $MAGPIE balance at the snapshot taken at vote activation (held tokens + collateralized tokens both count 1:1). Check it on the dashboard.
                </li>
                <li>
                  <strong className="text-white/90">4.</strong> Re-vote any time before close. Aggregate result publishes at close; per-wallet choices stay private.
                </li>
              </ol>
              <p className="mt-4 text-xs text-white/50">
                Prefer Telegram?{" "}
                <Link href="https://t.me/magpie_capital_bot" className="text-cyan-300 hover:text-cyan-200">
                  DM @magpie_capital_bot
                </Link>{" "}
                and run /votingpower to see your weight.
              </p>
            </section>
          </Reveal>
        )}

        {/* ── Full spec link ──────────────────────────────────── */}
        <Reveal delay={0.2}>
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
