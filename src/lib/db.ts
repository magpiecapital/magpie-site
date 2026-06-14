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

/* ─────────────────────── POOL OVERVIEW (server-side) ─────────────────────── */

export interface PoolOverview {
  tvl_sol: number;
  outstanding_sol: number;
  utilization: number;
  total_loans_issued: number;
  total_liquidations: number;
  loans_repaid: number;
  active_loans: number;
  lifetime_fees_sol: number;
  fees_24h_sol: number;
  paused: boolean;
  recent_loans: Array<{
    symbol: string | null;
    status: string;
    loan_amount_lamports: string;
    fee_lamports: string;
    timestamp: string;
    event: string;
  }>;
}

let poolCache: { data: PoolOverview; ts: number } | null = null;
const POOL_TTL = 30_000;

/**
 * Headline protocol stats for the home page — TVL, loans issued, liquidations,
 * 24h fees, etc. Pulled from the bot's /api/v1/pool/stats (live on-chain data).
 * Cached 30s. Falls back to a neutral zero-state if the bot is unreachable.
 */
export async function getPoolOverview(): Promise<PoolOverview> {
  const now = Date.now();
  if (poolCache && now - poolCache.ts < POOL_TTL) return poolCache.data;

  const botUrl = process.env.BOT_API_URL;
  if (botUrl) {
    try {
      const res = await fetch(`${botUrl}/api/v1/pool/stats`, {
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (res.ok) {
        const d = await res.json();
        const p = d?.pool ?? {};
        const f = d?.fees ?? {};
        const data: PoolOverview = {
          tvl_sol: Number(p.total_deposits_sol ?? 0),
          outstanding_sol: Number(p.total_borrowed_sol ?? 0),
          utilization: Number(p.utilization ?? 0),
          total_loans_issued: Number(p.total_loans_issued ?? 0),
          total_liquidations: Number(p.total_liquidations ?? 0),
          loans_repaid: 0,
          active_loans: 0,
          lifetime_fees_sol: Number(p.total_fees_earned_sol ?? 0),
          fees_24h_sol: Number(f.last_24h_lamports ?? 0) / 1e9,
          paused: !!p.paused,
          recent_loans: Array.isArray(d?.recent_loans) ? d.recent_loans.slice(0, 6) : [],
        };
        // Backfill repaid+active from a quick DB count (the public stats
        // endpoint doesn't break these out yet)
        try {
          const { rows } = await query(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'active')::int     AS active,
               COUNT(*) FILTER (WHERE status = 'repaid')::int     AS repaid
             FROM loans`,
          );
          data.active_loans = rows[0]?.active ?? 0;
          data.loans_repaid = rows[0]?.repaid ?? 0;
        } catch { /* leave at 0 */ }

        poolCache = { data, ts: now };
        return data;
      }
    } catch { /* fall through */ }
  }

  if (poolCache) return poolCache.data;
  return {
    tvl_sol: 0,
    outstanding_sol: 0,
    utilization: 0,
    total_loans_issued: 0,
    total_liquidations: 0,
    loans_repaid: 0,
    active_loans: 0,
    lifetime_fees_sol: 0,
    fees_24h_sol: 0,
    paused: false,
    recent_loans: [],
  };
}

/* ─── Loan tier ladders (memecoin + RWA categories) ───────────────────
 *
 * Pulls from the bot's public /api/v1/loan-tiers endpoint so the site
 * always shows the same numbers the bot quotes. The fallback constants
 * mirror current DB state so a brief bot outage doesn't blank the
 * marketplace page.
 *
 * When the operator tunes rwa_loan_tiers (or MEMECOIN_TIERS) in the
 * bot, this picks the change up on the next 60s revalidation cycle —
 * no site redeploy needed. That's the single-source-of-truth pattern
 * called out in [[feedback_single_source_of_truth]] and the lesson
 * from [[feedback_ship_marketing_in_sync]].
 */

export interface LoanTier {
  option: number;
  ltv_pct: number;
  duration_days: number;
  fee_bps: number;
  label: string;
}

export type LoanTierCategory = "memecoin" | "stock" | "etf" | "metal";

const MEMECOIN_FALLBACK: LoanTier[] = [
  { option: 0, ltv_pct: 30, duration_days: 2, fee_bps: 300, label: "Express" },
  { option: 1, ltv_pct: 25, duration_days: 3, fee_bps: 200, label: "Quick" },
  { option: 2, ltv_pct: 20, duration_days: 7, fee_bps: 150, label: "Standard" },
];

// 2026-06-13: realigned to V2 program's actual on-chain LTV ladder.
// V2 hardcodes 30/25/20% LTV at options 0/1/2 — same as V1. The prior
// 50/60/70% fallback was aspirational and led to dashboard-vs-Phantom
// mismatches (e.g. site quoted 1.83 SOL, Phantom prompted 0.536 SOL).
// Truly higher RWA LTVs require a V3 program deployment. See bot
// migration 056 + commit history for forensics.
const RWA_FALLBACK: LoanTier[] = [
  { option: 0, ltv_pct: 30, duration_days: 2, fee_bps: 300, label: "RWA Express" },
  { option: 1, ltv_pct: 25, duration_days: 3, fee_bps: 200, label: "RWA Quick" },
  { option: 2, ltv_pct: 20, duration_days: 7, fee_bps: 150, label: "RWA Standard" },
];

function fallbackForCategory(category: LoanTierCategory): LoanTier[] {
  return category === "memecoin" ? MEMECOIN_FALLBACK : RWA_FALLBACK;
}

const tierCache = new Map<LoanTierCategory, { data: LoanTier[]; ts: number }>();
const TIERS_TTL = 60_000;

export async function getLoanTiers(category: LoanTierCategory): Promise<LoanTier[]> {
  const now = Date.now();
  const cached = tierCache.get(category);
  if (cached && now - cached.ts < TIERS_TTL) return cached.data;

  const botUrl = process.env.BOT_API_URL;
  if (botUrl) {
    try {
      const res = await fetch(`${botUrl}/api/v1/loan-tiers?category=${category}`, {
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as { tiers?: LoanTier[] };
        if (Array.isArray(d?.tiers) && d.tiers.length > 0) {
          tierCache.set(category, { data: d.tiers, ts: now });
          return d.tiers;
        }
      }
    } catch { /* fall through to constants */ }
  }

  const data = fallbackForCategory(category);
  tierCache.set(category, { data, ts: now });
  return data;
}

