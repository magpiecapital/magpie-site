import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MiniLiveResults } from "./MiniLiveResults";
import { GovernanceCountdown } from "./GovernanceCountdown";
import { formatEst } from "@/lib/time";

export const metadata = {
  title: "Governance | Magpie",
  description:
    "Active proposals, completed votes, and the model that governs them. $MAGPIE holders vote on the levers that matter; operator commits to honor within explicit scope.",
};

// ─── Proposal registry ────────────────────────────────────────────────────
//
// Add new entries here as proposals move through the lifecycle. The page
// auto-buckets by `status.kind` into Active / Drafts / Completed.

type ResultSummary = {
  yes_pct: number;
  no_pct: number;
  abstain_pct: number;
  participation_pct: number;
  quorum_pct: number;
  threshold_pct: number;
  notes?: string;
};

type ProposalStatus =
  | { kind: "active"; opens_at_iso: string; closes_at_iso: string }
  | { kind: "draft"; activates_target_iso?: string }
  | { kind: "withdrawn"; withdrawn_at_iso: string; reason: string }
  | { kind: "passed"; closed_at_iso: string; outcome: ResultSummary; executed_at_iso?: string; execution_notes?: string }
  | { kind: "failed"; closed_at_iso: string; outcome: ResultSummary };

type ProposalCard = {
  id: string;
  scope_letter: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "B-as-A";
  title: string;
  tldr: string;
  status: ProposalStatus;
  spec_url: string;
};

const PROPOSALS: ProposalCard[] = [
  {
    id: "MGP-001",
    scope_letter: "A4",
    title: "Restructure the loan-fee split — 70/10/10/10",
    tldr:
      "Send 70% of every loan fee to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, and 10% to the protocol reserve. Replaces the current 10% holder share.",
    status: {
      kind: "active",
      opens_at_iso: "2026-06-10T22:00:00Z",
      closes_at_iso: "2026-06-13T22:00:00Z",
    },
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-fee-split-70-10-10-10.md",
  },
  {
    id: "MGP-003",
    scope_letter: "B-as-A",
    title: "July 1, 2026 $MAGPIE Streamflow unlock allocation (~5% of supply)",
    tldr:
      "Pick what happens with the ~50M $MAGPIE that unlocks on July 1: burn, re-lock 12 months, pro-rata to holders, utility-weighted to users, or hybrid (50% burn + 25% holders + 25% users). Five-option ballot.",
    status: { kind: "draft", activates_target_iso: "2026-06-12T00:00:00Z" },
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
  },
  {
    id: "MGP-002",
    scope_letter: "A6",
    title: "Signal poll on adding a Premium loan tier",
    tldr:
      "Non-binding signal poll on whether to add a Premium tier for tokenized stocks with longer durations.",
    status: {
      kind: "withdrawn",
      withdrawn_at_iso: "2026-06-09T00:00:00Z",
      reason:
        "Operator shipped the Premium tier directly under Tier-B discretion (15-day and 30-day durations, tokenized stocks only). Vote became redundant before it opened.",
    },
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
  },
];

// ─── Static reference content ─────────────────────────────────────────────

const TIER_A = [
  { id: "A1", topic: "Add or remove a collateral token", bounds: "Token must clear the screener's risk thresholds. One token per proposal." },
  { id: "A2", topic: "Adjust tier LTV cap", bounds: "Within ±5 percentage points of the current value, per tier." },
  { id: "A3", topic: "Adjust tier fee rate", bounds: "Within ±0.5 percentage points of the current value." },
  { id: "A4", topic: "Adjust holder distribution share of loan fees", bounds: "Within 5%–80% of total fees. Future loans only." },
  { id: "A5", topic: "Adjust holder distribution cadence", bounds: "Within 3–14 days (currently randomized 5–10)." },
  { id: "A6", topic: "Non-binding signal poll on feature priorities", bounds: "Advisory only. Useful for ranking what to build next." },
];

const TIER_B = [
  "Anything that affects active loans retroactively (loan terms are fixed at borrow time)",
  "On-chain safety configuration (security gauntlet, oracle config, anti-exploit gates)",
  "Founder identity, anonymity, or any operational security disclosure",
  "Treasury / lender-wallet allocation (operational SOL liquidity, not governance funds)",
  "Token supply changes (mint authority is revoked; supply is fixed)",
  "Pricing or scope of the x402 paid agent API",
];

const ROADMAP = [
  { phase: "v0", current: true, title: "Off-chain signal voting", detail: "Holders vote with wallet signatures. Operator commits to honor passing votes within Tier A scope." },
  { phase: "v1", current: false, title: "On-chain parameter bounds", detail: "Configuration contract enforces Tier A bounds. Operator cannot change LTV / fees / holder share outside the bounds without a new contract deploy." },
  { phase: "v2", current: false, title: "Full on-chain governance", detail: "SPL governance program. Token-weighted on-chain votes. Operator key authority transitions to multisig + governance." },
];

// ─── Page-level helpers ───────────────────────────────────────────────────

function statusBadge(s: ProposalStatus) {
  switch (s.kind) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-100">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          live
        </span>
      );
    case "draft":
      return (
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
          draft
        </span>
      );
    case "passed":
      return (
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200">
          passed
        </span>
      );
    case "failed":
      return (
        <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-200">
          failed
        </span>
      );
    case "withdrawn":
      return (
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/55">
          withdrawn
        </span>
      );
  }
}

function statusSubline(s: ProposalStatus) {
  switch (s.kind) {
    case "active":
      return (
        <>
          <GovernanceCountdown targetIso={s.closes_at_iso} label="left" /> · closes {formatEst(s.closes_at_iso)}
        </>
      );
    case "draft":
      return s.activates_target_iso ? (
        <>
          <GovernanceCountdown targetIso={s.activates_target_iso} label="until open" /> · opens {formatEst(s.activates_target_iso)}
        </>
      ) : (
        <>pending operator scope review</>
      );
    case "passed":
      return (
        <>
          closed {formatEst(s.closed_at_iso)}
          {s.executed_at_iso ? ` · executed ${formatEst(s.executed_at_iso)}` : " · execution pending"}
        </>
      );
    case "failed":
      return <>closed {formatEst(s.closed_at_iso)}</>;
    case "withdrawn":
      return <>withdrawn {formatEst(s.withdrawn_at_iso)}</>;
  }
}

function ProposalCardView({ p, botApiUrl }: { p: ProposalCard; botApiUrl: string }) {
  const isActive = p.status.kind === "active";
  const isDraft = p.status.kind === "draft";
  const isWithdrawn = p.status.kind === "withdrawn";

  return (
    <div
      className={
        "rounded-2xl border p-5 transition sm:p-6 " +
        (isActive
          ? "border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.08] to-transparent"
          : isDraft
            ? "border-amber-500/25 bg-amber-500/[0.04]"
            : "border-white/10 bg-white/[0.025]")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            "rounded-md px-2 py-0.5 font-mono text-[11px] " +
            (isActive ? "bg-cyan-500/25 text-cyan-100" : "bg-white/10 text-white/75")
          }
        >
          {p.id}
        </span>
        {statusBadge(p.status)}
        <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/45">
          scope {p.scope_letter}
        </span>
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-white/40 sm:inline">
          {statusSubline(p.status)}
        </span>
      </div>

      <h3
        className={
          "mt-3 text-base font-medium leading-snug sm:text-lg " +
          (isActive ? "text-white" : isWithdrawn ? "text-white/70" : "text-white/90")
        }
      >
        {p.title}
      </h3>
      <p className={"mt-2 text-sm leading-relaxed " + (isWithdrawn ? "text-white/50" : "text-white/65")}>
        {p.tldr}
      </p>

      <div className="mt-2.5 font-mono text-[10px] uppercase tracking-wider text-white/40 sm:hidden">
        {statusSubline(p.status)}
      </div>

      {/* Inline live preview for active proposals */}
      {isActive && <MiniLiveResults proposalId={p.id} botApiUrl={botApiUrl} />}

      {/* Result summary for closed proposals */}
      {(p.status.kind === "passed" || p.status.kind === "failed") && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultPill label="YES" value={`${p.status.outcome.yes_pct.toFixed(1)}%`} tone={p.status.kind === "passed" ? "emerald" : "neutral"} />
          <ResultPill label="NO" value={`${p.status.outcome.no_pct.toFixed(1)}%`} tone="neutral" />
          <ResultPill label="Participation" value={`${p.status.outcome.participation_pct.toFixed(1)}%`} tone="neutral" />
          <ResultPill label="Quorum" value={`${p.status.outcome.quorum_pct}% req`} tone="neutral" />
        </div>
      )}

      {p.status.kind === "withdrawn" && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3 text-xs text-white/55">
          <strong className="text-white/75">Why:</strong> {p.status.reason}
        </div>
      )}
      {p.status.kind === "passed" && p.status.execution_notes && (
        <div className="mt-4 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3 text-xs text-white/65">
          <strong className="text-emerald-200">Implementation:</strong> {p.status.execution_notes}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {isActive && (
          <Link
            href={`/governance/proposal/${p.id}`}
            className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-medium uppercase tracking-wider text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/25"
          >
            Vote & read full proposal →
          </Link>
        )}
        {!isActive && (
          <Link
            href={`/governance/proposal/${p.id}`}
            className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium uppercase tracking-wider text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            {isDraft ? "Read draft" : "Read details"}
          </Link>
        )}
        <Link
          href={p.spec_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/10 bg-transparent px-3.5 py-2 text-xs font-medium uppercase tracking-wider text-white/55 transition hover:border-white/25 hover:text-white/80"
        >
          Full spec on GitHub
        </Link>
      </div>
    </div>
  );
}

function ResultPill({ label, value, tone }: { label: string; value: string; tone: "emerald" | "neutral" }) {
  const toneClass = tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/5";
  return (
    <div className={`rounded-lg border ${toneClass} px-3 py-2`}>
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-white/90 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const botApiUrl =
    process.env.NEXT_PUBLIC_BOT_API_URL ||
    "https://magpie-bot-production.up.railway.app";

  const active = PROPOSALS.filter((p) => p.status.kind === "active");
  const drafts = PROPOSALS.filter((p) => p.status.kind === "draft");
  const completed = PROPOSALS.filter((p) =>
    p.status.kind === "passed" || p.status.kind === "failed" || p.status.kind === "withdrawn",
  );

  // Stat-strip numbers — derive from the registry where reasonable;
  // hardcode operator-confirmed numbers where the registry is too thin.
  const totalProposals = PROPOSALS.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/[0.07] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
            v0 — off-chain signal voting
          </div>
          <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">
            Governance
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            $MAGPIE holders vote on the levers that shape the protocol. The operator commits to honor passing votes within an explicit scope.
          </p>
        </Reveal>

        {/* ── Stats strip ─────────────────────────────────────── */}
        <Reveal delay={0.05}>
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Proposals" value={String(totalProposals)} />
            <Stat label="Active" value={String(active.length)} accent={active.length > 0} />
            <Stat label="Eligible voters" value="2,185" sub="snapshot" />
            <Stat label="$MAGPIE eligible" value="759M" sub="held + on-loan" />
          </div>
        </Reveal>

        {/* ── Active proposals ────────────────────────────────── */}
        {active.length > 0 && (
          <Reveal delay={0.1}>
            <SectionHeading
              label="Active"
              count={active.length}
              hint="Open for voting. Closes at the listed Eastern time."
              dotClass="bg-emerald-300"
            />
            <div className="mt-5 space-y-4">
              {active.map((p) => (
                <ProposalCardView key={p.id} p={p} botApiUrl={botApiUrl} />
              ))}
            </div>
          </Reveal>
        )}

        {/* ── Drafts in review ────────────────────────────────── */}
        {drafts.length > 0 && (
          <Reveal delay={0.15}>
            <SectionHeading
              label="Drafts"
              count={drafts.length}
              hint="In operator scope review. Will activate on the listed date."
              dotClass="bg-amber-300"
            />
            <div className="mt-5 space-y-4">
              {drafts.map((p) => (
                <ProposalCardView key={p.id} p={p} botApiUrl={botApiUrl} />
              ))}
            </div>
          </Reveal>
        )}

        {/* ── Completed proposals ─────────────────────────────── */}
        {completed.length > 0 && (
          <Reveal delay={0.2}>
            <SectionHeading
              label="Completed"
              count={completed.length}
              hint="Closed, passed, failed, or withdrawn. Final tallies on each card."
              dotClass="bg-white/40"
            />
            <div className="mt-5 space-y-4">
              {completed.map((p) => (
                <ProposalCardView key={p.id} p={p} botApiUrl={botApiUrl} />
              ))}
            </div>
          </Reveal>
        )}

        {/* ── How governance works (collapsed by default) ─────── */}
        <Reveal delay={0.25}>
          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
              How it works
            </h2>
            <div className="mt-4 space-y-3">
              <Disclosure
                title="Voting power"
                summary="1 token, 1 vote — and your $MAGPIE on-loan as collateral counts the same as the $MAGPIE in your wallet."
              >
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Any wallet holding $MAGPIE at the time of proposal activation can vote. Voting weight is proportional to your balance — <strong className="text-white/85">tokens you have on-loan as collateral count 1:1 alongside tokens in your wallet</strong>, so using the protocol doesn&apos;t reduce your governance say. LP providers in the SOL pool are also credited.
                </p>
                <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-white/55">
                    Excluded addresses
                  </h4>
                  <p className="mt-2 text-xs text-white/55">
                    These hold $MAGPIE for non-voter reasons and are filtered out of the weight calculation:
                  </p>
                  <ul className="mt-3 grid gap-1.5 text-xs text-white/65 sm:grid-cols-2">
                    <li>• Pump.fun bonding curve (now empty)</li>
                    <li>• PumpSwap MAGPIE/SOL pool</li>
                    <li>• Meteora MAGPIE/SOL pool</li>
                    <li>• Future DEX pool token accounts</li>
                    <li>• Magpie protocol lender wallet</li>
                    <li>• System / burn address</li>
                  </ul>
                </div>
                <p className="mt-3 text-xs text-white/45">
                  Whale-cap: any single voter&apos;s weight is capped at 2% of the cast pool to keep one wallet from dominating an outcome.
                </p>
              </Disclosure>

              <Disclosure
                title="What's votable — Tier A"
                summary="Six explicit categories. The operator commits to implement a passing Tier A vote within 14 days."
              >
                <div className="mt-3 space-y-2.5">
                  {TIER_A.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="flex items-baseline gap-3">
                        <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                          {item.id}
                        </span>
                        <h4 className="text-sm font-medium text-white/85">{item.topic}</h4>
                      </div>
                      <p className="mt-1.5 text-xs text-white/55">{item.bounds}</p>
                    </div>
                  ))}
                </div>
              </Disclosure>

              <Disclosure
                title="Out of scope — Tier B"
                summary="Cannot be put to a vote in v0. Listed explicitly so the boundary is unambiguous."
              >
                <ul className="mt-3 space-y-2 text-sm text-white/65">
                  {TIER_B.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-white/30" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-white/45">
                  To move an item from Tier B to Tier A, see the escalation path in{" "}
                  <Link href="https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md#tier-c--escalation-path" className="text-cyan-300 underline hover:text-cyan-200">
                    GOVERNANCE.md
                  </Link>
                  .
                </p>
              </Disclosure>

              <Disclosure
                title="Proposal lifecycle"
                summary="Draft → Active → Closed → Executed. 3-day voting window, 14-day execution SLA."
              >
                <div className="mt-3 space-y-2.5">
                  {[
                    { n: "1", label: "Draft", sub: "in @magpietalk community", body: "Anyone can post a proposal idea. Include scope tier (A1–A6), exact change requested, rationale, and expected protocol impact." },
                    { n: "2", label: "Active", sub: "3-day voting window", body: "Operator pins the proposal here. Holders connect wallet and vote YES / NO / ABSTAIN. Voting is gasless — votes are wallet-signed off-chain messages. Re-vote any time; latest signature wins. Live aggregate updates every 2 seconds." },
                    { n: "3", label: "Closed", sub: "tally + threshold check", body: "Voter weights are determined by $MAGPIE balance at vote close — so current holders decide, not wallets that sold during the window. Quorum: at least 5% of eligible weight must vote YES + NO. Pass: ≥66.6% of (YES + NO) must be YES." },
                    { n: "4", label: "Executed", sub: "within 14 days of pass", body: "Operator implements. On-chain changes have a public transaction signature. Config changes have a commit referencing the proposal ID. Failure to execute within 14 days is a one-strike trust event." },
                  ].map((step) => (
                    <div key={step.n} className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="flex items-baseline gap-3">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px]">
                          {step.n}. {step.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-white/45">{step.sub}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/65">{step.body}</p>
                    </div>
                  ))}
                </div>
              </Disclosure>

              <Disclosure
                title="Roadmap"
                summary="v0 signal voting today → v1 on-chain bounds → v2 fully on-chain. No timeline commitments past v0."
              >
                <div className="mt-3 space-y-2.5">
                  {ROADMAP.map((r) => (
                    <div
                      key={r.phase}
                      className={
                        "rounded-lg border p-3.5 " +
                        (r.current ? "border-cyan-500/25 bg-cyan-500/[0.04]" : "border-white/10 bg-white/[0.03]")
                      }
                    >
                      <div className="flex items-baseline gap-3">
                        <span className={"rounded-md px-2 py-0.5 font-mono text-[10px] " + (r.current ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-white/65")}>
                          {r.phase}
                        </span>
                        <span className="text-sm font-medium text-white/85">{r.title}</span>
                        {r.current && (
                          <span className="text-[10px] uppercase tracking-wider text-cyan-300">current</span>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/65">{r.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/45">
                  The model evolves when the protocol&apos;s track record warrants it — not on a pre-committed schedule.
                </p>
              </Disclosure>
            </div>
          </section>
        </Reveal>

        {/* ── Resources ───────────────────────────────────────── */}
        <Reveal delay={0.3}>
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
              Resources
            </h2>
            <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
              <ResourceLink href="https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md" label="GOVERNANCE.md" sub="Canonical v0 spec" />
              <ResourceLink href="/api/v1/governance" label="/api/v1/governance" sub="Machine-readable model" external={false} />
              <ResourceLink href="https://t.me/magpietalk" label="@magpietalk" sub="Drafts and discussion" />
              <ResourceLink href="https://github.com/magpiecapital/magpie-site/issues" label="GitHub Issues" sub="Proposals for model changes" />
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}

// ─── Local UI atoms ────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={
        "rounded-xl border px-4 py-3 " +
        (accent ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.03]")
      }
    >
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium text-white/95 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
  );
}

function SectionHeading({
  label,
  count,
  hint,
  dotClass,
}: {
  label: string;
  count: number;
  hint: string;
  dotClass: string;
}) {
  return (
    <div className="mt-12 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className={"inline-block h-1.5 w-1.5 rounded-full " + dotClass} />
          {label}
          <span className="ml-1 font-mono text-xs text-white/40 tabular-nums">{count}</span>
        </h2>
        <p className="mt-1 text-xs text-white/45">{hint}</p>
      </div>
    </div>
  );
}

function Disclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.025] open:bg-white/[0.04]">
      <summary className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          <p className="mt-0.5 text-xs text-white/50">{summary}</p>
        </div>
        <span className="mt-0.5 shrink-0 text-white/40 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-white/5 px-4 pb-5 pt-3 sm:px-5">{children}</div>
    </details>
  );
}

function ResourceLink({
  href,
  label,
  sub,
  external = true,
}: {
  href: string;
  label: string;
  sub: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]"
    >
      <div>
        <p className="font-mono text-sm text-white/85 group-hover:text-cyan-100">{label}</p>
        <p className="text-xs text-white/45">{sub}</p>
      </div>
      <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-cyan-300">→</span>
    </Link>
  );
}
