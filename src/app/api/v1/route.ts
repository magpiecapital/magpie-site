import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      name: "Magpie Protocol API",
      version: "1.0.0",
      description:
        "Public read-only API for the Magpie lending protocol on Solana",
      endpoints: {
        "GET /api/v1/stats": "Protocol-level statistics",
        "GET /api/v1/tokens": "Supported tokens with live pricing",
        "GET /api/v1/tokens/<mint>": "Per-token scorecard (tier, cap, risk metrics, lifetime activity)",
        "GET /api/v1/health": "Protocol health overview",
        "GET /api/v1/calculate?mint=...&amount=...&tier=...": "Loan calculator",
        "GET /api/v1/supply/circulating": "$MAGPIE circulating supply (plain text)",
        "GET /api/v1/supply/total": "$MAGPIE total supply (plain text)",
        "GET /api/v1/supply": "$MAGPIE supply breakdown (JSON)",
        "GET /api/v1/info": "Project metadata for listing aggregators",
        "GET /api/v1/markets": "$MAGPIE DEX trading pairs",
        "GET /api/v1/activity/public": "Recent anonymized protocol activity",
      },
      docs: "https://www.magpie.capital/docs",
      github: "https://github.com/magpiecapital",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Powered-By": "Magpie Protocol",
      },
    },
  );
}
