/**
 * GET /api/v1/transparency
 *
 * Public aggregated protocol health stats — the trust-signal payload.
 * No auth, no PII, designed for the transparency page on this site
 * AND for any third-party dashboard / aggregator that wants to verify
 * Magpie's claims.
 *
 * Shape mirrors the bot's /api/v1/transparency endpoint so consumers
 * can hit either origin.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "X-Powered-By": "Magpie Protocol",
  "Access-Control-Allow-Origin": "*",
};

export async function GET() {
  try {
    const [loansR, usersR, holdersR, lpLoyR, refsR] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE status = 'active')::text AS active,
           COUNT(*) FILTER (WHERE status = 'repaid')::text AS repaid,
           COUNT(*) FILTER (WHERE status = 'liquidated')::text AS liquidated,
           COUNT(*) FILTER (WHERE start_timestamp > NOW() - INTERVAL '24 hours')::text AS new_24h,
           COUNT(*) FILTER (WHERE start_timestamp > NOW() - INTERVAL '7 days')::text AS new_7d,
           COUNT(*) FILTER (WHERE start_timestamp > NOW() - INTERVAL '30 days')::text AS new_30d,
           COALESCE(SUM(loan_amount_lamports::numeric), 0)::text AS lifetime_borrowed_lamports,
           COALESCE(SUM(CASE WHEN start_timestamp > NOW() - INTERVAL '24 hours'
                             THEN loan_amount_lamports::numeric ELSE 0 END), 0)::text
             AS borrowed_24h_lamports
         FROM loans`,
      ),
      query(
        `SELECT
           COUNT(*)::text AS total_users,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::text AS new_users_24h,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::text AS new_users_7d
         FROM users`,
      ),
      query(
        `SELECT
           (SELECT accrued_lamports::text FROM magpie_holder_pool WHERE id = 1) AS current_pool_lamports,
           (SELECT COUNT(*)::text FROM magpie_holder_distributions) AS lifetime_distributions,
           (SELECT total_distributed_lamports::text FROM magpie_holder_distributions
              ORDER BY id DESC LIMIT 1) AS last_distribution_lamports,
           (SELECT created_at FROM magpie_holder_distributions ORDER BY id DESC LIMIT 1)
             AS last_distribution_at`,
      ),
      query(
        `SELECT
           (SELECT accrued_lamports::text FROM lp_loyalty_pool WHERE id = 1) AS current_pool_lamports,
           (SELECT COUNT(*)::text FROM lp_loyalty_distributions) AS lifetime_distributions`,
      ),
      query(
        `SELECT
           COALESCE(SUM(reward_lamports)::text, '0') AS lifetime_accrued,
           COALESCE(SUM(CASE WHEN status='paid' THEN reward_lamports ELSE 0 END)::text, '0')
             AS lifetime_paid
         FROM referral_earnings`,
      ),
    ]);

    const loans = loansR.rows[0];
    const users = usersR.rows[0];
    const holders = holdersR.rows[0];
    const lpLoy = lpLoyR.rows[0];
    const refs = refsR.rows[0];

    const repaid = Number(loans.repaid);
    const liquidated = Number(loans.liquidated);
    const finalized = repaid + liquidated;
    const defaultRatePct = finalized > 0
      ? +((liquidated / finalized) * 100).toFixed(3)
      : 0;

    return NextResponse.json(
      {
        headline: {
          liquidations_lifetime: liquidated,
          default_rate_pct: defaultRatePct,
          users: Number(users.total_users),
          loans_lifetime: Number(loans.total),
        },
        loans: {
          total: Number(loans.total),
          active: Number(loans.active),
          repaid: Number(loans.repaid),
          liquidated: Number(loans.liquidated),
          new_24h: Number(loans.new_24h),
          new_7d: Number(loans.new_7d),
          new_30d: Number(loans.new_30d),
          lifetime_borrowed_sol: Number(loans.lifetime_borrowed_lamports) / 1e9,
          borrowed_24h_sol: Number(loans.borrowed_24h_lamports) / 1e9,
        },
        users: {
          total: Number(users.total_users),
          new_24h: Number(users.new_users_24h),
          new_7d: Number(users.new_users_7d),
        },
        holder_rewards: {
          current_pool_sol: holders.current_pool_lamports
            ? Number(holders.current_pool_lamports) / 1e9 : 0,
          lifetime_distributions: Number(holders.lifetime_distributions),
          last_distribution_sol: holders.last_distribution_lamports
            ? Number(holders.last_distribution_lamports) / 1e9 : null,
          last_distribution_at: holders.last_distribution_at,
        },
        lp_loyalty: {
          current_pool_sol: lpLoy.current_pool_lamports
            ? Number(lpLoy.current_pool_lamports) / 1e9 : 0,
          lifetime_distributions: Number(lpLoy.lifetime_distributions),
        },
        referrals: {
          lifetime_accrued_sol: Number(refs.lifetime_accrued) / 1e9,
          lifetime_paid_sol: Number(refs.lifetime_paid) / 1e9,
        },
        generated_at: new Date().toISOString(),
        cache_ttl_seconds: 60,
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/v1/transparency] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Transparency data temporarily unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: HEADERS },
    );
  }
}
