/**
 * GET /api/v1/tokens/<mint>
 *
 * Public token scorecard. Returns the protocol's view of a single
 * approved token: tier classification, cap, remaining capacity, risk
 * metrics from supported_mints, and current open notional. Backs the
 * per-token page at /tokens/<mint> — letting anyone audit how the
 * protocol classifies any token before they deposit collateral.
 *
 * Read-only. Cache 30s.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
  "X-Powered-By": "Magpie Protocol",
  "Access-Control-Allow-Origin": "*",
};

// Keep these in lockstep with bot/src/services/anti-exploit.js and
// site/src/app/api/v1/eligible-collateral/route.ts.
const FALLBACK_CAP_SOL = 10;
const TIERS = [
  { label: "bluechip", capSol: 30, minLiq: 1_000_000, minHolders: 10_000, minAgeH: 1440, maxTop10: 30, requireLpBurned: true },
  { label: "large",    capSol: 25, minLiq: 400_000,   minHolders: 3_000,  minAgeH: 480,  maxTop10: 40, requireLpBurned: false },
  { label: "mid",      capSol: 15, minLiq: 150_000,   minHolders: 1_000,  minAgeH: 168,  maxTop10: 50, requireLpBurned: false },
];
const MCAP_FALLBACK = [
  { label: "bluechip", capSol: 30, minMcap: 100_000_000 },
  { label: "large",    capSol: 25, minMcap:  30_000_000 },
  { label: "mid",      capSol: 15, minMcap:  10_000_000 },
];

interface MintRow {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  category: string | null;
  image_url: string | null;
  enabled: boolean;
  max_open_lamports: string | null;
  liquidity_usd: number | string | null;
  holder_count: number | null;
  token_age_hours: number | null;
  top10_holder_pct: number | string | null;
  has_mint_authority: boolean | null;
  has_freeze_authority: boolean | null;
  lp_burned: boolean | null;
  market_cap_usd: number | string | null;
  screened_at: Date | string | null;
}

function isValidMint(s: string | null): s is string {
  if (!s) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function computeTier(row: MintRow): {
  tier: string;
  capSol: number;
  reason?: string;
  mcapFallback?: boolean;
} {
  if (row.has_mint_authority === true) {
    return { tier: "small", capSol: FALLBACK_CAP_SOL, reason: "mint authority still held" };
  }
  if (row.has_freeze_authority === true) {
    return { tier: "small", capSol: FALLBACK_CAP_SOL, reason: "freeze authority still held" };
  }
  const liq = Number(row.liquidity_usd || 0);
  const holders = Number(row.holder_count || 0);
  const ageH = Number(row.token_age_hours || 0);
  const top10 = Number(row.top10_holder_pct || 100);
  const lpBurned = row.lp_burned === true;
  const mcap = Number(row.market_cap_usd || 0);
  for (const t of TIERS) {
    if (liq < t.minLiq) continue;
    if (holders < t.minHolders) continue;
    if (ageH < t.minAgeH) continue;
    if (top10 > t.maxTop10) continue;
    if (t.requireLpBurned && !lpBurned) continue;
    return { tier: t.label, capSol: t.capSol };
  }
  if (mcap > 0 && liq >= 50_000) {
    for (const fb of MCAP_FALLBACK) {
      if (mcap >= fb.minMcap) return { tier: fb.label, capSol: fb.capSol, mcapFallback: true };
    }
  }
  return { tier: "small", capSol: FALLBACK_CAP_SOL };
}

export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!isValidMint(mint)) {
    return NextResponse.json({ ok: false, error: "Invalid mint" }, { status: 400, headers: HEADERS });
  }

  const [mintRes, openRes, lifetimeRes] = await Promise.allSettled([
    query(
      `SELECT mint, symbol, name, decimals, category, image_url, enabled,
              max_open_lamports, liquidity_usd, holder_count, token_age_hours,
              top10_holder_pct, has_mint_authority, has_freeze_authority,
              lp_burned, market_cap_usd, screened_at
         FROM supported_mints WHERE mint = $1`,
      [mint],
    ),
    query(
      `SELECT COALESCE(SUM(original_loan_amount_lamports), 0)::text AS open,
              COUNT(*)::text AS count
         FROM loans
        WHERE collateral_mint = $1 AND status = 'active'`,
      [mint],
    ),
    query(
      `SELECT COALESCE(SUM(original_loan_amount_lamports), 0)::text AS lifetime_borrowed,
              COUNT(*)::text AS lifetime_count,
              COUNT(*) FILTER (WHERE status = 'liquidated')::text AS liquidations,
              COUNT(*) FILTER (WHERE status = 'repaid')::text AS repaid
         FROM loans
        WHERE collateral_mint = $1`,
      [mint],
    ),
  ]);

  const mintRow = mintRes.status === "fulfilled" ? (mintRes.value.rows[0] as MintRow | undefined) : null;
  if (!mintRow) {
    return NextResponse.json(
      { ok: false, error: "Token not approved as collateral" },
      { status: 404, headers: HEADERS },
    );
  }

  // Cap resolution: override wins over tier system
  let capSol: number | null;
  let tier: string;
  let tierReason: string | undefined;
  let mcapFallback = false;
  if (mintRow.max_open_lamports !== null && mintRow.max_open_lamports !== undefined) {
    const raw = BigInt(String(mintRow.max_open_lamports));
    if (raw === 0n) { capSol = null; tier = "unlimited"; }
    else { capSol = Number(raw) / 1e9; tier = "operator-pinned"; }
  } else {
    const computed = computeTier(mintRow);
    capSol = computed.capSol;
    tier = computed.tier;
    tierReason = computed.reason;
    mcapFallback = computed.mcapFallback ?? false;
  }

  const openRow = openRes.status === "fulfilled" ? (openRes.value.rows[0] as { open?: string; count?: string } | undefined) : undefined;
  const openLamports = BigInt(openRow?.open ?? "0");
  const openSol = Number(openLamports) / 1e9;
  const activeCount = Number(openRow?.count ?? "0");
  const lifetime = lifetimeRes.status === "fulfilled"
    ? (lifetimeRes.value.rows[0] as { lifetime_borrowed: string; lifetime_count: string; liquidations: string; repaid: string } | undefined) ?? null
    : null;

  return NextResponse.json(
    {
      ok: true,
      token: {
        mint: mintRow.mint,
        symbol: mintRow.symbol,
        name: mintRow.name,
        decimals: mintRow.decimals,
        category: mintRow.category,
        image: mintRow.image_url,
        enabled: mintRow.enabled,
      },
      tier: {
        label: tier,
        capSol,
        usedSol: openSol,
        remainingSol: capSol === null ? null : Math.max(0, capSol - openSol),
        activeLoans: activeCount,
        mcapFallback,
        demotionReason: tierReason ?? null,
      },
      risk_metrics: {
        liquidity_usd: Number(mintRow.liquidity_usd || 0),
        market_cap_usd: Number(mintRow.market_cap_usd || 0),
        holder_count: Number(mintRow.holder_count || 0),
        token_age_hours: Number(mintRow.token_age_hours || 0),
        top10_holder_pct: Number(mintRow.top10_holder_pct || 0),
        has_mint_authority: mintRow.has_mint_authority === true,
        has_freeze_authority: mintRow.has_freeze_authority === true,
        lp_burned: mintRow.lp_burned === true,
        last_screened_at: mintRow.screened_at,
      },
      lifetime: lifetime ? {
        borrowed_sol: Number(lifetime.lifetime_borrowed) / 1e9,
        loan_count: Number(lifetime.lifetime_count),
        repaid: Number(lifetime.repaid),
        liquidations: Number(lifetime.liquidations),
        liquidation_rate: Number(lifetime.lifetime_count) > 0
          ? Number(lifetime.liquidations) / Number(lifetime.lifetime_count)
          : 0,
      } : null,
      generated_at: new Date().toISOString(),
    },
    { headers: HEADERS },
  );
}
