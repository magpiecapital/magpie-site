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

export const revalidate = 3600;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";

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
          { id: "A4", topic: "Adjust holder distribution share", bounds: "Within 5%–15% (currently 10%); future loans only" },
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
      active_proposals: [
        {
          id: "MGP-001",
          title: "Restructure the loan-fee split — 60% to $MAGPIE holders, 30% to SOL LPs",
          scope_tier: "A4 — binding by operator commitment (one-time Tier B → de-facto Tier A exception, same path as MGP-003)",
          status: "active",
          voting_window: "2026-06-09 to 2026-06-12",
          summary: "Shift 50 percentage points from the SOL LP share (80% → 30%) to the $MAGPIE holder share (10% → 60%). Other splits (referrer 5%, LP loyalty 2%, protocol 3%) unchanged. Forward-only — does not affect distributions already accrued. Rescoped from the earlier 10→15% incremental step to put the full target end state on the ballot directly. Outside Tier A4 5%–15% bound; filed as a one-time operator-committed exception per the path documented in MGP-003.",
          vote_url: `${base}/governance/proposal/MGP-001`,
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-holder-distribution-share-15pct.md",
        },
      ],
      drafts: [
        {
          id: "MGP-003",
          title: "Allocation decision for the July 1, 2026 $MAGPIE Streamflow unlock (~5% of supply)",
          scope_tier: "A6 (binding by operator commitment — one-time Tier B → de-facto Tier A exception)",
          status: "draft",
          summary:
            "Five options for the ~50M $MAGPIE balance unlocking on July 1, 2026 (Streamflow contract GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc): burn / re-lock 12 months / pro-rata distribution to holders (30-day stream) / utility-weighted distribution to protocol users (30-day stream) / hybrid (50% burn + 25% holders + 25% users). Plurality wins above 40%; 7.5% quorum; ABSTAIN ≥ 30% triggers operator discretion fallback. Target voting window 2026-06-12 to 2026-06-15.",
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-003-streamflow-unlock-allocation.md",
          streamflow_contract:
            "GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc",
          unlock_date: "2026-07-01",
        },
      ],
      past_proposals: [
        {
          id: "MGP-002",
          title: "Signal poll — should Magpie add a Premium tier (30-day, 40% LTV, 5% fee, tokenized stocks only)?",
          scope_tier: "A6",
          status: "withdrawn",
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
