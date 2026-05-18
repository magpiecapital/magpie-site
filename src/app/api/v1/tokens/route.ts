import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

/* ─── In-memory cache (60s TTL) ─── */
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

const HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
  "X-Powered-By": "Magpie Protocol",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

export async function GET(req: Request) {
  const now = Date.now();
  const url = new URL(req.url);
  const fresh = url.searchParams.has("fresh");

  /* Serve from cache unless ?fresh is passed */
  if (!fresh && cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, { headers: HEADERS });
  }

  /* Strategy 1: Direct DB query */
  try {
    const { rows } = await query(
      `SELECT mint, symbol, name, decimals, category, image_url
       FROM supported_mints
       WHERE enabled = TRUE
       ORDER BY created_at ASC`,
    );

    if (rows.length > 0) {
      const response = {
        ok: true,
        count: rows.length,
        tokens: rows.map((t: { mint: string; symbol: string; name: string; decimals: number; category: string; image_url: string | null }) => ({
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          category: t.category || "memecoin",
          image: t.image_url || null,
        })),
        source: "database",
        timestamp: new Date().toISOString(),
      };

      cachedData = response;
      cacheTimestamp = now;
      return NextResponse.json(response, { headers: HEADERS });
    }
  } catch (err) {
    console.error("[api/tokens] DB error:", (err as Error).message);
  }

  /* Strategy 2: Fetch from bot API (Railway internal network can reach DB) */
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/tokens`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.tokens?.length > 0) {
          const response = {
            ok: true,
            count: data.tokens.length,
            tokens: data.tokens,
            source: "bot_api",
            timestamp: new Date().toISOString(),
          };
          cachedData = response;
          cacheTimestamp = now;
          return NextResponse.json(response, { headers: HEADERS });
        }
      }
    } catch (err) {
      console.error("[api/tokens] Bot API error:", (err as Error).message);
    }
  }

  /* Strategy 3: Hardcoded registry (last resort) */
  const response = {
    ok: true,
    count: TOKEN_REGISTRY.length,
    tokens: TOKEN_REGISTRY.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      category: t.category || "memecoin",
      image: t.image || null,
    })),
    source: "registry_fallback",
    timestamp: new Date().toISOString(),
  };

  cachedData = response;
  cacheTimestamp = now;
  return NextResponse.json(response, { headers: HEADERS });
}
