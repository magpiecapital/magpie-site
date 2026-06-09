import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface ProposalQuestion {
  id: string;
  text: string;
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
  "MGP-002": {
    id: "MGP-002",
    title:
      "Should Magpie add a Premium tier (30-day, 40% LTV, 5% fee, tokenized stocks only)?",
    scope_tier: "A6 — non-binding signal poll",
    status: "active",
    voting_window: "2026-06-09 to 2026-06-12 (3 days)",
    activated_at: "2026-06-09",
    closes_at: "2026-06-12",
    summary:
      "A non-binding signal poll asking $MAGPIE holders four independent questions about a proposed Premium loan tier — longer duration, higher LTV, higher fee, restricted to tokenized-stock collateral. Results inform whether to proceed with a Tier C scope amendment and a v3 program deploy.",
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
    parameters: [
      { label: "Term", value: "30 days" },
      { label: "LTV cap", value: "40%" },
      { label: "Upfront fee", value: "5%" },
      { label: "Eligible collateral", value: "Tokenized stocks only (whitelist gated)" },
      { label: "Per-loan cap (initial)", value: "10 SOL" },
      { label: "Per-token aggregate cap (initial)", value: "10 SOL" },
      { label: "Liquidity pool", value: "Separate from existing pool (proposed)" },
    ],
    questions: [
      {
        id: "Q1",
        text: "Magpie should add a Premium tier with the parameters above (30-day, 40% LTV, 5% fee, tokenized stocks only).",
      },
      {
        id: "Q2",
        text: "Loan-duration adjustments should move from operator discretion into Tier A governance scope via a Tier C scope-amendment proposal (so future tier-duration changes are votable).",
      },
      {
        id: "Q3",
        text: "The Premium tier should launch with a separate liquidity pool rather than sharing the existing pool's LP capital.",
      },
      {
        id: "Q4",
        text: "The eligibility screener parameters (stock-category gate + per-pool whitelist + institutional price-feed health + 24h volume floor + liquidation-solvability simulation + clean-credit requirement) are the right shape.",
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
              <strong className="text-white/90">v0 voting model:</strong> the wallet-signed
              on-site vote-submission flow is under development. While it lands, the
              operator collects holder intent in <Link href="https://t.me/magpietalk" className="text-cyan-300 hover:text-cyan-200">@magpietalk</Link>.
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
                <strong className="text-white/90">2.</strong> Open{" "}
                <Link href="https://t.me/magpietalk" className="text-cyan-300 hover:text-cyan-200">
                  @magpietalk
                </Link>{" "}
                and post your intent. Format example:
                <code className="mt-2 block rounded-md bg-black/40 p-3 font-mono text-xs text-cyan-200">
                  MGP-002 vote · Q1: YES · Q2: YES · Q3: YES · Q4: YES
                </code>
              </li>
              <li>
                <strong className="text-white/90">3.</strong> The operator tallies intents
                against $MAGPIE balances at the activation-time vote-weight basis. Per-wallet
                votes are not published; aggregate results are.
              </li>
              <li>
                <strong className="text-white/90">4.</strong> Aggregate result publishes at
                voting close ({p.closes_at}).
              </li>
            </ol>
            <p className="mt-4 text-xs text-white/50">
              The on-site wallet-signed vote flow lands shortly. Once active, intents
              registered in @magpietalk are folded in automatically.
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
