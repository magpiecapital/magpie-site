/**
 * GET /api/v1/x402-metrics
 *
 * Same-origin proxy for the bot's public x402 agent-lending metrics
 * (/api/v1/public/x402-metrics) so the /stats page can render them without a
 * cross-origin fetch. Public, cached 60s.
 */
import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  const bot =
    process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
  try {
    const r = await fetch(`${bot}/api/v1/public/x402-metrics`, { next: { revalidate: 60 } });
    if (!r.ok) return NextResponse.json({ error: "upstream", status: r.status }, { status: 502 });
    const data = await r.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
