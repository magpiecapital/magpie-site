/**
 * GET /api/v1/governance
 *
 * Machine-readable Magpie governance model. Returns the same data
 * shown at /governance, in a shape that agents, aggregators, and
 * integrators can consume without scraping the React page.
 *
 * Source of truth for the model is GOVERNANCE.md in this repo. This
 * endpoint mirrors that doc. If the two ever drift, fix the doc and
 * then re-mirror — the doc is the spec.
 *
 * Public, cached.
 */
import { NextResponse } from "next/server";
import { resolveProposalStatus, type ResolvedKind } from "@/lib/governance";

// Date-driven status (src/lib/governance.ts) needs a short revalidate so the
// machine-readable mirror flips a proposal active/closed on its scheduled date.
export const revalidate = 60;

// Map the canonical resolved kind to the string this public API has always used.
function apiStatus(kind: ResolvedKind): string {
  switch (kind) {
    case "active": return "active";
    case "upcoming": return "draft";
    case "tallying": return "voting_closed";
    case "passed": return "passed";
    case "failed": return "failed";
    case "withdrawn": return "withdrawn";
  }
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";

  // Resolve MGP-003 from the single source of truth and place it in the right
  // bucket — never hand-label it. (MGP-001/002 are terminal: always past.)
  const mgp003Kind = resolveProposalStatus("MGP-003")?.kind ?? "upcoming";
  const mgp003 = {
    id: "MGP-003",
    title: "Allocation decision for the July 1, 2026 $MAGPIE Streamflow unlock (~5% of supply)",
    scope_tier: "A6 — binding by operator commitment (one-time Tier B → de-facto Tier A exception)",
    status: apiStatus(mgp003Kind),
    voting_window: "2026-06-24 to 2026-06-29 (5 days, 8:00 PM ET → 8:00 PM ET)",
    voting_opens_at_iso: "2026-06-25T00:00:00Z",
    voting_closes_at_iso: "2026-06-30T00:00:00Z",
    summary:
      "Four options for the ~50M $MAGPIE balance unlocking on July 1, 2026 (Streamflow contract GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc). A = Patience (re-lock 100% for 36 more months). B = Loyalty (24-month linear vest to current $MAGPIE holders, snapshot at proposal close). C = Build (100% to a multi-sig Magpie Treasury, locked 24 months minimum, programmatic spend categories with on-chain logging on /distributions). D = Discipline + Build (50% burn + 50% to the same locked treasury). No option releases tokens at once. Plurality wins above 40%; 7.5% quorum; ABSTAIN ≥ 30% triggers operator discretion fallback.",
    vote_url: `${base}/governance/proposal/MGP-003`,
    spec_url:
      "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
    streamflow_contract: "GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc",
    unlock_date: "2026-07-01",
  };
  const activeProposals = mgp003Kind === "active" ? [mgp003] : [];
  const draftProposals = mgp003Kind === "upcoming" ? [mgp003] : [];
  const mgp003Past =
    mgp003Kind === "tallying" || mgp003Kind === "passed" || mgp003Kind === "failed" ? [mgp003] : [];

  return NextResponse.json(
    {
      ok: true,
      version: "v0",
      type: "off-chain-signal-voting",
      operator_commitment: "honors_passing_votes_within_scope",
      spec_url: "https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md",
      public_page: `${base}/governance`,
      voting_power: {
        rule: "1_token_1_vote",
        eligibility: "wallet_balance_at_proposal_activation",
        excluded_addresses: [
          { kind: "bonding_curve", label: "pump.fun bonding curve" },
          { kind: "dex_pool", label: "PumpSwap MAGPIE/SOL pool" },
          { kind: "dex_pool", label: "Meteora MAGPIE/SOL pool" },
          { kind: "dex_pool", label: "Future DEX pool token accounts" },
          { kind: "operator", label: "Magpie protocol lender / operator wallet" },
          { kind: "system", label: "System / burn address" },
        ],
      },
      scope: {
        tier_a: [
          { id: "A1", topic: "Add or remove a collateral token", bounds: "Must clear screener risk thresholds; one token per proposal" },
          { id: "A2", topic: "Adjust tier LTV cap", bounds: "Within ±5 percentage points; per tier" },
          { id: "A3", topic: "Adjust tier fee rate", bounds: "Within ±0.5 percentage points; per tier" },
          { id: "A4", topic: "Adjust holder distribution share", bounds: "Within 5%–15% per tier-A vote (currently 70% via the one-time MGP-001 exception ratified 2026-06-13); future loans only" },
          { id: "A5", topic: "Adjust holder distribution cadence", bounds: "Within 3–14 days (currently randomized 5–10)" },
          { id: "A6", topic: "Non-binding signal poll on feature priorities", bounds: "Advisory only" },
        ],
        tier_b_excluded: [
          "Retroactive changes to active loans",
          "On-chain safety configuration",
          "Founder identity / operational security disclosure",
          "Treasury / lender-wallet allocation",
          "Token supply changes",
          "Pricing or scope of the x402 paid agent API",
        ],
        tier_c_escalation: {
          description: "Migrate a Tier B item to Tier A",
          pass_threshold: 0.80,
          quorum: 0.15,
          cooling_off_days: 30,
        },
      },
      proposal_lifecycle: {
        steps: ["draft", "active", "closed", "executed"],
        terminal_states: ["executed", "failed", "withdrawn", "rejected"],
        draft_review_window_days: 7,
        active_voting_window_days: 3,
        quorum_pct: 0.05,
        pass_threshold_pct: 0.60,
        execution_window_days: 14,
      },
      voting_mechanics: {
        gasless: true,
        signature_scheme: "wallet_signed_off_chain_message",
        verification: "operator_publishes_aggregate_tally_at_close",
      },
      roadmap: {
        v0: { status: "current", description: "Off-chain signal voting; operator-honored" },
        v1: { status: "planned", description: "On-chain parameter-bounds contract" },
        v2: { status: "planned", description: "Full on-chain governance (SPL governance or equivalent)" },
      },
      active_proposals: activeProposals,
      drafts: draftProposals,
      past_proposals: [
        ...mgp003Past,
        {
          id: "MGP-001",
          title: "Restructure the loan-fee split — 70/10/10/10",
          scope_tier: "A4 — binding by operator commitment (one-time Tier B → de-facto Tier A exception, same path as MGP-003)",
          status: apiStatus(resolveProposalStatus("MGP-001")?.kind ?? "passed"),
          voting_window: "2026-06-10 22:00 UTC to 2026-06-13 22:00 UTC",
          voting_opens_at_iso: "2026-06-10T22:00:00Z",
          voting_closes_at_iso: "2026-06-13T22:00:00Z",
          summary: "Send 70% of every loan fee to $MAGPIE holders, 10% to SOL LPs, 10% to referrers, and 10% to the protocol reserve. Replaced the prior 80/10/5/2/3 split with a holder-first model. Forward-only — distributions already accrued under the old split were not retroactively re-cut. Outside the Tier A4 5%–15% bound; filed as a one-time operator-committed exception per the path documented in MGP-003.",
          new_split: {
            holder_bps: 7000,
            lp_bps: 1000,
            referrer_bps: 1000,
            protocol_reserve_bps: 1000,
          },
          // Final tally at voting close (2026-06-13 22:00 UTC). Quorum
          // and threshold both cleared; operator-honored execution per
          // GOVERNANCE.md v0 commitment.
          final_tally: {
            voters_cast: 37,
            eligible_voters: 2185,
            participation_pct: 8.72,
            quorum_pct: 5,
            quorum_met: true,
            yes_share_of_cast_pct: 98,
            threshold_pct: 66.6,
            threshold_met: true,
            yes_weight: "64880876460291",
            no_weight: "1324099519597",
            abstain_weight: "0",
            cast_weight: "66204975979888",
          },
          execution_status: "in_effect",
          executed_at_iso: "2026-06-13T22:00:00Z",
          vote_url: `${base}/governance/proposal/MGP-001`,
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-fee-split-70-10-10-10.md",
        },
        {
          id: "MGP-002",
          title: "Signal poll — should Magpie add a Premium tier (30-day, 40% LTV, 5% fee, tokenized stocks only)?",
          scope_tier: "A6",
          status: apiStatus(resolveProposalStatus("MGP-002")?.kind ?? "withdrawn"),
          voting_window: "2026-06-09 (withdrawn same day)",
          summary: "Withdrawn 2026-06-09. Operator decided to ship the Premium tier (both 15-day and 30-day options) under Tier B operator discretion rather than running the signal poll to conclusion. Tier B is the legitimate path per GOVERNANCE.md v0 — loan-duration adjustments and new-tier additions are operator-discretion in v0. Execution plan documented in magpie-bot/docs/PREMIUM-TIER-DEPLOY-PLAN-2026-06-09.md.",
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
        },
      ],
      links: {
        community: "https://t.me/magpietalk",
        github_repo: "https://github.com/magpiecapital/magpie-site",
        spec: "https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md",
        public_page: `${base}/governance`,
      },
      generated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
