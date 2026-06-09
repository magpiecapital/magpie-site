/**
 * GET /api/v1/supply/total
 *
 * Plain-text number. CMC / CoinGecko poll this to get max-supply /
 * total-supply for FDV calculations.
 */
import { getMagpieSupplyBreakdown } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const { total_supply } = await getMagpieSupplyBreakdown();
    return new Response(total_supply.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`supply lookup failed: ${(err as Error).message}`, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
