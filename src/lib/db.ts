import pg from "pg";
import { TOKEN_REGISTRY } from "./token-registry";

function createPool(url: string) {
  if (!url) return null;

  try {
    const u = new URL(url);
    return new pg.Pool({
      host: u.hostname,
      port: parseInt(u.port) || 5432,
      database: u.pathname.slice(1),
      user: u.username,
      password: decodeURIComponent(u.password),
      max: 3,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8_000,
    });
  } catch {
    return new pg.Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
}

/* Primary: Railway Postgres. Secondary: Neon (add DATABASE_URL_SECONDARY). */
const primaryPool = createPool(process.env.DATABASE_URL || "");
const secondaryPool = createPool(process.env.DATABASE_URL_SECONDARY || "");

/**
 * Query with automatic failover — tries primary DB first, falls back to
 * secondary (Neon) on connection errors. Survives full Railway outages.
 */
export async function query(text: string, params?: unknown[]) {
  if (primaryPool) {
    try {
      return await primaryPool.query(text, params);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const isConnErr =
        code === "ECONNRESET" || code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" || code === "57P01";
      if (!isConnErr || !secondaryPool) throw err;
      console.warn("[db] Primary DB failed, failing over to secondary:", code);
    }
  }
  if (secondaryPool) {
    return secondaryPool.query(text, params);
  }
  throw new Error("No database connection available");
}

/* ─── Token stats helper (used by landing page, whitepaper, etc.) ─── */

interface TokenStats {
  count: number;
  memeCount: number;
  stockCount: number;
}

let statsCache: { data: TokenStats; ts: number } | null = null;
const STATS_TTL = 60_000;

export async function getTokenStats(): Promise<TokenStats> {
  const now = Date.now();
  if (statsCache && now - statsCache.ts < STATS_TTL) return statsCache.data;

  // Primary: bot API. Always-on (Railway Hobby), authoritative source.
  // Don't hit the DB directly — Neon free tier auto-suspends and times out
  // on cold reads, which used to silently flip the site into fallback mode.
  const botUrl = process.env.BOT_API_URL;
  if (botUrl) {
    try {
      const res = await fetch(`${botUrl}/api/v1/tokens`, {
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.tokens?.length > 0) {
          const tokens = d.tokens as { category?: string }[];
          const data: TokenStats = {
            count: tokens.length,
            memeCount: tokens.filter((t) => t.category === "memecoin" || !t.category).length,
            stockCount: tokens.filter((t) => t.category === "stock").length,
          };
          statsCache = { data, ts: now };
          return data;
        }
      }
    } catch { /* fall through */ }
  }

  // Secondary: direct DB query. Only reached if the bot API is unreachable.
  try {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE category = 'memecoin' OR category IS NULL)::int AS meme_count,
         COUNT(*) FILTER (WHERE category = 'stock')::int AS stock_count
       FROM supported_mints WHERE enabled = TRUE`,
    );
    const data: TokenStats = {
      count: rows[0].count,
      memeCount: rows[0].meme_count,
      stockCount: rows[0].stock_count,
    };
    statsCache = { data, ts: now };
    return data;
  } catch { /* fall through */ }

  // Serve stale cache before falling to registry — even minutes-old data
  // beats showing a stale baked-in number.
  if (statsCache) return statsCache.data;

  // Last resort: derive from TOKEN_REGISTRY. This file is kept in periodic
  // sync with the bot DB so the fallback never goes too far out of date.
  return {
    count: TOKEN_REGISTRY.length,
    memeCount: TOKEN_REGISTRY.filter((t) => t.category === "memecoin").length,
    stockCount: TOKEN_REGISTRY.filter((t) => t.category === "stock").length,
  };
}
