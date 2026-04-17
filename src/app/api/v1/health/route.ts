import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    status: "healthy",
    activeLoans: 142,
    healthDistribution: {
      healthy: 0.78,
      watch: 0.15,
      atRisk: 0.07,
    },
    averageHealth: 0.82,
    liquidationsLast24h: 3,
    alertsLast24h: 12,
    oracleStatus: "operational",
    borrowingEnabled: true,
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
