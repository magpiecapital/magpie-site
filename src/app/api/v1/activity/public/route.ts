/**
 * GET /api/v1/activity/public
 *
 * Anonymized live activity feed. Returns the last N loan + repay
 * events with WALLET STUBBED (first 4 / last 4 chars only) so we
 * preserve user privacy while still providing social-proof signal.
 *
 * Designed for the live ticker on /stats — the protocol breathing.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
  "X-Powered-By": "Magpie Protocol",
  "Access-Control-Allow-Origin": "*",
};

interface ActivityRow {
  loan_id: string;
  status: string;
  loan_amount_lamports: string;
  original_loan_amount_lamports: string;
  ltv_percentage: number;
  duration_days: number;
  start_timestamp: Date | string;
  updated_at: Date | string;
  collateral_amount: string;
  symbol: string | null;
  decimals: number | null;
  wallet_pub: string | null;
}

function stubWallet(pub: string | null): string {
  if (!pub) return "anon";
  if (pub.length <= 8) return pub;
  return `${pub.slice(0, 4)}…${pub.slice(-4)}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

  try {
    // One row per loan. The earlier LEFT JOIN wallets w ON w.user_id =
    // l.user_id was a cross-join in disguise: users with multiple linked
    // wallets had their single loan appear once per wallet (so a 4.7 SOL
    // borrow looked like 3 separate events). Use a LATERAL subquery to
    // pick exactly one wallet per user — prefer the active one, fall
    // back to oldest imported.
    const { rows } = await query(
      `SELECT
         l.loan_id, l.status,
         l.loan_amount_lamports, l.original_loan_amount_lamports,
         l.ltv_percentage, l.duration_days,
         l.start_timestamp, l.updated_at,
         l.collateral_amount,
         sm.symbol, sm.decimals,
         w.public_key AS wallet_pub
       FROM loans l
       LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint
       LEFT JOIN LATERAL (
         SELECT public_key FROM wallets
          WHERE user_id = l.user_id
          ORDER BY is_active DESC, created_at ASC
          LIMIT 1
       ) w ON true
       ORDER BY GREATEST(l.start_timestamp, l.updated_at) DESC
       LIMIT $1`,
      [limit],
    );

    const events = (rows as ActivityRow[]).map((r) => {
      const isRecent = new Date(r.updated_at) > new Date(r.start_timestamp);
      const eventType =
        r.status === "active" ? "borrow"
        : r.status === "repaid" ? "repay"
        : r.status === "liquidated" ? "liquidation"
        : "update";
      // For repay/liquidation use updated_at; for borrow use start_timestamp
      const ts = (r.status === "active" || !isRecent) ? r.start_timestamp : r.updated_at;
      const loanAmountSol = Number(r.loan_amount_lamports) / 1e9;
      const collateralAmount = r.decimals != null
        ? Number(r.collateral_amount) / Math.pow(10, r.decimals)
        : null;
      return {
        type: eventType,
        loan_id: r.loan_id,
        wallet_stub: stubWallet(r.wallet_pub),
        symbol: r.symbol ?? "?",
        loan_amount_sol: loanAmountSol,
        collateral_amount: collateralAmount,
        ltv_pct: r.ltv_percentage,
        duration_days: r.duration_days,
        timestamp: ts,
      };
    });

    return NextResponse.json(
      { events, generated_at: new Date().toISOString() },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/v1/activity/public] error:", err);
    return NextResponse.json(
      { events: [], error: "Activity feed temporarily unavailable" },
      { status: 200, headers: HEADERS }, // 200 with empty events — graceful
    );
  }
}
