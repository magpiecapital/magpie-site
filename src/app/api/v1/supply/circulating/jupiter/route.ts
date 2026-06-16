/**
 * GET /api/v1/supply/circulating/jupiter
 *
 * JSON shape — REQUIRED by Jupiter's verified-token application:
 *   { "circulatingSupply": number }
 *
 * Wraps the same getMagpieSupplyBreakdown helper that powers the
 * CMC / CoinGecko plain-text endpoint at /api/v1/supply/circulating
 * so both consumers always see the same value. 60s cache like the
 * sibling endpoint.
 */
import { getMagpieSupplyBreakdown } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const { circulating_supply } = await getMagpieSupplyBreakdown();
    // Jupiter expects the supply already adjusted for decimals (i.e.
    // the human-readable number, not raw u64). getMagpieSupplyBreakdown
    // returns it that way per the sibling endpoint's contract.
    return Response.json(
      { circulatingSupply: circulating_supply },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    return Response.json(
      { error: `supply lookup failed: ${(err as Error).message}` },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
