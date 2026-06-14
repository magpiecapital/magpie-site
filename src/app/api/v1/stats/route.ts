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
    const [
      statsResult,
      tiersResult,
      usersResult,
      // 2026-06-13: Limit-close engine reliability surface. /stats is
      // the most-shared external URL, so the limit-close engine's
      // uptime + fire activity belongs here — readers evaluating
      // Magpie's autonomous take-profit / stop-loss can see the engine
      // is real and reliable without having to ask. Reads from the
      // same engine_metrics_hourly + engine_heartbeats tables that
      // /lc-perf shows operator-internally.
      engineHeartbeatResult,
      engineMetricsResult,
    ] = await Promise.all([
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
      query(
        `SELECT last_tick_at, last_tick_status, armed_count, service
           FROM engine_heartbeats
          WHERE service = 'limit_close_watcher'
          LIMIT 1`,
      ),
      query(
        `SELECT
           COALESCE(SUM(fires_attempted), 0)::int  AS fires_attempted_24h,
           COALESCE(SUM(fires_succeeded), 0)::int  AS fires_succeeded_24h,
           COALESCE(SUM(fires_failed),    0)::int  AS fires_failed_24h,
           COALESCE(SUM(fires_reverted),  0)::int  AS fires_reverted_24h,
           COALESCE(SUM(ticks),           0)::int  AS ticks_24h,
           COALESCE(SUM(jupiter_probes_ok),     0)::int AS jup_ok_24h,
           COALESCE(SUM(jupiter_probes_failed), 0)::int AS jup_failed_24h
         FROM engine_metrics_hourly
         WHERE service = 'limit_close_watcher'
           AND hour > NOW() - INTERVAL '24 hours'`,
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

    // ── Engine reliability roll-up ─────────────────────────────
    // Heartbeat: how long ago did the engine tick? Engine writes to
    // engine_heartbeats every poll cycle; > 5 min stale means the
    // watchdog is likely already firing. Surface "alive / degraded /
    // offline" so the public can see at-a-glance.
    const hb = engineHeartbeatResult.rows[0];
    const heartbeatAgeSec = hb?.last_tick_at
      ? Math.max(0, Math.floor((Date.now() - new Date(hb.last_tick_at).getTime()) / 1000))
      : null;
    const engineStatus = !hb
      ? "unknown"
      : heartbeatAgeSec! < 90
        ? "alive"
        : heartbeatAgeSec! < 300
          ? "degraded"
          : "offline";

    const m = engineMetricsResult.rows[0];
    const firesAttempted24h = Number(m.fires_attempted_24h);
    const firesSucceeded24h = Number(m.fires_succeeded_24h);
    const firesFailed24h    = Number(m.fires_failed_24h);
    const firesReverted24h  = Number(m.fires_reverted_24h);
    // Success rate excludes reverted because revert == "trigger no
    // longer hit, no-op exit" — not a failure to fire. The denominator
    // is attempts that actually had to commit (succeeded + failed).
    const committedFires = firesSucceeded24h + firesFailed24h;
    const fireSuccessRate24h = committedFires > 0 ? firesSucceeded24h / committedFires : null;

    const jupOk24h     = Number(m.jup_ok_24h);
    const jupFailed24h = Number(m.jup_failed_24h);
    const jupProbeTotal = jupOk24h + jupFailed24h;
    const jupiterHealth24h = jupProbeTotal > 0 ? jupOk24h / jupProbeTotal : null;

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
          limitCloseEngine: {
            status: engineStatus,
            heartbeatAgeSec,
            armedOrdersNow: hb?.armed_count != null ? Number(hb.armed_count) : null,
            firesAttempted24h,
            firesSucceeded24h,
            firesFailed24h,
            firesReverted24h,
            fireSuccessRate24h,
            jupiterHealth24h,
          },
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
