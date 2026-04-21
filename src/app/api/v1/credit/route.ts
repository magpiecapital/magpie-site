/**
 * GET /api/v1/credit?wallet=<address>
 *
 * Composable Credit Score API — query any Magpie user's credit score
 * by their Solana wallet address. Designed for external protocol integrations.
 */
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing ?wallet=<solana_address> parameter",
        docs: {
          description: "Magpie Composable Credit Score API",
          endpoints: {
            "GET /api/v1/credit?wallet=<address>": "Query credit score by wallet",
            "GET /api/v1/credit/leaderboard": "Top credit scores",
          },
          score_range: "300 (min) – 850 (max)",
          tiers: {
            bronze: "300-499 → 30% max LTV, 1.5–3% fee (tier-dependent)",
            silver: "500-649 → 32% max LTV, 1.5–3% fee (tier-dependent)",
            gold: "650-749 → 35% max LTV, 1.25–2.75% fee",
            platinum: "750-850 → 38% max LTV, 1.0–2.5% fee",
          },
          factors: [
            "repayment_history (35%)",
            "loan_volume (20%)",
            "account_age (15%)",
            "collateral_diversity (15%)",
            "liquidation_ratio (10%)",
            "protocol_engagement (5%)",
          ],
        },
      },
      { status: 400 },
    );
  }

  // No loan history exists yet — return empty score response.
  // Once the lending protocol is live, this will proxy to the bot's credit engine.
  return NextResponse.json(
    {
      ok: true,
      data: {
        wallet,
        score: null,
        tier: null,
        factors: null,
        tier_benefits: null,
        loans_scored: 0,
        message: "No credit history found. Your score will be generated after your first loan.",
      },
      protocol: "magpie-credit-v1",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=15",
      },
    },
  );
}
