/**
 * GET /api/v1/transparency
 *
 * Public aggregated protocol health stats — the trust-signal payload.
 * No auth, no PII, designed for the transparency page on this site
 * AND for any third-party dashboard / aggregator that wants to verify
 * Magpie's claims.
 *
 * Resilient design: each section runs in its own try/catch so a
 * single missing table (e.g., new schema yet to migrate) doesn't
 * break the whole endpoint. We always return SOMETHING — partial
 * data + warnings beats a 503.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "X-Powered-By": "Magpie Protocol",
  "Access-Control-Allow-Origin": "*",
};

async function tryQuery<T>(sql: string, fallback: T): Promise<T> {
  try {
    const r = await query(sql);
    return r.rows[0] as T;
  } catch (err) {
    console.warn("[transparency] subquery failed:", (err as Error).message);
    return fallback;
  }
}

interface LoansRow {
  total: string;
  active: string;
  repaid: string;
  liquidated: string;
  new_24h: string;
  new_7d: string;
  new_30d: string;
  lifetime_borrowed_lamports: string;
  borrowed_24h_lamports: string;
}

interface UsersRow {
  total_users: string;
  new_users_24h: string;
  new_users_7d: string;
}

interface HoldersRow {
  current_pool_lamports: string | null;
  lifetime_distributions: string;
  last_distribution_lamports: string | null;
  last_distribution_at: Date | string | null;
}

interface LpLoyRow {
  current_pool_lamports: string | null;
  gross_pool_lamports: string | null;
  lifetime_distributions: string;
  last_distribution_lamports: string | null;
  last_distribution_at: Date | string | null;
}

interface RefsRow {
  lifetime_accrued: string;
  lifetime_paid: string;
}

interface ReserveRow {
  current_pool_lamports: string | null;
  spent_lamports: string | null;
  lifetime_accrued_lamports: string | null;
}

export async function GET() {
  const [loans, users, holders, lpLoy, refs, reserveRow] = await Promise.all([
    tryQuery<LoansRow>(
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
      {
        total: "0", active: "0", repaid: "0", liquidated: "0",
        new_24h: "0", new_7d: "0", new_30d: "0",
        lifetime_borrowed_lamports: "0", borrowed_24h_lamports: "0",
      },
    ),
    tryQuery<UsersRow>(
      `SELECT
         COUNT(*)::text AS total_users,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::text AS new_users_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::text AS new_users_7d
       FROM users`,
      { total_users: "0", new_users_24h: "0", new_users_7d: "0" },
    ),
    tryQuery<HoldersRow>(
      // 2026-06-14: column reference fix. The query previously named
      // `total_distributed_lamports` which doesn't exist on
      // magpie_holder_distributions — the actual column is `pool_lamports`.
      // The whole subquery was failing, tryQuery defaulted to null, and
      // /stats showed "$MAGPIE holders: 0.0000 SOL" even though the
      // backing magpie_holder_pool ledger had real value (2.35 SOL when
      // this was caught). Other pools (lp_loyalty, protocol_reserve)
      // were unaffected because their queries didn't reference the
      // missing column.
      `SELECT
         (SELECT accrued_lamports::text FROM magpie_holder_pool WHERE id = 1) AS current_pool_lamports,
         (SELECT COUNT(*)::text FROM magpie_holder_distributions) AS lifetime_distributions,
         (SELECT pool_lamports::text FROM magpie_holder_distributions
            ORDER BY id DESC LIMIT 1) AS last_distribution_lamports,
         (SELECT created_at FROM magpie_holder_distributions ORDER BY id DESC LIMIT 1)
           AS last_distribution_at`,
      {
        current_pool_lamports: null, lifetime_distributions: "0",
        last_distribution_lamports: null, last_distribution_at: null,
      },
    ),
    tryQuery<LpLoyRow>(
      // Surface uniformity — same shape as holder_rewards so /stats can render
      // a "Last SOL LP distribution: X SOL — N ago" line that matches the
      // $MAGPIE holders line. Operator-mandated 2026-06-19 PM.
      // "SOL LPs" current_pool = the THIRD-PARTY distributable, with the operator's
      // exempt lender wallet TAKEN OUT of BOTH the numerator AND the denominator
      // (operator decision 2026-07-04, superseding 2026-06-25). The exempt seed is
      // fully cut out, so the third-party LPs split the FULL pool: net = gross ×
      // (non-exempt weight / non-exempt weight), weight = shares × seconds_held —
      // the same model snapshotAndDistributeLpLoyalty uses. Falls back to the
      // gross pool if the weight ratio can't be computed.
      `SELECT
         ROUND(
           (SELECT accrued_lamports FROM lp_loyalty_pool WHERE id = 1)::numeric
           * COALESCE(
               (SELECT SUM(shares * EXTRACT(EPOCH FROM (NOW() - weighted_deposit_at)))
                  FROM lp_positions
                 WHERE shares > 0 AND EXTRACT(EPOCH FROM (NOW() - weighted_deposit_at)) > 0
                   AND wallet_address NOT IN (SELECT wallet_address FROM lp_loyalty_exempt_wallets))
               / NULLIF(
               (SELECT SUM(shares * EXTRACT(EPOCH FROM (NOW() - weighted_deposit_at)))
                  FROM lp_positions
                 WHERE shares > 0 AND EXTRACT(EPOCH FROM (NOW() - weighted_deposit_at)) > 0
                   AND wallet_address NOT IN (SELECT wallet_address FROM lp_loyalty_exempt_wallets)), 0)
             , 1)
         )::bigint::text AS current_pool_lamports,
         (SELECT accrued_lamports::text FROM lp_loyalty_pool WHERE id = 1) AS gross_pool_lamports,
         (SELECT COUNT(*)::text FROM lp_loyalty_distributions) AS lifetime_distributions,
         (SELECT pool_lamports::text FROM lp_loyalty_distributions
            ORDER BY id DESC LIMIT 1) AS last_distribution_lamports,
         (SELECT created_at FROM lp_loyalty_distributions
            ORDER BY id DESC LIMIT 1) AS last_distribution_at`,
      {
        current_pool_lamports: null, gross_pool_lamports: null, lifetime_distributions: "0",
        last_distribution_lamports: null, last_distribution_at: null,
      },
    ),
    tryQuery<RefsRow>(
      `SELECT
         COALESCE(SUM(reward_lamports)::text, '0') AS lifetime_accrued,
         COALESCE(SUM(CASE WHEN status='paid' THEN reward_lamports ELSE 0 END)::text, '0')
           AS lifetime_paid
       FROM referral_earnings`,
      { lifetime_accrued: "0", lifetime_paid: "0" },
    ),
    tryQuery<ReserveRow>(
      // MGP-001 protocol reserve pool (migration 049). PER-CYCLE (operator
      // 2026-06-25: every Snapshot-rewards number must reset to 0 each cycle):
      // current_pool = reserve accrued SINCE the last $MAGPIE snapshot, so it
      // resets to 0 every distribution cycle instead of accumulating. Display-only
      // — the protocol_reserve_pool ledger is untouched; lifetime_accrued kept for
      // transparency. Safe on older deploys — tryQuery defaults on absence.
      `SELECT
         COALESCE((
           SELECT SUM(reward_lamports)::text FROM protocol_reserve_events
            WHERE created_at > COALESCE(
              (SELECT MAX(created_at) FROM magpie_holder_distributions), '1970-01-01'::timestamptz)
         ), '0') AS current_pool_lamports,
         spent_lamports::text   AS spent_lamports,
         accrued_lamports::text AS lifetime_accrued_lamports
       FROM protocol_reserve_pool WHERE id = 1`,
      { current_pool_lamports: null, spent_lamports: null, lifetime_accrued_lamports: null },
    ),
  ]);

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
        // 2026-06-13 (per operator request): current_pool_sol is NOW
        // public. The front-running concern relied on amount+timing;
        // we still hide next_distribution_at (random 5-10 day window
        // is operator-private per memory rule governance_snapshot_internal),
        // so callers see the size but not WHEN, which kills the timing arb.
        current_pool_sol: holders.current_pool_lamports
          ? Number(holders.current_pool_lamports) / 1e9 : 0,
        lifetime_distributions: Number(holders.lifetime_distributions),
        last_distribution_sol: holders.last_distribution_lamports
          ? Number(holders.last_distribution_lamports) / 1e9 : null,
        last_distribution_at: holders.last_distribution_at,
      },
      lp_loyalty: {
        // Net distributable to third-party LPs (operator's exempt LP share taken out).
        current_pool_sol: lpLoy.current_pool_lamports
          ? Number(lpLoy.current_pool_lamports) / 1e9 : 0,
        // Gross accrued (10% of fees, before the operator-exempt slice is removed).
        gross_pool_sol: lpLoy.gross_pool_lamports
          ? Number(lpLoy.gross_pool_lamports) / 1e9 : 0,
        lifetime_distributions: Number(lpLoy.lifetime_distributions),
        last_distribution_sol: lpLoy.last_distribution_lamports
          ? Number(lpLoy.last_distribution_lamports) / 1e9 : null,
        last_distribution_at: lpLoy.last_distribution_at,
      },
      referrals: {
        // current_pool_sol = accrued minus paid (still claimable).
        current_pool_sol: (Number(refs.lifetime_accrued) - Number(refs.lifetime_paid)) / 1e9,
        lifetime_accrued_sol: Number(refs.lifetime_accrued) / 1e9,
        lifetime_paid_sol: Number(refs.lifetime_paid) / 1e9,
      },
      protocol_reserve: {
        // MGP-001 channel — 10% of every loan fee. PER-CYCLE: current_pool_sol =
        // accrued since the last $MAGPIE snapshot, resetting to 0 each cycle (so it
        // never shows as a growing buffer). lifetime_accrued_sol kept for
        // transparency. Spend is manual + governance-visible.
        current_pool_sol: reserveRow.current_pool_lamports
          ? Number(reserveRow.current_pool_lamports) / 1e9 : 0,
        lifetime_accrued_sol: reserveRow.lifetime_accrued_lamports
          ? Number(reserveRow.lifetime_accrued_lamports) / 1e9 : 0,
        lifetime_spent_sol: reserveRow.spent_lamports
          ? Number(reserveRow.spent_lamports) / 1e9 : 0,
      },
      generated_at: new Date().toISOString(),
      cache_ttl_seconds: 60,
    },
    { headers: HEADERS },
  );
}
