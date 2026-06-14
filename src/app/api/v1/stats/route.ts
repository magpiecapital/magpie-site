/**
 * GET /api/v1/stats
 *
 * Real-time protocol statistics. Backed by the same Postgres
 * the bot writes to, so numbers update as new loans are created.
 *
 * 2026-06-14: total loans + liquidations now come from the ON-CHAIN
 * pool counters (via the bot's public /api/v1/pool/stats) when
 * available. Reason: the DB had drifted (43 on-chain vs 11 DB
 * liquidations) and the public /stats page was understating the real
 * liquidation rate. On-chain is authoritative — that's what users
 * can verify themselves on Solscan. The DB numbers stay as fallback
 * for active/repaid splits and for the engine reliability data which
 * is DB-only.
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

const BOT_POOL_STATS_URL =
  process.env.BOT_POOL_STATS_URL ||
  "https://magpie-bot-production.up.railway.app/api/v1/pool/stats";
const POOL_STATS_TIMEOUT_MS = 4_000;

interface OnChainPoolNumbers {
  totalLoansIssued: number | null;
  totalLiquidations: number | null;
}

async function fetchOnChainNumbers(): Promise<OnChainPoolNumbers> {
  try {
    const res = await fetch(BOT_POOL_STATS_URL, {
      signal: AbortSignal.timeout(POOL_STATS_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { totalLoansIssued: null, totalLiquidations: null };
    const body = await res.json();
    const pool = body?.pool;
    if (!pool) return { totalLoansIssued: null, totalLiquidations: null };
    const tli = pool.total_loans_issued;
    const tlq = pool.total_liquidations;
    return {
      totalLoansIssued: tli != null ? Number(tli) : null,
      totalLiquidations: tlq != null ? Number(tlq) : null,
    };
  } catch {
    return { totalLoansIssued: null, totalLiquidations: null };
  }
}

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
    // On-chain counters are authoritative — fetch in parallel with the
    // earlier DB queries above by doing it here right after they
    // resolve. Adds one HTTP round-trip; cached via the route's
    // s-maxage=30 so impact is bounded.
    const onChain = await fetchOnChainNumbers();
    // Prefer on-chain values when they're present and >= DB count
    // (sanity guard against transient empty responses). Otherwise fall
    // back to DB. Never quote a smaller number than the DB has — that
    // would understate liquidation rate.
    const dbTotalLoans = Number(s.total_loans);
    const dbLiquidated = Number(s.liquidated_loans);
    const totalLoans =
      onChain.totalLoansIssued != null && onChain.totalLoansIssued >= dbTotalLoans
        ? onChain.totalLoansIssued
        : dbTotalLoans;
    const liquidated =
      onChain.totalLiquidations != null && onChain.totalLiquidations >= dbLiquidated
        ? onChain.totalLiquidations
        : dbLiquidated;
    const repaid = Number(s.repaid_loans);
    // Liquidation rate = liquidated / totalLoans (lifetime). Was previously
    // liquidated / (repaid + liquidated) which under-counts because
    // pending/active loans should be in the denominator (every loan IS at
    // risk of liquidation, not just finalized ones). Using totalLoans
    // matches the on-chain pool's accounting.
    const liquidationRate = totalLoans > 0 ? liquidated / totalLoans : 0;

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
          // Provenance: lets API consumers and Pip surface the right
          // caveat ("verifiable on-chain") when the numbers come from
          // the pool counter rather than the indexer DB.
          countsSource: onChain.totalLoansIssued != null ? "on-chain" : "db-indexer",
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
