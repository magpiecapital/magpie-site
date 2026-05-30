/**
 * GET /api/v1/health — Protocol health overview.
 *
 * Returns real numbers pulled from the bot DB + bot liveness endpoint.
 * Public, cached briefly. Previously returned hardcoded demo values
 * (activeLoans: 142, etc.) — replaced with live data.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const BOT_API_URL = process.env.BOT_API_URL ?? "";

export async function GET() {
  const [counts, liquid24h, alerts24h, botHealth] = await Promise.all([
    query(`SELECT status, COUNT(*)::int AS n FROM loans GROUP BY status`).catch(() => ({ rows: [] })),
    query(`SELECT COUNT(*)::int AS n FROM loans WHERE status = 'liquidated' AND updated_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ n: 0 }] })),
    query(`SELECT COUNT(*)::int AS n FROM loans WHERE last_health_alert IS NOT NULL AND updated_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ n: 0 }] })),
    BOT_API_URL
      ? fetch(`${BOT_API_URL}/api/v1/health`, { signal: AbortSignal.timeout(5_000) })
          .then((r) => r.json())
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of (counts.rows ?? []) as Array<{ status: string; n: number }>) {
    byStatus[r.status] = r.n;
  }

  const data = {
    status: botHealth?.status ?? "unknown",
    activeLoans: byStatus.active ?? 0,
    repaidLoans: byStatus.repaid ?? 0,
    liquidatedLoans: byStatus.liquidated ?? 0,
    liquidationsLast24h: liquid24h.rows?.[0]?.n ?? 0,
    alertsLast24h: alerts24h.rows?.[0]?.n ?? 0,
    botServices: botHealth?.checks ?? null,
    borrowingEnabled: !botHealth || botHealth.checks?.db !== "fail",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(
    { ok: true, data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-Powered-By": "Magpie Protocol",
      },
    },
  );
}
