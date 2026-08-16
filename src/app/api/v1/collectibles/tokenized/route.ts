import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Live tokenized-collectible counts per catalog slug, read directly from the
 * inventory table the bot's DAS indexer maintains (12h sweeps). Direct DB —
 * same pattern as /api/v1/tokens — because the bot host isn't reachable from
 * Vercel. Edge-cached 5 min, stale on error.
 */
const HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400",
  "X-Powered-By": "Magpie Protocol",
};

let cache: { at: number; bySlug: Record<string, unknown[]> } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const { rows } = await query(
        `SELECT catalog_slug, platform, COUNT(*)::int AS count, MAX(last_seen_at) AS last_seen
           FROM collectible_tokenized_inventory
          WHERE catalog_slug IS NOT NULL
          GROUP BY catalog_slug, platform`,
      );
      const bySlug: Record<string, unknown[]> = {};
      for (const r of rows) {
        (bySlug[r.catalog_slug] ??= []).push({
          platform: r.platform,
          count: r.count,
          last_seen: r.last_seen,
        });
      }
      cache = { at: Date.now(), bySlug };
    }
    if (slug) return NextResponse.json({ ok: true, slug, platforms: cache.bySlug[slug] ?? [] }, { headers: HEADERS });
    return NextResponse.json({ ok: true, inventory: cache.bySlug }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: HEADERS });
  }
}
