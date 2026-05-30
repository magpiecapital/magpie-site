/**
 * GET /api/v1/pool/stats — public pool stats for LP-side UI.
 *
 * Returns pool state, fees by period (24h/7d/30d/lifetime), and the last
 * few loan events so the /earn page can compute APR estimates and show
 * a live yield-activity feed. Server-side proxy to the bot endpoint.
 */
import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "";

export async function GET() {
  if (!BOT_API_URL) {
    return NextResponse.json({ ok: false, error: "BOT_API_URL not configured" }, { status: 500 });
  }
  try {
    const res = await fetch(`${BOT_API_URL}/api/v1/pool/stats`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `bot ${res.status}` }, { status: 502 });
    }
    const body = await res.json();
    return NextResponse.json(
      { ok: true, ...body },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
