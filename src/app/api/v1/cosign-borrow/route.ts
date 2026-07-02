/**
 * /api/v1/cosign-borrow — proxy + field adapter to the bot's lender-cosign.
 *
 * The x402 SDK signs the borrow tx, then POSTs { signed_tx_b64 } to
 * `${siteUrl}/api/v1/cosign-borrow` (siteUrl defaults to magpie.capital). The
 * lender-cosign step lives on the bot, which reads { partialSignedTxBase64 }.
 * Two halves built separately + never integration-tested (the auth bug blocked
 * this path), so they disagree on the field name. This proxy forwards to the
 * bot (same pattern as /api/rpc, /api/collateral) AND adapts the field name so
 * the SDK's borrow completes.
 */
const BOT =
  process.env.BOT_API_URL ||
  process.env.NEXT_PUBLIC_BOT_API_URL ||
  "https://magpie-bot-production.up.railway.app";

export async function POST(req: Request) {
  let raw: Record<string, unknown> = {};
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    /* leave raw empty → bot returns its own validation error */
  }
  // SDK sends signed_tx_b64; the bot reads partialSignedTxBase64. Accept any of
  // the known names, forward the bot's expected one. Pass everything else through.
  const tx = raw.partialSignedTxBase64 ?? raw.signed_tx_b64 ?? raw.partial_signed_tx_b64;
  const body = JSON.stringify({ ...raw, partialSignedTxBase64: tx });

  try {
    const res = await fetch(`${BOT}/api/v1/cosign-borrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // >= the bot's JIT TWAP-warm budget (V4_TWAP_WARM_MAX_MS=90s) + margin, so
      // a cold-feed V4 borrow through this proxy receives the bot's real
      // oracle_warming JSON (with an accurate retry_after) instead of a premature
      // 502 surfaced as a generic "network hiccup" for what is a clean, retryable
      // "oracle warming" state.
      signal: AbortSignal.timeout(95_000),
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
