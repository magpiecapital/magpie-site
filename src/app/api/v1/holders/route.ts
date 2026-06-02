/**
 * GET /api/v1/holders?wallet=<address>
 *
 * Returns the $MAGPIE balance and holder-reward stats (lifetime,
 * paid, claimable) for any Solana wallet. Wallet does NOT need to be
 * a Magpie bot user — anyone holding $MAGPIE on-chain earns.
 *
 * Strategy: proxy to bot API. Falls back to a neutral zero-state if
 * the bot API is unreachable so the dashboard never sees an error.
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "";
const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
};

const REWARD_BPS = 1000;

function zeroState(wallet: string) {
  return {
    ok: true,
    data: {
      wallet,
      magpie_balance_raw: "0",
      magpie_balance: 0,
      has_balance: false,
      reward_bps: REWARD_BPS,
      reward_pct: REWARD_BPS / 100,
      lifetime_lamports: "0",
      paid_lamports: "0",
      pending_lamports: "0",
      distributions_count: 0,
      estimated_next_payout_lamports: "0",
      auto_distribute: true,
      message: "Bot API unreachable — try again in a moment.",
    },
    protocol: "magpie-holders-v1",
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
      const res = await fetch(`${BOT_API_URL}/api/v1/holders?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          {
            ok: true,
            data,
            protocol: "magpie-holders-v1",
            timestamp: new Date().toISOString(),
          },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/holders] bot fetch failed:", (err as Error).message);
    }
  }

  return NextResponse.json(zeroState(wallet), { headers: HEADERS });
}
