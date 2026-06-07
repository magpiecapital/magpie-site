/**
 * GET /api/v1/holders/pool
 *
 * Returns the current $MAGPIE holder reward pool size — lamports
 * accrued since the last distribution. Distributions fire on a
 * randomized 5–10 day window; the exact timing is operator-private
 * to prevent mercenary holders from timing the snapshot.
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "";
const HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
};

function fallback() {
  return {
    ok: true,
    data: {
      pool_lamports: "0",
      pool_sol: 0,
      reward_bps: 1000,
      reward_pct: 10,
      message: "Bot API unreachable",
    },
    protocol: "magpie-holders-v1",
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/holders/pool`, {
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
      console.error("[api/holders/pool] bot fetch failed:", (err as Error).message);
    }
  }
  return NextResponse.json(fallback(), { headers: HEADERS });
}
