/**
 * GET /api/v1/stats
 *
 * Real-time protocol statistics. Backed by the same Railway Postgres
 * the bot writes to, so numbers update as new loans are created.
 *
 * Headline figures only — for the full transparency dashboard payload
 * (pool state, holder rewards, etc.) use /api/v1/transparency.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
  "X-Powered-By": "Magpie Protocol",
};

export async function GET() {
  try {
    const [statsResult, tiersResult, usersResult] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::text AS total_loans,
           COUNT(*) FILTER (WHERE status = 'active')::text AS active_loans,
           COUNT(*) FILTER (WHERE status = 'repaid')::text AS repaid_loans,
           COUNT(*) FILTER (WHERE status = 'liquidated')::text AS liquidated_loans,
           COALESCE(SUM(loan_amount_lamports::numeric), 0)::text AS total_borrowed_lamports,
           AVG(ltv_percentage)::text AS avg_ltv,
           AVG(duration_days)::text AS avg_duration_days
         FROM loans`,
      ),
      query(
        `SELECT ltv_percentage, COUNT(*)::text AS n
         FROM loans
         GROUP BY ltv_percentage`,
      ),
      query(
        `SELECT COUNT(*)::text AS total_users FROM users`,
      ),
    ]);

    const s = statsResult.rows[0];
    const totalLoans = Number(s.total_loans);
    const repaid = Number(s.repaid_loans);
    const liquidated = Number(s.liquidated_loans);
    const finalized = repaid + liquidated;
    const liquidationRate = finalized > 0 ? liquidated / finalized : 0;

    // Tier distribution
    const tiers: Record<string, number> = { express: 0, quick: 0, standard: 0 };
    for (const t of tiersResult.rows) {
      const n = Number(t.n);
      if (t.ltv_percentage >= 30) tiers.express += n;
      else if (t.ltv_percentage >= 25) tiers.quick += n;
      else tiers.standard += n;
    }
    const tierSum = tiers.express + tiers.quick + tiers.standard;
    const tierDistribution = tierSum > 0
      ? {
          express: tiers.express / tierSum,
          quick: tiers.quick / tierSum,
          standard: tiers.standard / tierSum,
        }
      : { express: 0, quick: 0, standard: 0 };

    return NextResponse.json(
      {
        ok: true,
        data: {
          totalLoansOriginated: totalLoans,
          activeLoans: Number(s.active_loans),
          repaidLoans: repaid,
          liquidatedLoans: liquidated,
          totalSolLent: Number(s.total_borrowed_lamports) / 1e9,
          totalUsers: Number(usersResult.rows[0].total_users),
          liquidationRate,
          averageLtv: s.avg_ltv ? Number(s.avg_ltv) / 100 : 0,
          averageLoanDurationDays: s.avg_duration_days ? Number(s.avg_duration_days) : 0,
          tierDistribution,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/v1/stats] error:", err);
    // Empty-but-honest fallback. NEVER return fake numbers — that's
    // worse than no numbers.
    return NextResponse.json(
      {
        ok: false,
        error: "Stats temporarily unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: HEADERS },
    );
  }
}
