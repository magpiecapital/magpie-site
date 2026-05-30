/**
 * GET /api/v1/wallet/balance?wallet=<address>
 *
 * Server-side proxy to the bot's wallet balance endpoint. Returns SOL +
 * token balances (both legacy SPL and Token-2022) for a wallet by hitting
 * the bot's Helius-backed RPC instead of relying on the browser's wallet
 * adapter (which has been unreliable).
 */
import { NextResponse } from "next/server";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  if (!BOT_API_URL) {
    return NextResponse.json(
      { ok: false, error: "BOT_API_URL not configured on the site" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${BOT_API_URL}/api/v1/wallet/balance?wallet=${wallet}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ok: true, ...data }, { headers: HEADERS });
    }
    return NextResponse.json(
      { ok: false, error: `Bot API returned ${res.status}` },
      { status: 502 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
