import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    totalLoansOriginated: 847,
    totalSolLent: 12450.0,
    totalValueLockedUsd: 3200000,
    activeLoans: 142,
    averageHealthRatio: 0.82,
    averageLtv: 0.263,
    liquidationRate: 0.032,
    averageLoanDurationDays: 3.8,
    tierDistribution: {
      express: 0.45,
      quick: 0.35,
      standard: 0.2,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(
    { ok: true, data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Powered-By": "Magpie Protocol",
      },
    },
  );
}
