import pg from "pg";

function createPool() {
  const url = process.env.DATABASE_URL || "";
  if (!url) return new pg.Pool();

  // Parse URL to use explicit params (more reliable with proxies)
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

const pool = createPool();

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
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
  } catch {
    // Fallback: return last known or generic
    if (statsCache) return statsCache.data;
    return { count: 90, memeCount: 83, stockCount: 7 };
  }
}
