/**
 * GET /api/v1/activity?wallet=<address>
 *
 * Recent activity for a wallet — credit events (repay, borrow, topup,
 * extend, liquidation) enriched with the token symbol, loan amounts,
 * tier, duration, and transaction signature from the loan they relate to.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

interface EventRow {
  id: number;
  event_type: string;
  score_delta: number;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  loan_id: number | null;
  collateral_mint: string | null;
  collateral_amount: string | number | null;
  loan_amount_lamports: string | number | null;
  original_loan_amount_lamports: string | number | null;
  ltv_percentage: number | null;
  duration_days: number | null;
  tx_signature: string | null;
  symbol: string | null;
  decimals: number | null;
  image_url: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await query(
      `SELECT ce.id, ce.event_type, ce.score_delta, ce.metadata, ce.created_at,
              ce.loan_id,
              l.collateral_mint, l.collateral_amount,
              l.loan_amount_lamports, l.original_loan_amount_lamports,
              l.ltv_percentage, l.duration_days, l.tx_signature,
              sm.symbol, sm.decimals, sm.image_url
         FROM credit_events ce
         JOIN wallets w ON w.user_id = ce.user_id
         LEFT JOIN loans l ON l.id = ce.loan_id
         LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint
        WHERE w.public_key = $1
        ORDER BY ce.created_at DESC
        LIMIT $2`,
      [wallet, limit],
    );

    return NextResponse.json(
      {
        ok: true,
        wallet,
        events: rows.map((r: EventRow) => ({
          id: r.id,
          type: r.event_type,
          score_delta: r.score_delta,
          timestamp: r.created_at,
          loan_id: r.loan_id,
          token: r.symbol
            ? {
                symbol: r.symbol,
                mint: r.collateral_mint,
                decimals: r.decimals,
                image: r.image_url || null,
              }
            : null,
          amounts: {
            collateral_raw: r.collateral_amount?.toString?.() ?? null,
            loan_lamports: r.loan_amount_lamports?.toString?.() ?? null,
            original_loan_lamports: r.original_loan_amount_lamports?.toString?.() ?? null,
          },
          terms: {
            ltv_percentage: r.ltv_percentage,
            duration_days: r.duration_days,
          },
          tx_signature: r.tx_signature,
        })),
        source: "database",
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/activity] DB error:", (err as Error).message);
  }

  return NextResponse.json(
    { ok: true, wallet, events: [], source: "fallback_empty" },
    { headers: HEADERS },
  );
}
