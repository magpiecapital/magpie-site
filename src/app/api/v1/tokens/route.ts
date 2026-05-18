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

export async function GET(req: Request) {
  const now = Date.now();
  const url = new URL(req.url);
  const fresh = url.searchParams.has("fresh");

  /* Serve from cache if fresh (unless ?fresh is passed to bust cache) */
  if (!fresh && cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, { headers: HEADERS });
  }

  /* Try DB first — single source of truth */
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
    console.error("[api/tokens] DB error, falling back to registry:", err);
    console.error("[api/tokens] DATABASE_URL set:", !!process.env.DATABASE_URL, "len:", (process.env.DATABASE_URL||"").length, "DB_SSL:", process.env.DB_SSL);
  }

  /* Fallback: hardcoded registry (DB unreachable or empty) */
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
