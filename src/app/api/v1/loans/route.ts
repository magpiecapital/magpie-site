/**
 * GET /api/v1/loans?wallet=<address>
 *
 * Returns the active loans and recent history for a Magpie-managed wallet.
 * Strategy mirrors /api/v1/tokens:
 *   1. Direct DB query (preferred — same Railway Postgres the bot uses)
 *   2. Bot API on Railway (fallback if DB unreachable)
 *   3. Empty zero-state response (unknown wallet or total outage)
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
  "X-Powered-By": "Magpie Protocol",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

interface LoanRow {
  loan_id: string | number | null;
  loan_pda: string;
  collateral_mint: string;
  collateral_amount: string | number;
  loan_amount_lamports: string | number;
  original_loan_amount_lamports: string | number;
  ltv_percentage: number;
  duration_days: number;
  start_timestamp: Date;
  due_timestamp: Date;
  status: string;
  tx_signature: string | null;
  updated_at: Date;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  image_url: string | null;
  category: string | null;
}

function shape(l: LoanRow) {
  return {
    loan_id: l.loan_id?.toString?.() ?? null,
    loan_pda: l.loan_pda,
    status: l.status,
    collateral: {
      mint: l.collateral_mint,
      symbol: l.symbol,
      name: l.name,
      decimals: l.decimals,
      image: l.image_url || null,
      category: l.category || "memecoin",
      amount: l.collateral_amount?.toString?.() ?? null,
    },
    loan: {
      amount_lamports: l.loan_amount_lamports?.toString?.() ?? null,
      original_amount_lamports: l.original_loan_amount_lamports?.toString?.() ?? null,
      ltv_percentage: l.ltv_percentage,
      duration_days: l.duration_days,
    },
    timestamps: {
      started_at: l.start_timestamp,
      due_at: l.due_timestamp,
      updated_at: l.updated_at,
    },
    tx_signature: l.tx_signature,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  /* Strategy 1: direct DB query */
  try {
    const { rows } = await query(
      `SELECT l.loan_id, l.loan_pda, l.collateral_mint, l.collateral_amount,
              l.loan_amount_lamports, l.original_loan_amount_lamports,
              l.ltv_percentage, l.duration_days,
              l.start_timestamp, l.due_timestamp,
              l.status, l.tx_signature, l.updated_at,
              sm.symbol, sm.name, sm.decimals, sm.image_url, sm.category
         FROM loans l
         JOIN wallets w ON w.user_id = l.user_id
         LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint
        WHERE w.public_key = $1
        ORDER BY l.start_timestamp DESC
        LIMIT 100`,
      [wallet],
    );

    return NextResponse.json(
      {
        ok: true,
        wallet,
        active: rows.filter((r: LoanRow) => r.status === "active").map(shape),
        history: rows.filter((r: LoanRow) => r.status !== "active").map(shape),
        source: "database",
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/loans] DB error:", (err as Error).message);
  }

  /* Strategy 2: bot API */
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/loans?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          { ok: true, ...data, source: "bot_api" },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/loans] Bot API error:", (err as Error).message);
    }
  }

  /* Strategy 3: empty zero state */
  return NextResponse.json(
    { ok: true, wallet, active: [], history: [], source: "fallback_empty" },
    { headers: HEADERS },
  );
}
