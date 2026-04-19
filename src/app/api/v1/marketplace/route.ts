/**
 * GET /api/v1/marketplace
 *
 * P2P Lending Marketplace stats and pool listings.
 */
import { NextResponse } from "next/server";

export async function GET() {
  // Marketplace overview — zeroed until the lending protocol is live.
  // In production, this proxies to the bot's marketplace service.
  const data = {
    overview: {
      total_pools: 0,
      total_tvl_sol: 0,
      total_loans_matched: 0,
      avg_apy_pct: 0,
    },
    tranches: {
      senior: {
        description: "Lower yield, protected from first losses",
        typical_apy: "5-15%",
        risk_level: "Low",
        tvl_sol: 0,
        pools: 0,
      },
      mezzanine: {
        description: "Moderate risk and reward",
        typical_apy: "10-30%",
        risk_level: "Medium",
        tvl_sol: 0,
        pools: 0,
      },
      junior: {
        description: "Higher yield, absorbs losses first",
        typical_apy: "20-50%",
        risk_level: "High",
        tvl_sol: 0,
        pools: 0,
      },
    },
    how_it_works: {
      lenders: [
        "Create a lending pool and choose your risk tranche",
        "Deposit SOL — your funds are matched with qualified borrowers",
        "Earn yield from origination fees and interest",
        "Senior tranche protected from first losses; junior absorbs first",
      ],
      borrowers: [
        "Your credit score determines available rates and terms",
        "AI risk engine dynamically prices your loan based on collateral risk",
        "Matched with the best available pool automatically",
        "Better credit score = lower rates + higher LTV + longer terms",
      ],
    },
  };

  return NextResponse.json(
    { ok: true, data, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" } },
  );
}
