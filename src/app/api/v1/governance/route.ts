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
        active_voting_window_days: 7,
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
      active_proposals: [],
      drafts: [
        {
          id: "MGP-001",
          title: "Increase $MAGPIE holder fee share from 10% to 15%",
          scope_tier: "A4",
          status: "draft",
          summary: "Shift 5 percentage points from the SOL LP share (80% → 75%) to the $MAGPIE holder share (10% → 15%). Other splits (referrer 5%, LP loyalty 2%, protocol 3%) unchanged. Forward-only.",
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-001-holder-distribution-share-15pct.md",
        },
        {
          id: "MGP-002",
          title: "Signal poll — should Magpie add an Extended-duration loan tier (≥14 days)?",
          scope_tier: "A6",
          status: "draft",
          summary: "Non-binding poll across four sub-questions (add tier? lower LTV? higher fee? move duration into Tier A?). Results inform whether to file a Tier C escalation next.",
          spec_url:
            "https://github.com/magpiecapital/magpie-site/blob/main/proposals/MGP-002-extended-duration-tier-signal-poll.md",
        },
      ],
      past_proposals: [],
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
