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
    // One row per loan. The wallet shown should be the one that
    // ACTUALLY executed this loan, not the user's currently-active
    // one. Previous logic ("pick the active wallet for this user")
    // made every loan for a multi-wallet user look like the same
    // stub (e.g. `DNU8…VFei` repeated) even when different wallets
    // signed each loan.
    //
    // Heuristic: pick the user's wallet that existed at the time the
    // loan opened, preferring the most recently created one created
    // BEFORE or AT the loan's start_timestamp. That's the wallet they
    // would have been using at that moment. (A fully accurate fix
    // requires a borrower_wallet column on loans — separate work.)
    const { rows } = await query(
      `SELECT
         l.loan_id, l.status,
         l.loan_amount_lamports, l.original_loan_amount_lamports,
         l.ltv_percentage, l.duration_days,
         l.start_timestamp, l.updated_at,
         l.collateral_amount,
         sm.symbol, sm.decimals,
         COALESCE(l.borrower_wallet, w.public_key) AS wallet_pub
       FROM loans l
       LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint
       LEFT JOIN LATERAL (
         SELECT public_key FROM wallets
          WHERE user_id = l.user_id
            AND created_at <= l.start_timestamp
          ORDER BY created_at DESC
          LIMIT 1
       ) w ON l.borrower_wallet IS NULL
       ORDER BY GREATEST(l.start_timestamp, l.updated_at) DESC
       LIMIT $1`,
      [limit],
    );

    // Emit BOTH the borrow event AND the closing event (repay/liquidation)
    // per loan row. Previously we mapped each row to ONE event by current
    // status — which meant a closed loan made its original borrow event
    // disappear from the feed once it was repaid. Now: every loan
    // contributes a borrow at start_timestamp + (if closed) a closing
    // event at updated_at. Final list is re-sorted newest-first since the
    // SQL ORDER BY only guaranteed loan-level ordering, not per-event.
    const events = (rows as ActivityRow[]).flatMap((r) => {
      const loanAmountSol = Number(r.loan_amount_lamports) / 1e9;
      const collateralAmount = r.decimals != null
        ? Number(r.collateral_amount) / Math.pow(10, r.decimals)
        : null;
      const common = {
        loan_id: r.loan_id,
        wallet_stub: stubWallet(r.wallet_pub),
        symbol: r.symbol ?? "?",
        loan_amount_sol: loanAmountSol,
        collateral_amount: collateralAmount,
        ltv_pct: r.ltv_percentage,
        duration_days: r.duration_days,
      };
      // SQL timestamps come back as Date objects from pg — normalize
      // to ISO strings so the JSON response is consistent.
      const startIso = new Date(r.start_timestamp).toISOString();
      const updatedIso = new Date(r.updated_at).toISOString();
      const out: Array<typeof common & { type: string; timestamp: string }> = [
        { ...common, type: "borrow", timestamp: startIso },
      ];
      if (r.status === "repaid") {
        out.push({ ...common, type: "repay", timestamp: updatedIso });
      } else if (r.status === "liquidated") {
        out.push({ ...common, type: "liquidation", timestamp: updatedIso });
      }
      return out;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

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
