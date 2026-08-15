import { NextResponse } from "next/server";

/**
 * Proxy to the bot's tokenized-collectible inventory counts (fed by the
 * on-chain DAS indexer). Cached at the edge; serves stale on error so a
 * bot restart never blanks the asset pages' live panels.
 */
const BOT_API_URL = process.env.BOT_API_URL ?? "";

const HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400",
  "X-Powered-By": "Magpie Protocol",
};

export async function GET(req: Request) {
  if (!BOT_API_URL) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: HEADERS });
  }
  const slug = new URL(req.url).searchParams.get("slug");
  try {
    const upstream = await fetch(
      `${BOT_API_URL}/api/v1/collectibles/tokenized${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 300 } },
    );
    if (!upstream.ok) {
      return NextResponse.json({ ok: false, error: "upstream" }, { status: 502, headers: HEADERS });
    }
    return NextResponse.json(await upstream.json(), { headers: HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "timeout" }, { status: 504, headers: HEADERS });
  }
}
