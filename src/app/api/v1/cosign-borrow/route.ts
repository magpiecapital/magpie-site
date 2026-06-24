/**
 * /api/v1/cosign-borrow — proxy to the bot's lender-cosign endpoint.
 *
 * The x402 SDK signs the borrow tx, then POSTs { signed_tx_b64 } to
 * `${siteUrl}/api/v1/cosign-borrow` (siteUrl defaults to magpie.capital). The
 * cosign step (where Magpie's lender authority adds its signature + submits)
 * lives on the bot — so the site must forward it here, the same way /api/rpc
 * and /api/collateral proxy their upstreams. Without this route the SDK got the
 * site's HTML page back and the whole agent borrow failed at the final hop.
 */
const BOT =
  process.env.BOT_API_URL ||
  process.env.NEXT_PUBLIC_BOT_API_URL ||
  "https://magpie-bot-production.up.railway.app";

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${BOT}/api/v1/cosign-borrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return Response.json(
      { error: "cosign_upstream_unreachable", detail: (e as Error).message?.slice(0, 200) },
      { status: 502 },
    );
  }
}
