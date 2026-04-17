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
        "GET /api/v1/health": "Protocol health overview",
        "GET /api/v1/calculate?mint=...&amount=...&tier=...": "Loan calculator",
      },
      docs: "https://magpie.capital/docs",
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
