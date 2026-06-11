/**
 * Persistent per-IP rate limit using Postgres.
 *
 * Why this exists:
 *   The original /api/fallback/chat used an in-process Map for rate
 *   limiting. Vercel serverless functions are killed between
 *   invocations, so the Map vanished on every cold start. An attacker
 *   rotating IPs across cold starts could rack up Anthropic charges.
 *
 *   This version uses Postgres so state survives cold starts. Same
 *   DB the bot uses; no new infrastructure.
 *
 * Schema (idempotent CREATE in ensureSchema):
 *   pip_fallback_ratelimit (
 *     ip            TEXT PRIMARY KEY,
 *     window_started_at TIMESTAMPTZ NOT NULL,
 *     request_count INT NOT NULL
 *   )
 *
 * Algorithm: fixed-window counter, RPM_LIMIT requests per 60s window.
 *   - On each request, UPSERT the row for this IP.
 *   - If the existing window is < 60s old, increment count.
 *   - If older, reset window + count to 1.
 *   - If count > RPM_LIMIT after increment, return rate-limited.
 *
 * Trade-off vs sliding window: fixed-window allows a brief burst at
 * window-boundary (up to 2x RPM in the worst case across boundaries).
 * Acceptable for a cost-burn defense — Anthropic also rate-limits
 * per key as a second layer. Sliding window is more accurate but
 * needs more storage per IP.
 *
 * Cleanup: best-effort. We don't actively GC old rows — Postgres
 * handles them fine indefinitely. Optional cron sweep could drop
 * rows older than 1h if storage becomes a concern.
 *
 * Failure mode: if the DB is unreachable, we FAIL OPEN and allow
 * the request. The fallback chat is a defense-in-depth feature; a
 * DB outage shouldn't compound with the bot outage to also break
 * Pip. Anthropic's own rate limits cap the worst case.
 */
import { Pool } from "pg";

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 3_000,
    });
  }
  return _pool;
}

let _schemaEnsured = false;
async function ensureRateLimitSchema(): Promise<void> {
  if (_schemaEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pip_fallback_ratelimit (
      ip                TEXT PRIMARY KEY,
      window_started_at TIMESTAMPTZ NOT NULL,
      request_count     INT NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS pip_fallback_ratelimit_window_idx
      ON pip_fallback_ratelimit(window_started_at);
  `);
  _schemaEnsured = true;
}

const RPM_LIMIT = 10;
const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  limit: number;
  retry_after_seconds?: number;
}

/**
 * Check + record a request for this IP. Returns allowed=true if the
 * caller should proceed; allowed=false if they should be 429'd.
 *
 * Single round-trip to Postgres using an UPSERT with a CASE expression
 * that resets the counter when the window has elapsed. RETURNING gives
 * us the post-update count so we can decide the result.
 */
export async function checkAndRecord(ip: string): Promise<RateLimitResult> {
  try {
    await ensureRateLimitSchema();
  } catch {
    // DB unavailable — fail open.
    return { allowed: true, current_count: 0, limit: RPM_LIMIT };
  }
  const pool = getPool();
  try {
    // Single statement that:
    //   - Inserts a fresh window row for this IP if none exists, OR
    //   - If a row exists AND its window is older than WINDOW_MS, resets
    //     window_started_at + count to 1, OR
    //   - Otherwise increments count.
    // The COALESCE/CASE pattern is what gives us atomicity in one
    // round trip without a separate SELECT.
    const { rows } = await pool.query<{ request_count: number; window_started_at: Date }>(
      `INSERT INTO pip_fallback_ratelimit (ip, window_started_at, request_count)
         VALUES ($1, NOW(), 1)
       ON CONFLICT (ip) DO UPDATE
         SET window_started_at = CASE
               WHEN pip_fallback_ratelimit.window_started_at < NOW() - INTERVAL '${WINDOW_MS} milliseconds'
                 THEN NOW()
               ELSE pip_fallback_ratelimit.window_started_at
             END,
             request_count = CASE
               WHEN pip_fallback_ratelimit.window_started_at < NOW() - INTERVAL '${WINDOW_MS} milliseconds'
                 THEN 1
               ELSE pip_fallback_ratelimit.request_count + 1
             END
       RETURNING request_count, window_started_at`,
      [ip],
    );
    const row = rows[0];
    if (!row) {
      // Shouldn't happen with RETURNING but guard.
      return { allowed: true, current_count: 1, limit: RPM_LIMIT };
    }
    const count = row.request_count;
    if (count > RPM_LIMIT) {
      const windowAgeMs = Date.now() - new Date(row.window_started_at).getTime();
      const retryAfterMs = Math.max(0, WINDOW_MS - windowAgeMs);
      return {
        allowed: false,
        current_count: count,
        limit: RPM_LIMIT,
        retry_after_seconds: Math.ceil(retryAfterMs / 1000),
      };
    }
    return { allowed: true, current_count: count, limit: RPM_LIMIT };
  } catch {
    // DB query failed — fail open to not compound outages.
    return { allowed: true, current_count: 0, limit: RPM_LIMIT };
  }
}
