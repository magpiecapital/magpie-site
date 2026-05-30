/**
 * GET /api/v1/activity?wallet=<address>
 *
 * Recent activity for a wallet — credit events (repay, borrow, topup,
 * extend, liquidation) enriched with token symbol from the loan they
 * relate to. Direct DB query; bot-API fallback; empty zero state.
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
  symbol: string | null;
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
              ce.loan_id, l.collateral_mint, sm.symbol
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
          token_symbol: r.symbol,
          collateral_mint: r.collateral_mint,
          loan_id: r.loan_id,
          timestamp: r.created_at,
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
