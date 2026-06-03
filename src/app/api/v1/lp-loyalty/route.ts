/**
 * GET /api/v1/lp-loyalty?wallet=<address>
 *
 * Returns the LP loyalty stats for a wallet — current shares, time held,
 * lifetime loyalty earned, distributions received. Powered by the bot's
 * own /api/v1/lp-loyalty endpoint.
 *
 * Snapshot timing is intentionally NOT exposed (operator-private,
 * anti-dump pattern).
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "";
const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
};

function zeroState(wallet: string) {
  return {
    ok: true,
    data: {
      wallet,
      has_position: false,
      shares: "0",
      seconds_held: 0,
      days_held: 0,
      lifetime_lamports: "0",
      paid_lamports: "0",
      distributions_received: 0,
      reward_bps: 200,
      reward_pct: 2,
      auto_distribute: true,
      message: "Bot API unreachable — try again in a moment.",
    },
    protocol: "magpie-lp-loyalty-v1",
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address> parameter" },
      { status: 400 },
    );
  }

  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/lp-loyalty?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          {
            ok: true,
            data,
            protocol: "magpie-lp-loyalty-v1",
            timestamp: new Date().toISOString(),
          },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/lp-loyalty] bot fetch failed:", (err as Error).message);
    }
  }

  return NextResponse.json(zeroState(wallet), { headers: HEADERS });
}
