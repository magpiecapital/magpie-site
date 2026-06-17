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
 *
 * SECURITY (hardened 2026-06-17 PM after audit S2):
 *   - Origin-locked CORS (only magpie.capital + Vercel previews can call).
 *     Wildcard CORS turned this into a free Helius bill-pump for any origin.
 *   - Per-IP rate limit (60/min) — bounds spend even if origin check is
 *     bypassed via a server-side relay.
 *   - JSON-RPC method allowlist — Phantom only needs ~15 methods. Reject
 *     `getProgramAccounts` and other expensive scan calls outright.
 *   - 16KB request body cap.
 */
const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const runtime = "edge";

// Allowed RPC methods. Phantom and our dashboard's known usage is small.
// `sendTransaction` is the only state-mutating one. Add new ones here as
// they're identified — fail closed by default.
const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getTokenSupply",
  "getLatestBlockhash",
  "getFeeForMessage",
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getTransaction",
  "getMinimumBalanceForRentExemption",
  "getEpochInfo",
  "getSlot",
  "getBlockHeight",
  "getRecentPrioritizationFees",
  "getVersion",
  "getHealth",
]);

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
// In-edge-instance rate counter. Vercel edge spawns many instances, so this
// is per-instance — a generous overall cap, but still bounds any single
// attacker IP. Defense-in-depth alongside Helius's own limits.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function allowOriginHeader(origin: string | null): string {
  if (!origin) return "https://magpie.capital";
  // Production
  if (origin === "https://magpie.capital" || origin === "https://www.magpie.capital") {
    return origin;
  }
  // Vercel preview deployments (magpie-site-<hash>-magpie-capital.vercel.app)
  if (/^https:\/\/magpie-site-[a-z0-9-]+-magpie-capital\.vercel\.app$/.test(origin)) {
    return origin;
  }
  // Local dev
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:[0-9]+)?$/.test(origin)) {
    return origin;
  }
  return "https://magpie.capital";
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": allowOriginHeader(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, solana-client",
    "Vary": "Origin",
  };
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Periodic eviction so the map can't grow forever (audit finding API#6).
    if (ipBuckets.size > 5000) {
      for (const [k, v] of ipBuckets) if (v.resetAt < now) ipBuckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count++;
  return true;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = { "Content-Type": "application/json", ...corsHeaders(origin) };

  // Rate limit FIRST so an attacker can't bypass via large bodies.
  const ip = clientIp(req);
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers });
  }
  if (body.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Body too large" }), { status: 413, headers });
  }

  // Method allowlist check. Body may be a single call or an array of calls.
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  for (const c of calls) {
    const method = (c as { method?: unknown })?.method;
    if (typeof method !== "string" || !ALLOWED_METHODS.has(method)) {
      return new Response(
        JSON.stringify({ error: "Method not allowed", method: typeof method === "string" ? method : null }),
        { status: 403, headers },
      );
    }
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
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream RPC failed", detail: (err as Error).message }),
      { status: 502, headers },
    );
  }
}

// GET probe for wallet adapters.
export async function GET(req: Request) {
  return new Response(
    JSON.stringify({ ok: true, service: "magpie-rpc-proxy" }),
    { headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin")) } },
  );
}
