/**
 * /api/collateral — same-origin proxy for Magpie's collateral catalog.
 *
 * The x402 service (x402.magpie.capital) is a different origin than the site, so
 * a browser fetch to it is blocked by CORS ("Failed to fetch"). This route
 * fetches the catalog server-side (no CORS) and serves it same-origin, exactly
 * like /api/rpc does for the RPC. The borrowable-holdings helper hits this.
 */
const UPSTREAM =
  (process.env.X402_BASE_URL || "https://x402.magpie.capital") +
  "/api/v1/collateral/eligible";

export const revalidate = 60; // catalog changes rarely; cache 60s

export async function GET() {
  try {
    const r = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!r.ok) {
      return Response.json({ error: `collateral upstream ${r.status}`, tokens: [] }, { status: 502 });
    }
    const data = await r.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message, tokens: [] }, { status: 502 });
  }
}
