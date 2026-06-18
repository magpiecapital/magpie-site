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
      // 2026-06-14: defaulted-loan profit summary. Non-$MAGPIE
      // collateral defaults: net profit (proceeds − principal) routes
      // 70/10/10/10 to holders / LP loyalty / referrer / protocol
      // reserve. $MAGPIE defaults: seized tokens burned (operator-
      // manual). Best-effort read — wrapped catch falls back to zeros
      // on a fresh deploy that hasn't applied migration 059.
      defaultProfitResult,
      // 2026-06-14: $MAGPIE burn ledger. Sums every burn path (default-
      // driven, manual operator burns, future buybacks). Single source of
      // truth shared with the TG /stats command and Pip.
      magpieBurnsResult,
      // 2026-06-14: auto-sell (limit-close) fee rollup. Each successful
      // fire collects a 1% protocol fee on proceeds; that fee accrues
      // through the same 70/10/10/10 split as borrow origination via
      // limit-close-fee-accrual-watcher. Surfacing the rollup here closes
      // the operator-flagged transparency gap.
      limitCloseFeeResult,
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
      // 2026-06-18: UNION the recovery_credits table so out-of-band
      // protocol contributions (e.g. the operator-funded exploit recovery
      // after the cosign-borrow drain) count alongside profitable
      // defaults from liquidation_economics. Both flow through the same
      // 80/10/10 (holder / LP-loyalty / protocol-reserve) split via the
      // distribution-watcher, so they're economically equivalent from a
      // user's perspective. recovery_credits table may not exist on a
      // fresh deploy before migration 078 — guarded with COALESCE +
      // table-existence check in the outer query for safety.
      query(
        `WITH all_profit_events AS (
           SELECT net_profit_lamports, distribution_status, sale_detected_at,
                  collateral_mint
             FROM liquidation_economics
           UNION ALL
           SELECT amount_lamports AS net_profit_lamports,
                  distribution_status,
                  created_at AS sale_detected_at,
                  NULL AS collateral_mint
             FROM recovery_credits
             WHERE distribution_status IN ('awaiting_distribution', 'distributing', 'distributed')
         )
         SELECT
           COALESCE(SUM(net_profit_lamports) FILTER (
             WHERE net_profit_lamports > 0 AND distribution_status != 'loss'
           ), 0)::text AS profit_lifetime_lamports,
           COALESCE(SUM(net_profit_lamports) FILTER (
             WHERE net_profit_lamports > 0
               AND distribution_status != 'loss'
               AND sale_detected_at > NOW() - INTERVAL '24 hours'
           ), 0)::text AS profit_24h_lamports,
           COUNT(*) FILTER (
             WHERE net_profit_lamports > 0 AND distribution_status != 'loss'
           )::int AS profitable_count,
           COUNT(*) FILTER (WHERE distribution_status = 'pending_sale')::int AS pending_sale_count,
           COUNT(*) FILTER (WHERE distribution_status = 'awaiting_distribution')::int AS awaiting_dist_count,
           COUNT(*) FILTER (WHERE distribution_status = 'magpie_burned')::int AS magpie_burned_count,
           COUNT(*) FILTER (WHERE distribution_status = 'magpie_burn_pending')::int AS magpie_pending_count
         FROM all_profit_events`,
      ).catch(async () => {
        // Fallback when recovery_credits doesn't exist yet (migration 078
        // hasn't applied). Read liquidation_economics alone.
        try {
          return await query(
            `SELECT
               COALESCE(SUM(net_profit_lamports) FILTER (
                 WHERE net_profit_lamports > 0 AND distribution_status != 'loss'
               ), 0)::text AS profit_lifetime_lamports,
               COALESCE(SUM(net_profit_lamports) FILTER (
                 WHERE net_profit_lamports > 0
                   AND distribution_status != 'loss'
                   AND sale_detected_at > NOW() - INTERVAL '24 hours'
               ), 0)::text AS profit_24h_lamports,
               COUNT(*) FILTER (
                 WHERE net_profit_lamports > 0 AND distribution_status != 'loss'
               )::int AS profitable_count,
               COUNT(*) FILTER (WHERE distribution_status = 'pending_sale')::int AS pending_sale_count,
               COUNT(*) FILTER (WHERE distribution_status = 'awaiting_distribution')::int AS awaiting_dist_count,
               COUNT(*) FILTER (WHERE distribution_status = 'magpie_burned')::int AS magpie_burned_count,
               COUNT(*) FILTER (WHERE distribution_status = 'magpie_burn_pending')::int AS magpie_pending_count
             FROM liquidation_economics`,
          );
        } catch {
          return {
            rows: [{
              profit_lifetime_lamports: null,
              profit_24h_lamports: null,
              profitable_count: null,
              pending_sale_count: null,
              awaiting_dist_count: null,
              magpie_burned_count: null,
              magpie_pending_count: null,
            }],
          };
        }
      }),
      query(
        `SELECT
           COALESCE(SUM(amount_raw), 0)::text                                            AS total_raw,
           COUNT(*)::int                                                                  AS burn_count,
           COALESCE(SUM(amount_raw) FILTER (WHERE source = 'manual'), 0)::text             AS manual_raw,
           COALESCE(SUM(amount_raw) FILTER (WHERE source = 'liquidation_default'), 0)::text AS liquidation_default_raw,
           COALESCE(SUM(amount_raw) FILTER (WHERE source = 'buyback'), 0)::text            AS buyback_raw
         FROM magpie_burns`,
      ).catch(() => ({
        rows: [{
          total_raw: null,
          burn_count: null,
          manual_raw: null,
          liquidation_default_raw: null,
          buyback_raw: null,
        }],
      })),
      query(
        `SELECT
           COALESCE(SUM(protocol_fee_lamports::numeric)
             FILTER (WHERE status = 'fired'), 0)::text AS fees_lifetime_lamports,
           COALESCE(SUM(protocol_fee_lamports::numeric)
             FILTER (WHERE status = 'fired' AND fired_at > NOW() - INTERVAL '24 hours'), 0)::text AS fees_24h_lamports,
           COUNT(*) FILTER (WHERE status = 'fired')::int AS fires_lifetime_count,
           COUNT(*) FILTER (WHERE status = 'fired' AND fired_at > NOW() - INTERVAL '24 hours')::int AS fires_24h_count
         FROM limit_close_orders`,
      ).catch(() => ({
        rows: [{
          fees_lifetime_lamports: null,
          fees_24h_lamports: null,
          fires_lifetime_count: null,
          fires_24h_count: null,
        }],
      })),
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
            // Lifetime + 24h fire counts and the protocol-fee revenue
            // they generated. Each successful fire collects a 1% fee on
            // the gross proceeds; the same accrual pipeline as borrow
            // origination splits that into holders (70%) / LP loyalty
            // (10%) / referrer (10%) / protocol reserve (10%). Surfacing
            // these counters here closes the transparency gap where
            // auto-sell revenue contribution to snapshot rewards was
            // invisible to the public.
            firesLifetime: (() => {
              const lc = limitCloseFeeResult.rows[0];
              return lc?.fires_lifetime_count != null
                ? Number(lc.fires_lifetime_count)
                : 0;
            })(),
            feesLifetimeSol: (() => {
              const lc = limitCloseFeeResult.rows[0];
              return lc?.fees_lifetime_lamports != null
                ? Number(lc.fees_lifetime_lamports) / 1e9
                : 0;
            })(),
            fees24hSol: (() => {
              const lc = limitCloseFeeResult.rows[0];
              return lc?.fees_24h_lamports != null
                ? Number(lc.fees_24h_lamports) / 1e9
                : 0;
            })(),
          },
          // Defaulted-loan profit summary (2026-06-14 policy). When a
          // non-$MAGPIE collateralized loan defaults, the net profit
          // (sale proceeds − principal disbursed) is routed 70/10/10/10
          // to holders / LP loyalty / referrer / protocol reserve. When
          // $MAGPIE is the collateral, the seized tokens are burned
          // (operator-manual). All values in SOL.
          defaultedLoanProfit: (() => {
            const dp = defaultProfitResult.rows[0];
            if (!dp || dp.profit_lifetime_lamports == null) return null;
            const lamportsToSol = (n: string | number | null) =>
              n == null ? 0 : Number(n) / 1e9;
            return {
              lifetimeSol: lamportsToSol(dp.profit_lifetime_lamports),
              last24hSol: lamportsToSol(dp.profit_24h_lamports),
              profitableDefaultsCount: Number(dp.profitable_count ?? 0),
              awaitingSaleCount: Number(dp.pending_sale_count ?? 0),
              awaitingDistributionCount: Number(dp.awaiting_dist_count ?? 0),
              magpieBurnedCount: Number(dp.magpie_burned_count ?? 0),
              magpieBurnPendingCount: Number(dp.magpie_pending_count ?? 0),
              policy: {
                holderBps: 7000,
                lpLoyaltyBps: 1000,
                referrerBps: 1000,
                protocolReserveBps: 1000,
                referrerFallback: "rolls_to_holders",
                magpieDefault: "burn_by_operator",
              },
            };
          })(),
          // $MAGPIE burn ledger summary — supply contraction. Includes
          // the dev-wallet baseline burn (2M $MAGPIE) seeded by migration
          // 061 plus every operator-confirmed default burn and future
          // buyback burn. 6 decimals; total_raw is the on-chain base
          // unit count; total_tokens is the human-readable token count.
          magpieBurned: (() => {
            const mb = magpieBurnsResult.rows[0];
            if (!mb || mb.total_raw == null) return null;
            const rawDivisor = 1_000_000; // 10^6 for 6 decimals
            const rawToTokens = (r: string | number | null) =>
              r == null ? 0 : Number(BigInt(r) / BigInt(rawDivisor));
            return {
              totalRaw: String(mb.total_raw),
              totalTokens: rawToTokens(mb.total_raw),
              burnCount: Number(mb.burn_count ?? 0),
              bySource: {
                manualTokens: rawToTokens(mb.manual_raw),
                liquidationDefaultTokens: rawToTokens(mb.liquidation_default_raw),
                buybackTokens: rawToTokens(mb.buyback_raw),
              },
              decimals: 6,
            };
          })(),
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
