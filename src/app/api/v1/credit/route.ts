/**
 * GET /api/v1/credit?wallet=<address>
 *
 * Composable Credit Score API — query any Magpie user's credit score
 * by their Solana wallet address. Designed for external protocol integrations.
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.MAGPIE_BOT_API_URL || "http://localhost:3001";

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
            bronze: "300-499 → 30% max LTV, 1.5% fee",
            silver: "500-649 → 32% max LTV, 1.5% fee",
            gold: "650-749 → 35% max LTV, 1.25% fee",
            platinum: "750-850 → 38% max LTV, 1.0% fee",
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

  // For now, return the credit score schema with mock data.
  // In production, this proxies to the bot's credit protocol API.
  const mockScore = generateMockScore(wallet);

  return NextResponse.json(
    {
      ok: true,
      data: mockScore,
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

function generateMockScore(wallet: string) {
  // Deterministic mock based on wallet address for consistent demo
  const hash = wallet.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const score = 300 + (hash % 550);
  const tier =
    score >= 750 ? "platinum" : score >= 650 ? "gold" : score >= 500 ? "silver" : "bronze";

  const tierBenefits: Record<string, { maxLtv: number; feeRate: number; maxDays: number }> = {
    bronze: { maxLtv: 30, feeRate: 0.015, maxDays: 7 },
    silver: { maxLtv: 32, feeRate: 0.015, maxDays: 7 },
    gold: { maxLtv: 35, feeRate: 0.0125, maxDays: 14 },
    platinum: { maxLtv: 38, feeRate: 0.01, maxDays: 30 },
  };

  return {
    wallet,
    score,
    tier,
    factors: {
      repayment_history: Math.min(100, 20 + (hash % 80)),
      loan_volume: Math.min(100, 10 + ((hash * 3) % 70)),
      account_age: Math.min(100, 5 + ((hash * 7) % 60)),
      collateral_diversity: Math.min(100, 15 + ((hash * 11) % 55)),
      liquidation_ratio: Math.min(100, 40 + ((hash * 13) % 60)),
      protocol_engagement: Math.min(100, 10 + ((hash * 17) % 50)),
    },
    tier_benefits: tierBenefits[tier],
    loans_scored: (hash % 30) + 1,
  };
}
