/**
 * GET /api/v1/supply/circulating
 *
 * Plain-text number — REQUIRED format for CoinMarketCap & CoinGecko
 * circulating-supply submission. No JSON, no formatting, no quotes,
 * just the number with the token's decimals already applied.
 *
 * Polled by CMC / CoinGecko backends to compute market cap. Cache 60s.
 */
import { getMagpieSupplyBreakdown } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const { circulating_supply } = await getMagpieSupplyBreakdown();
    return new Response(circulating_supply.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    // 503 — CMC will retry on next poll rather than caching a 0.
    return new Response(`supply lookup failed: ${(err as Error).message}`, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
