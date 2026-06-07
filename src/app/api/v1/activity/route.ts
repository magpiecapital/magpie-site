/**
 * GET /api/v1/activity?wallet=<address>
 *
 * Unified activity feed across the entire Magpie ecosystem:
 *   • Loan-related credit events (borrow, repay, topup, extend, liquidation)
 *   • Referral earnings (you accrued a share because a referee took a loan)
 *   • Holder distributions (snapshot paid you SOL pro-rata)
 *
 * Single chronological feed for the dashboard — every value-affecting
 * event in one place.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey("4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh");

function deriveLoanPda(borrower: PublicKey, loanId: string, programId: PublicKey): PublicKey {
  const idBuf = Buffer.alloc(8);
  new BN(loanId).toArrayLike(Buffer, "le", 8).copy(idBuf);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), borrower.toBuffer(), idBuf],
    programId,
  );
  return pda;
}

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

interface UnifiedRow {
  source: string;
  id: string;
  type: string;
  score_delta: number | string | null;
  timestamp: Date;
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
  reward_lamports: string | null;
  reward_status: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10) || 30, 100);

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await query(
      `WITH user_lookup AS (
         SELECT user_id FROM wallets WHERE public_key = $1
       )
       SELECT * FROM (
         -- 1. Loan-related credit events
         SELECT
           'credit_event'::text                    AS source,
           ce.id::text                             AS id,
           ce.event_type                           AS type,
           ce.score_delta::text                    AS score_delta,
           ce.created_at                           AS timestamp,
           ce.loan_id                              AS loan_id,
           l.collateral_mint                       AS collateral_mint,
           l.collateral_amount::text               AS collateral_amount,
           l.loan_amount_lamports::text            AS loan_amount_lamports,
           l.original_loan_amount_lamports::text   AS original_loan_amount_lamports,
           l.ltv_percentage                        AS ltv_percentage,
           l.duration_days                         AS duration_days,
           l.tx_signature                          AS tx_signature,
           sm.symbol                               AS symbol,
           sm.decimals                             AS decimals,
           sm.image_url                            AS image_url,
           NULL::text                              AS reward_lamports,
           NULL::text                              AS reward_status
         FROM credit_events ce
         JOIN user_lookup ul ON ul.user_id = ce.user_id
         LEFT JOIN loans l ON l.id = ce.loan_id
         LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint

         UNION ALL

         -- 2. Referral earnings — you (as referrer) accrued a share when a referee took a loan
         SELECT
           'referral'::text                        AS source,
           ('r_' || re.id::text)                   AS id,
           'referral_earned'                       AS type,
           NULL::text                              AS score_delta,
           re.created_at                           AS timestamp,
           re.loan_db_id                           AS loan_id,
           NULL::text                              AS collateral_mint,
           NULL::text                              AS collateral_amount,
           NULL::text                              AS loan_amount_lamports,
           NULL::text                              AS original_loan_amount_lamports,
           NULL::integer                           AS ltv_percentage,
           NULL::integer                           AS duration_days,
           re.paid_tx_signature                    AS tx_signature,
           NULL::text                              AS symbol,
           NULL::integer                           AS decimals,
           NULL::text                              AS image_url,
           re.reward_lamports::text                AS reward_lamports,
           re.status                               AS reward_status
         FROM referral_earnings re
         JOIN user_lookup ul ON ul.user_id = re.referrer_user_id

         UNION ALL

         -- 3. Holder distributions — auto-paid to wallet on each snapshot
         SELECT
           'holder'::text                          AS source,
           ('h_' || mhr.id::text)                  AS id,
           'holder_distribution'                   AS type,
           NULL::text                              AS score_delta,
           COALESCE(mhr.paid_at, mhr.created_at)   AS timestamp,
           NULL::integer                           AS loan_id,
           NULL::text                              AS collateral_mint,
           NULL::text                              AS collateral_amount,
           NULL::text                              AS loan_amount_lamports,
           NULL::text                              AS original_loan_amount_lamports,
           NULL::integer                           AS ltv_percentage,
           NULL::integer                           AS duration_days,
           mhr.paid_tx_signature                   AS tx_signature,
           NULL::text                              AS symbol,
           NULL::integer                           AS decimals,
           NULL::text                              AS image_url,
           mhr.reward_lamports::text               AS reward_lamports,
           mhr.status                              AS reward_status
         FROM magpie_holder_rewards mhr
         WHERE mhr.wallet_address = $1
       ) AS unified
       ORDER BY timestamp DESC
       LIMIT $2`,
      [wallet, limit],
    );

    // Wallet-scope the credit_event subset (borrow/repay/topup/extend
    // events tied to a specific loan). Referrals + holder rewards stay
    // user-scoped (consolidated benefits per the operator policy).
    //
    // To filter: fetch the user's loans that THIS wallet borrowed (by
    // PDA derivation), build a Set of loan db-ids, drop any credit_event
    // whose loan_id isn't in the set.
    let scopedRows: UnifiedRow[] = rows as UnifiedRow[];
    try {
      let walletPk: PublicKey;
      try { walletPk = new PublicKey(wallet); } catch { walletPk = null as unknown as PublicKey; }
      if (walletPk) {
        const { rows: loanRows } = await query(
          `SELECT l.id, l.loan_id, l.loan_pda, l.program_id
             FROM loans l
             JOIN wallets w ON w.user_id = l.user_id
            WHERE w.public_key = $1`,
          [wallet],
        );
        const scopedLoanIds = new Set<string>();
        for (const lr of loanRows as Array<{ id: number; loan_id: string | number; loan_pda: string; program_id: string | null }>) {
          if (!lr.loan_id || !lr.loan_pda) { scopedLoanIds.add(String(lr.id)); continue; }
          try {
            let progId: PublicKey;
            try { progId = lr.program_id ? new PublicKey(lr.program_id) : PROGRAM_ID; }
            catch { progId = PROGRAM_ID; }
            const derived = deriveLoanPda(walletPk, String(lr.loan_id), progId);
            if (derived.toBase58() === lr.loan_pda) scopedLoanIds.add(String(lr.id));
          } catch {
            scopedLoanIds.add(String(lr.id)); // unverifiable → keep
          }
        }
        scopedRows = (rows as UnifiedRow[]).filter((r) => {
          // Only credit_event rows are loan-tied. Keep all other sources.
          if (r.source !== "credit_event") return true;
          if (r.loan_id == null) return true;
          return scopedLoanIds.has(String(r.loan_id));
        });
      }
    } catch (err) {
      console.warn("[api/activity] wallet-scope failed; returning user-wide:", (err as Error).message);
    }

    return NextResponse.json(
      {
        ok: true,
        wallet,
        events: scopedRows.map((r: UnifiedRow) => ({
          id: r.id,
          source: r.source,
          type: r.type,
          score_delta: r.score_delta != null ? Number(r.score_delta) : null,
          timestamp: r.timestamp,
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
          reward: r.reward_lamports
            ? { lamports: r.reward_lamports, status: r.reward_status ?? null }
            : null,
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
