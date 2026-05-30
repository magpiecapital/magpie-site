/**
 * GET /api/v1/credit?wallet=<address>
 *
 * Composable Credit Score API — query any Magpie user's credit score
 * by their Solana wallet address.
 *
 * Strategy: direct DB query (preferred), bot-API fallback, then a
 * neutral zero-state response so the dashboard never sees an error.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

interface CreditScoreRow {
  score: number;
  tier: string;
  loans_scored: number;
  updated_at: Date;
  f_repayment_history: number | string;
  f_loan_volume: number | string;
  f_account_age: number | string;
  f_collateral_diversity: number | string;
  f_liquidation_ratio: number | string;
  f_protocol_engagement: number | string;
  max_ltv: number | string;
  fee_rate: number | string;
  max_duration_days: number;
}

function emptyResponse(wallet: string) {
  return {
    ok: true,
    data: {
      wallet,
      score: null,
      tier: null,
      factors: null,
      tier_benefits: null,
      loans_scored: 0,
      message: "No credit history found. Your score will be generated after your first loan.",
    },
    protocol: "magpie-credit-v1",
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing ?wallet=<solana_address> parameter",
        docs: {
          description: "Magpie Composable Credit Score API",
          endpoints: {
            "GET /api/v1/credit?wallet=<address>": "Query credit score by wallet",
            "GET /api/v1/credit/leaderboard": "Top credit scores",
          },
          score_range: "300 (min) – 850 (max)",
          tiers: {
            bronze: "300-499 → 30% max LTV, 1.5–3% fee (tier-dependent)",
            silver: "500-649 → 32% max LTV, 1.5–3% fee (tier-dependent)",
            gold: "650-749 → 35% max LTV, 1.25–2.75% fee",
            platinum: "750-850 → 38% max LTV, 1.0–2.5% fee",
          },
          factors: [
            "repayment_history (35%)",
            "loan_volume (20%)",
            "account_age (15%)",
            "collateral_diversity (15%)",
            "liquidation_ratio (10%)",
            "protocol_engagement (5%)",
          ],
        },
      },
      { status: 400 },
    );
  }

  /* Strategy 1: direct DB query */
  try {
    const { rows } = await query(
      `SELECT cs.score, cs.tier, cs.loans_scored, cs.updated_at,
              cs.f_repayment_history, cs.f_loan_volume, cs.f_account_age,
              cs.f_collateral_diversity, cs.f_liquidation_ratio, cs.f_protocol_engagement,
              cs.max_ltv, cs.fee_rate, cs.max_duration_days
         FROM credit_scores cs
         JOIN wallets w ON w.user_id = cs.user_id
        WHERE w.public_key = $1
        LIMIT 1`,
      [wallet],
    );

    if (rows.length > 0) {
      const r = rows[0] as CreditScoreRow;
      return NextResponse.json(
        {
          ok: true,
          data: {
            wallet,
            score: Number(r.score),
            tier: r.tier,
            factors: {
              repayment_history: Number(r.f_repayment_history),
              loan_volume: Number(r.f_loan_volume),
              account_age: Number(r.f_account_age),
              collateral_diversity: Number(r.f_collateral_diversity),
              liquidation_ratio: Number(r.f_liquidation_ratio),
              protocol_engagement: Number(r.f_protocol_engagement),
            },
            tier_benefits: {
              max_ltv: Number(r.max_ltv),
              fee_rate: Number(r.fee_rate),
              max_duration_days: r.max_duration_days,
            },
            loans_scored: r.loans_scored,
            updated_at: r.updated_at,
          },
          protocol: "magpie-credit-v1",
          timestamp: new Date().toISOString(),
        },
        { headers: HEADERS },
      );
    }
  } catch (err) {
    console.error("[api/credit] DB error:", (err as Error).message);
  }

  /* Strategy 2: bot API */
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/credit/score?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          {
            ok: true,
            data: { wallet, ...data },
            protocol: "magpie-credit-v1",
            timestamp: new Date().toISOString(),
          },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/credit] Bot API error:", (err as Error).message);
    }
  }

  /* Strategy 3: empty zero state — first loan hasn't generated a score yet */
  return NextResponse.json(emptyResponse(wallet), { headers: HEADERS });
}
