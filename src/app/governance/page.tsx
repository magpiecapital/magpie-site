import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Governance | Magpie",
  description:
    "How $MAGPIE holders influence protocol direction. Off-chain signal voting on collateral, tier parameters, and holder distributions, operator-honored within explicit scope.",
};

interface TierAItem {
  id: string;
  topic: string;
  bounds: string;
}

const TIER_A: TierAItem[] = [
  {
    id: "A1",
    topic: "Add or remove a collateral token",
    bounds:
      "Token must clear the screener's risk thresholds (oracle, liquidity, holder distribution). One token per proposal.",
  },
  {
    id: "A2",
    topic: "Adjust tier LTV cap",
    bounds:
      "Within ±5 percentage points of the current value. Per tier (Express / Quick / Standard), one change per proposal.",
  },
  {
    id: "A3",
    topic: "Adjust tier fee rate",
    bounds: "Within ±0.5 percentage points of the current value.",
  },
  {
    id: "A4",
    topic: "Adjust holder distribution share of loan fees",
    bounds: "Within 5% – 15% (currently 10%). Future loans only.",
  },
  {
    id: "A5",
    topic: "Adjust holder distribution cadence",
    bounds: "Within 3 – 14 days (currently randomized 5–10).",
  },
  {
    id: "A6",
    topic: "Non-binding signal poll on feature priorities",
    bounds: "Advisory only. Useful for ranking what to build next.",
  },
];

const TIER_B: string[] = [
  "Anything that affects active loans retroactively (loan terms are fixed at borrow time)",
  "On-chain safety configuration (security gauntlet, oracle config, anti-exploit gates)",
  "Founder identity, anonymity, or any operational security disclosure",
  "Treasury / lender-wallet allocation (operational SOL liquidity, not governance funds)",
  "Token supply changes (mint authority is revoked; supply is fixed)",
  "Pricing or scope of the x402 paid agent API",
];

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
        <Reveal>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-400" /> v0 — off-chain signal voting
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Governance</h1>
          <p className="mt-4 text-lg text-white/70">
            How $MAGPIE holders influence protocol direction. Off-chain signal voting on the
            levers that matter. Operator commits to honor passing votes within an explicit
            scope.
          </p>
        </Reveal>

        {/* Why this exists */}
        <Reveal delay={0.05}>
          <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">The model</h2>
            <ul className="mt-4 space-y-3 text-white/80">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>
                  <strong>$MAGPIE holders get real signal on protocol direction</strong> — not
                  just buy-and-hold dividends.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>
                  <strong>Scope is narrow and explicit.</strong> What's votable is enumerated
                  below. Everything else is operator discretion until the model evolves.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>
                  <strong>Operator commits to honor passing votes within scope.</strong>{" "}
                  Vetoing a passing vote within scope is a one-strike trust event.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>
                  <strong>The model evolves toward less operator discretion over time</strong>
                  {" — "} not the other way. v0 is signal voting; v1 introduces on-chain
                  parameter bounds; v2 is full on-chain governance.
                </span>
              </li>
            </ul>
          </section>
        </Reveal>

        {/* Voting power */}
        <Reveal delay={0.1}>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Voting power</h2>
            <p className="mt-3 text-white/70">
              Any wallet holding $MAGPIE at the time of proposal activation can vote.
              Voting weight is proportional to your balance — 1 token, 1 vote.
            </p>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="font-medium text-white/90">Excluded addresses</h3>
              <p className="mt-2 text-sm text-white/60">
                These addresses hold $MAGPIE for non-voter reasons and are excluded from the
                weight calculation:
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                <li>• Pump.fun bonding curve (now empty)</li>
                <li>• PumpSwap MAGPIE/SOL pool</li>
                <li>• Meteora MAGPIE/SOL pool</li>
                <li>• Future DEX pool token accounts</li>
                <li>• Magpie protocol lender / operator wallet</li>
                <li>• System / burn address</li>
              </ul>
            </div>
          </section>
        </Reveal>

        {/* Tier A — votable */}
        <Reveal delay={0.15}>
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">What's votable — Tier A</h2>
              <span className="text-xs uppercase tracking-wider text-cyan-300">
                operator honors pass
              </span>
            </div>
            <p className="mt-3 text-white/70">
              The operator commits to implement a passing Tier A vote within 14 days.
            </p>
            <div className="mt-5 space-y-3">
              {TIER_A.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                      {item.id}
                    </span>
                    <h3 className="font-medium text-white/90">{item.topic}</h3>
                  </div>
                  <p className="mt-2 text-sm text-white/60">{item.bounds}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Tier B — out of scope */}
        <Reveal delay={0.2}>
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">Out of scope — Tier B</h2>
              <span className="text-xs uppercase tracking-wider text-white/40">
                operator discretion
              </span>
            </div>
            <p className="mt-3 text-white/70">
              Cannot be put to a vote in v0. Listed explicitly so the boundary is unambiguous.
            </p>
            <ul className="mt-5 space-y-2.5 rounded-xl border border-white/10 bg-white/5 p-5">
              {TIER_B.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-white/70">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/30" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-white/50">
              To move an item from Tier B to Tier A, see the escalation path in{" "}
              <Link href="https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md#tier-c--escalation-path" className="text-cyan-300 underline">
                GOVERNANCE.md
              </Link>
              .
            </p>
          </section>
        </Reveal>

        {/* Lifecycle */}
        <Reveal delay={0.25}>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Proposal lifecycle</h2>
            <ol className="mt-5 space-y-4 text-white/80">
              <li className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">
                    1. Draft
                  </span>
                  <span className="text-sm text-white/60">in @magpietalk community</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Anyone can post a proposal idea in the community. Include scope tier
                  (A1–A6), exact change requested, rationale, and expected protocol impact.
                </p>
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">
                    2. Active
                  </span>
                  <span className="text-sm text-white/60">3-day voting window</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Operator pins the proposal here. Holders connect wallet and vote
                  YES / NO / ABSTAIN. Voting is gasless — votes are wallet-signed off-chain
                  messages. Aggregate tally publishes at vote close.
                </p>
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">
                    3. Closed
                  </span>
                  <span className="text-sm text-white/60">tally + threshold check</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  <strong className="text-white/90">Quorum:</strong> at least 5% of eligible
                  supply must vote YES + NO (abstain doesn't count). <br />
                  <strong className="text-white/90">Pass:</strong> 60% of (YES + NO) must be
                  YES.
                </p>
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                    4. Executed
                  </span>
                  <span className="text-sm text-white/60">within 14 days of pass</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Operator implements the change. On-chain changes have a public transaction
                  signature. Configuration changes have a commit referencing the proposal ID.
                </p>
              </li>
            </ol>
          </section>
        </Reveal>

        {/* Drafts in review */}
        <Reveal delay={0.28}>
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">Drafts in review</h2>
              <span className="text-xs uppercase tracking-wider text-white/40">
                pending operator scope review
              </span>
            </div>
            <p className="mt-3 text-white/70">
              These proposals are drafted and undergoing operator scope review (≤7 days per
              spec). Read them now; comment in @magpietalk. They become active when the operator
              activates them and voting opens.
            </p>
            <div className="mt-5 space-y-3">
              <Link
                href="https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-holder-distribution-share-15pct.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-500/30 hover:bg-white/10"
              >
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                    MGP-001
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/60">
                    Tier A4
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase text-white/40">
                    draft
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-white/90">
                  Increase $MAGPIE holder fee share from 10% to 15%
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  The 5-pp increase comes from the SOL LP share, which decreases from 80% to
                  75%. Other splits (referrer 5%, LP loyalty 2%, protocol 3%) unchanged.
                  Forward-only — does not affect distributions already accrued.
                </p>
              </Link>
              <Link
                href="https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-500/30 hover:bg-white/10"
              >
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                    MGP-003
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/60">
                    A6 (binding by commitment)
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase text-white/40">
                    draft · vote target 2026-06-12
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-white/90">
                  Allocation decision for the July 1 $MAGPIE Streamflow unlock (~5% of supply)
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  Five options: burn / re-lock 12 months / pro-rata to holders / utility-weighted
                  to users / hybrid (50% burn + 25% holders + 25% users). Operator commits to
                  honor the winning option as a one-time Tier-B-as-Tier-A exception. Execution
                  must complete within 14 days of the July 1 unlock.
                </p>
              </Link>
            </div>
          </section>
        </Reveal>

        {/* Active proposals */}
        <Reveal delay={0.3}>
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">Active proposals</h2>
              <span className="text-xs uppercase tracking-wider text-cyan-300">
                voting open
              </span>
            </div>
            <p className="mt-3 text-white/70">
              These proposals are open for voting. Each has a 3-day window from activation.
            </p>
            <div className="mt-5 space-y-3">
              <Link
                href="/governance/proposal/MGP-002"
                className="block rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-5 transition hover:border-cyan-400/60 hover:bg-cyan-500/15"
              >
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-cyan-500/30 px-2 py-0.5 font-mono text-xs text-cyan-100">
                    MGP-002
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/70">
                    Tier A6
                  </span>
                  <span className="rounded-md bg-cyan-500/30 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan-100">
                    active · signal poll
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-white/50">
                    closes 2026-06-12
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-white">
                  Should Magpie add a Premium tier — 30-day, 40% LTV, 5% fee, tokenized stocks only?
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  Non-binding signal poll across four sub-questions: add the Premium tier at
                  these parameters? · move loan-duration changes into Tier A scope? · launch
                  with a separate Premium liquidity pool? · are the eligibility screener gates
                  the right shape? Each tallied independently.
                </p>
                <p className="mt-3 text-xs text-cyan-300">Read the full proposal + intent
                  collection →</p>
              </Link>
            </div>
          </section>
        </Reveal>

        {/* Roadmap */}
        <Reveal delay={0.35}>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Roadmap</h2>
            <div className="mt-5 space-y-3 text-white/80">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-200">
                    v0
                  </span>
                  <span className="font-medium">Off-chain signal voting (current)</span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Holders vote with wallet signatures. Operator commits to honor.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">
                    v1
                  </span>
                  <span className="font-medium">On-chain parameter bounds</span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Configuration contract enforces Tier A bounds. Operator cannot change LTV /
                  fees / holder share outside the bounds without a new contract deploy.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">
                    v2
                  </span>
                  <span className="font-medium">Full on-chain governance</span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  SPL governance program. Token-weighted on-chain votes. Operator key authority
                  transitions to multisig + governance.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/50">
              No timeline commitments on v1 or v2. The model evolves when the protocol's track
              record warrants it.
            </p>
          </section>
        </Reveal>

        {/* Links */}
        <Reveal delay={0.4}>
          <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Full spec + machine-readable</h2>
            <ul className="mt-4 space-y-2 text-white/70">
              <li>
                <Link
                  href="https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md"
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  GOVERNANCE.md
                </Link>{" "}
                — canonical v0 spec
              </li>
              <li>
                <Link href="/api/v1/governance" className="text-cyan-300 hover:text-cyan-200">
                  /api/v1/governance
                </Link>{" "}
                — machine-readable model (for agents, aggregators, integrators)
              </li>
              <li>
                <Link
                  href="https://t.me/magpietalk"
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  @magpietalk
                </Link>{" "}
                — where drafts and discussion happen
              </li>
              <li>
                <Link
                  href="https://github.com/magpiecapital/magpie-site/issues"
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  GitHub issues
                </Link>{" "}
                — formal proposals for model changes
              </li>
            </ul>
          </section>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
