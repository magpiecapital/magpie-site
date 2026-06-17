/**
 * GET /api/v1/admin/lifetime-stats?wallet=<creator>
 *
 * Proxies to the bot's admin lifetime-stats endpoint. The bot enforces
 * the wallet === LENDER_PUBKEY gate and serves a 1-hour-cached snapshot
 * of pool / loans / fees / referrals / $MAGPIE holder rewards / LP
 * loyalty / users so the admin dashboard can render the full lifetime
 * picture without computing anything itself.
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "Missing ?wallet" }, { status: 400 });
  }
  if (!BOT_API_URL) {
    return NextResponse.json({ ok: false, error: "BOT_API_URL not configured" }, { status: 500 });
  }
  try {
    const res = await fetch(`${BOT_API_URL}/api/v1/admin/lifetime-stats?wallet=${encodeURIComponent(wallet)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
