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

// Backup RPCs for 429 / 5xx failover. The proxy tries primary first,
// falls through to each backup in order on rate-limit or server error.
// Public mainnet-beta is slow but always-on — the last-resort fallback
// for when both Helius and a paid backup are throttled. Operator can add
// a second paid provider (Triton, QuickNode) via RPC_BACKUP_URLS env
// (comma-separated). Operator-mandated 2026-06-19 PM after V4 TSLAx
// borrow failed with a chain of /api/rpc 429s.
const BACKUP_RPC_URLS: string[] = (process.env.RPC_BACKUP_URLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (BACKUP_RPC_URLS.length === 0) {
  // Always include public mainnet as last-resort fallback.
  BACKUP_RPC_URLS.push("https://api.mainnet-beta.solana.com");
}
const ALL_RPC_URLS = [HELIUS_RPC_URL, ...BACKUP_RPC_URLS.filter((u) => u !== HELIUS_RPC_URL)];

// Retry-with-failover policy for the proxy.
// 1) Try primary. On 429 / 5xx, wait + retry primary up to MAX_PRIMARY_RETRIES.
// 2) If primary still failing, fall through to each backup in order.
// 3) Only the FINAL upstream status is returned to the browser.
const MAX_PRIMARY_RETRIES = 2; // 3 total attempts on primary
const PRIMARY_RETRY_DELAYS_MS = [200, 500];

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

  // Try primary with retries on 429/5xx; fall through to backups.
  // Operator-mandated 2026-06-19 PM after TSLAx V4 borrow hit a chain of
  // /api/rpc 429s with no retry/backup at the proxy layer.
  const attemptUpstream = async (url: string, _retryIdx: number): Promise<Response> => {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  };
  const isRetryable = (status: number) => status === 429 || (status >= 500 && status < 600);

  let lastUpstreamRes: Response | null = null;
  let lastUpstreamText = "";
  let lastErr: unknown = null;

  outer: for (let urlIdx = 0; urlIdx < ALL_RPC_URLS.length; urlIdx++) {
    const url = ALL_RPC_URLS[urlIdx];
    const maxAttempts = urlIdx === 0 ? MAX_PRIMARY_RETRIES + 1 : 1; // Primary retries; backups single-shot
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = PRIMARY_RETRY_DELAYS_MS[attempt - 1] || 500;
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const res = await attemptUpstream(url, attempt);
        const text = await res.text();
        lastUpstreamRes = res;
        lastUpstreamText = text;
        if (!isRetryable(res.status)) {
          // Success or non-retryable error — return it
          return new Response(text, {
            status: res.status,
            headers: {
              "Content-Type": res.headers.get("Content-Type") || "application/json",
              ...corsHeaders(origin),
            },
          });
        }
        // Retryable; keep going
      } catch (err) {
        lastErr = err;
        // Network-level failure on this URL; jump to next URL
        break;
      }
    }
    // Exhausted attempts for this URL; try the next (continue outer)
    continue outer;
  }

  // All URLs exhausted — return the last upstream response if any, else 502.
  if (lastUpstreamRes) {
    return new Response(lastUpstreamText, {
      status: lastUpstreamRes.status,
      headers: {
        "Content-Type": lastUpstreamRes.headers.get("Content-Type") || "application/json",
        ...corsHeaders(origin),
      },
    });
  }
  return new Response(
    JSON.stringify({ error: "Upstream RPC failed across all endpoints", detail: (lastErr as Error)?.message || "unknown" }),
    { status: 502, headers },
  );
}

// GET probe for wallet adapters.
export async function GET(req: Request) {
  return new Response(
    JSON.stringify({ ok: true, service: "magpie-rpc-proxy" }),
    { headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("origin")) } },
  );
}
