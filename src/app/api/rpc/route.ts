/**
 * Server-side Solana RPC proxy.
 *
 * The dashboard's wallet adapter points at `/api/rpc` (same-origin); this
 * route forwards the JSON-RPC body to Helius server-side. Result:
 *   - Helius API key never reaches the browser (no NEXT_PUBLIC_* needed).
 *   - getBalance / getTokenAccountsByOwner / sendTransaction all flow
 *     through Helius (no public-RPC rate limits).
 *   - Vercel's edge runtime keeps latency low.
 *
 * Config: set HELIUS_RPC_URL in Vercel env (server-side only — NOT public).
 */
const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const runtime = "edge";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, solana-client",
} as const;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream RPC failed", detail: (err as Error).message }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }
}

// Allow GET so wallet adapters that probe the endpoint don't blow up.
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, service: "magpie-rpc-proxy" }),
    { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
  );
}
