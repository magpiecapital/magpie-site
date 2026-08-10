/**
 * Per-IP rate limiting for routes that spend money on someone else's behalf.
 *
 * WHY THIS EXISTS. Audit S2 (2026-06-17) hardened `/api/rpc` after finding that
 * wildcard CORS had turned it into "a free Helius bill-pump for any origin", and
 * added a per-IP limit so that spend stayed bounded "even if the origin check is
 * bypassed via a server-side relay".
 *
 * That reasoning was never extended to the routes that call RPC *directly*,
 * bypassing the hardened proxy entirely:
 *
 *   /api/v1/lp/build-withdraw    ~5 RPC calls per request
 *   /api/v1/lp/build-deposit     ~2
 *   /api/v1/lp/build-liquidate   ~2
 *   /api/v1/lp/position/[wallet] ~4  (sweeps V1–V4)
 *   /api/submit-token            RPC + DB
 *
 * `fetchAllDepositorPositions` loops every pool version, and the depositor
 * pubkey is caller-supplied — so an attacker varies it per request and defeats
 * any caching. Unauthenticated, unthrottled, and billed to us.
 *
 * DESIGN CONSTRAINTS, in priority order:
 *
 *  1. NEVER BLOCK A REAL USER. The protocol's first mandate is that every loan
 *     and every repayment executes. A limiter that locks out a borrower mid-flow
 *     is worse than the abuse it prevents — so limits are generous, and any
 *     internal error FAILS OPEN (allows the request).
 *  2. Same shape as the accepted `/api/rpc` limiter: an in-memory per-instance
 *     counter. Vercel spawns many instances, so this is a per-instance cap
 *     rather than a global one — deliberately, because the alternative (a DB
 *     round-trip per request) would add cost to the very path we are protecting
 *     from cost. It bounds a single attacker IP, which is the realistic case.
 *  3. No new dependency, no new infrastructure.
 *
 * The complete fix is a platform-level rule (Vercel Firewall), which costs no
 * compute and cannot be forgotten when a new route ships. This is the in-code
 * layer of that, not a replacement for it.
 */

type Bucket = { count: number; resetAt: number };

/** Per-instance counters. Keyed `${scope}:${ip}`. */
const buckets = new Map<string, Bucket>();

/** Hard cap on tracked keys, so the map itself can't become the memory leak. */
const MAX_KEYS = 10_000;

/**
 * Best-effort client IP. Vercel sets x-forwarded-for; the left-most entry is the
 * original client. Absent header → null, and a null IP is never rate limited
 * (fail open) because we cannot attribute the request.
 */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Consume one unit against `scope` for this request's IP.
 *
 * @returns `{ limited: false }` to proceed, or `{ limited: true, retryAfter }`.
 *          ALWAYS returns `{ limited: false }` if anything goes wrong.
 */
export function rateLimit(
  req: Request,
  scope: string,
  max: number,
  windowMs = 60_000,
): { limited: boolean; retryAfter: number } {
  try {
    const ip = clientIp(req);
    if (!ip) return { limited: false, retryAfter: 0 }; // unattributable → allow

    const now = Date.now();
    const key = `${scope}:${ip}`;
    const b = buckets.get(key);

    if (!b || now >= b.resetAt) {
      // Opportunistic sweep of expired keys; only when the map is getting big,
      // so the common path stays O(1).
      if (buckets.size >= MAX_KEYS) {
        for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
        if (buckets.size >= MAX_KEYS) buckets.clear(); // pathological → reset
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { limited: false, retryAfter: 0 };
    }

    b.count++;
    if (b.count > max) {
      return { limited: true, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    }
    return { limited: false, retryAfter: 0 };
  } catch {
    return { limited: false, retryAfter: 0 }; // fail open, always
  }
}

/** The 429 body + Retry-After header, so every route answers identically. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      detail: "Too many requests from this IP. Wait a moment and try again.",
      retry_after_seconds: retryAfter,
    }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
    },
  );
}
