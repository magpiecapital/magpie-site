/**
 * GET /api/v1/transparency/collateral
 *
 * Public breakdown of which tokens are being used as collateral.
 * Returns one row per token with active and lifetime loan counts +
 * total SOL borrowed. Sorted by active loans descending (most-used
 * collateral first), with a fallback to lifetime if no actives.
 *
 * Used by the /stats page's "Collateral in use" section.
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
    const { rows } = await query(
      `SELECT
         sm.symbol,
         sm.name,
         sm.mint,
         sm.image_url,
         COUNT(l.id) FILTER (WHERE l.status = 'active')::int      AS active_loans,
         COUNT(l.id) FILTER (WHERE l.status = 'repaid')::int      AS repaid_loans,
         COUNT(l.id) FILTER (WHERE l.status = 'liquidated')::int  AS liquidated_loans,
         COUNT(l.id)::int                                          AS total_loans,
         COALESCE(SUM(l.loan_amount_lamports::numeric), 0)::text  AS total_borrowed_lamports,
         COALESCE(SUM(l.loan_amount_lamports::numeric) FILTER (WHERE l.status = 'active'), 0)::text AS active_borrowed_lamports
       FROM supported_mints sm
       LEFT JOIN loans l ON l.collateral_mint = sm.mint
       WHERE sm.enabled = TRUE
       GROUP BY sm.symbol, sm.name, sm.mint, sm.image_url
       HAVING COUNT(l.id) > 0
       ORDER BY
         COUNT(l.id) FILTER (WHERE l.status = 'active') DESC,
         COUNT(l.id) DESC`,
    );

    const tokens = rows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      mint: r.mint,
      image_url: r.image_url,
      active_loans: r.active_loans,
      repaid_loans: r.repaid_loans,
      liquidated_loans: r.liquidated_loans,
      total_loans: r.total_loans,
      total_borrowed_sol: Number(r.total_borrowed_lamports) / 1e9,
      active_borrowed_sol: Number(r.active_borrowed_lamports) / 1e9,
    }));

    return NextResponse.json(
      { tokens, generated_at: new Date().toISOString() },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/v1/transparency/collateral] error:", err);
    return NextResponse.json(
      { tokens: [], error: "Collateral breakdown temporarily unavailable" },
      { status: 200, headers: HEADERS },
    );
  }
}
