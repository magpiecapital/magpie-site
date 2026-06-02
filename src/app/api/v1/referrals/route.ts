/**
 * GET /api/v1/referrals?wallet=<address>
 *
 * Returns the referral code, share link, and earnings summary for the
 * Magpie account linked to a Solana wallet.
 *
 * Strategy: direct DB query (preferred), bot-API fallback, then a
 * neutral zero-state response so the dashboard never sees an error.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "private, s-maxage=10, stale-while-revalidate=30",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? "magpie_capital_bot";
const REFERRAL_REWARD_BPS = 500;
const MIN_CLAIM_LAMPORTS = "5000000";

interface SummaryRow {
  code: string | null;
  referred_count: string | number;
  borrowed_count: string | number;
  lifetime_lamports: string;
  paid_lamports: string;
  claimable_lamports: string;
}

function emptyResponse(wallet: string) {
  return {
    ok: true,
    data: {
      wallet,
      linked: false,
      code: null,
      share_link: null,
      reward_bps: REFERRAL_REWARD_BPS,
      reward_pct: REFERRAL_REWARD_BPS / 100,
      min_claim_lamports: MIN_CLAIM_LAMPORTS,
      referred_count: 0,
      borrowed_count: 0,
      lifetime_lamports: "0",
      paid_lamports: "0",
      claimable_lamports: "0",
      message:
        "This wallet isn't linked to a Magpie account yet. Start the Telegram bot to get your referral code.",
    },
    protocol: "magpie-referrals-v1",
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
      },
      { status: 400 },
    );
  }

  /* Strategy 1: direct DB */
  try {
    const { rows } = await query(
      `SELECT rc.code,
              (SELECT COUNT(*)::int FROM users u2 WHERE u2.referred_by = w.user_id) AS referred_count,
              (SELECT COUNT(DISTINCT re.referee_user_id)::int
                 FROM referral_earnings re WHERE re.referrer_user_id = w.user_id) AS borrowed_count,
              COALESCE((SELECT SUM(re.reward_lamports)::numeric
                          FROM referral_earnings re WHERE re.referrer_user_id = w.user_id), 0)::text AS lifetime_lamports,
              COALESCE((SELECT SUM(re.reward_lamports)::numeric
                          FROM referral_earnings re
                         WHERE re.referrer_user_id = w.user_id AND re.status = 'paid'), 0)::text AS paid_lamports,
              COALESCE((SELECT SUM(re.reward_lamports)::numeric
                          FROM referral_earnings re
                         WHERE re.referrer_user_id = w.user_id AND re.status = 'accrued'), 0)::text AS claimable_lamports
         FROM wallets w
         LEFT JOIN referral_codes rc ON rc.user_id = w.user_id
        WHERE w.public_key = $1
        LIMIT 1`,
      [wallet],
    );

    if (rows.length > 0) {
      const r = rows[0] as SummaryRow;
      const shareLink = r.code ? `https://t.me/${BOT_USERNAME}?start=${r.code}` : null;
      return NextResponse.json(
        {
          ok: true,
          data: {
            wallet,
            linked: true,
            code: r.code,
            share_link: shareLink,
            reward_bps: REFERRAL_REWARD_BPS,
            reward_pct: REFERRAL_REWARD_BPS / 100,
            min_claim_lamports: MIN_CLAIM_LAMPORTS,
            referred_count: Number(r.referred_count),
            borrowed_count: Number(r.borrowed_count),
            lifetime_lamports: r.lifetime_lamports,
            paid_lamports: r.paid_lamports,
            claimable_lamports: r.claimable_lamports,
          },
          protocol: "magpie-referrals-v1",
          timestamp: new Date().toISOString(),
        },
        { headers: HEADERS },
      );
    }
  } catch (err) {
    console.error("[api/referrals] DB error:", (err as Error).message);
  }

  /* Strategy 2: bot API */
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/referrals?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          {
            ok: true,
            data: { wallet, linked: true, ...data },
            protocol: "magpie-referrals-v1",
            timestamp: new Date().toISOString(),
          },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/referrals] Bot API error:", (err as Error).message);
    }
  }

  /* Strategy 3: empty zero-state (wallet not linked) */
  return NextResponse.json(emptyResponse(wallet), { headers: HEADERS });
}
