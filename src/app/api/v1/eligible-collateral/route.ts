/**
 * GET /api/v1/eligible-collateral?wallet=<address>
 *
 * Returns the wallet's eligible collateral — the intersection of:
 *   • Tokens the wallet currently holds (from the bot's Helius-backed
 *     /api/v1/wallet/balance endpoint)
 *   • Tokens approved as collateral (supported_mints WHERE enabled=TRUE)
 *
 * Server-side intersection eliminates client-side race conditions and
 * type-mismatch failure modes. Dashboard just renders the array.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

interface BotToken {
  mint: string;
  raw_amount: string;
  decimals: number;
  amount: number;
  symbol?: string;
  name?: string;
  image?: string | null;
  category?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  if (!BOT_API_URL) {
    return NextResponse.json(
      { ok: false, error: "BOT_API_URL not configured" },
      { status: 500 },
    );
  }

  // Fan out the three reads in parallel: wallet balance, approved-token
  // metadata (now including tier-relevant columns), and currently-open
  // notional per mint (so we can show users how much cap is left
  // without forcing them to hit the per-token cap blindly during a
  // borrow attempt).
  const [balanceRes, approvedRes, openByMintRes] = await Promise.allSettled([
    fetch(`${BOT_API_URL}/api/v1/wallet/balance?wallet=${encodeURIComponent(wallet)}`, {
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json()),
    query(
      `SELECT mint, symbol, name, decimals, category, image_url,
              max_open_lamports, liquidity_usd, holder_count, token_age_hours,
              top10_holder_pct, has_mint_authority, has_freeze_authority, lp_burned,
              market_cap_usd
         FROM supported_mints
        WHERE enabled = TRUE`,
    ),
    query(
      `SELECT collateral_mint AS mint,
              COALESCE(SUM(original_loan_amount_lamports), 0)::TEXT AS open_lamports
         FROM loans
        WHERE status = 'active'
        GROUP BY collateral_mint`,
    ),
  ]);

  const balance = balanceRes.status === "fulfilled" ? balanceRes.value : null;
  const approved = approvedRes.status === "fulfilled" ? approvedRes.value.rows : [];
  const openByMintRows = openByMintRes.status === "fulfilled" ? openByMintRes.value.rows : [];
  const openByMint = new Map<string, bigint>(
    (openByMintRows as Array<{ mint: string; open_lamports: string }>).map((r) => [r.mint, BigInt(r.open_lamports || "0")]),
  );
  const heldTokens: BotToken[] = (balance?.tokens ?? []) as BotToken[];

  // Build mint → approved metadata map, then intersect with holdings.
  type ApprovedRow = {
    mint: string; symbol: string; name: string; decimals: number;
    category: string | null; image_url: string | null;
    max_open_lamports: string | null;
    liquidity_usd: number | string | null;
    holder_count: number | null;
    token_age_hours: number | null;
    top10_holder_pct: number | string | null;
    has_mint_authority: boolean | null;
    has_freeze_authority: boolean | null;
    lp_burned: boolean | null;
    market_cap_usd: number | string | null;
  };
  const approvedByMint = new Map<string, ApprovedRow>(
    (approved as ApprovedRow[]).map((row) => [row.mint, row]),
  );

  // Tier table — keep in sync with bagbank-bot/src/services/anti-exploit.js.
  // Mirroring here lets us tell the user up front what cap they're
  // working with, instead of hitting the gate at borrow time. The
  // fallback per-token cap of 10 SOL matches the bot's default.
  const FALLBACK_CAP_SOL = 10;
  const TIERS = [
    { label: "bluechip", capSol: 30, minLiq: 1_000_000, minHolders: 10_000, minAgeH: 1440, maxTop10: 30, requireLpBurned: true },
    { label: "large",    capSol: 25, minLiq: 400_000,   minHolders: 3_000,  minAgeH: 480,  maxTop10: 40, requireLpBurned: false },
    { label: "mid",      capSol: 15, minLiq: 150_000,   minHolders: 1_000,  minAgeH: 168,  maxTop10: 50, requireLpBurned: false },
  ];
  // Mcap fallback — promotes high-mcap tokens whose holder_count or
  // token_age_hours are stale (legacy approvals where the screener
  // didn't populate them). Requires real liquidity ($50k floor) so a
  // thin-pool fake mcap can't game it. Matches bot.
  const MCAP_FALLBACK = [
    { label: "bluechip", capSol: 30, minMcap: 100_000_000 },
    { label: "large",    capSol: 25, minMcap:  30_000_000 },
    { label: "mid",      capSol: 15, minMcap:  10_000_000 },
  ];
  function computeTier(row: ApprovedRow): { tier: string; capSol: number } {
    if (row.has_mint_authority === true) return { tier: "small", capSol: FALLBACK_CAP_SOL };
    if (row.has_freeze_authority === true) return { tier: "small", capSol: FALLBACK_CAP_SOL };
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
        if (mcap >= fb.minMcap) return { tier: fb.label, capSol: fb.capSol };
      }
    }
    return { tier: "small", capSol: FALLBACK_CAP_SOL };
  }

  const eligibleBase = heldTokens
    .filter((t) => approvedByMint.has(t.mint))
    .map((t) => {
      const meta = approvedByMint.get(t.mint)!;
      // Resolve the cap: operator override wins, otherwise tier-based.
      let capSol: number | null;
      let tier: string;
      if (meta.max_open_lamports !== null && meta.max_open_lamports !== undefined) {
        const raw = BigInt(String(meta.max_open_lamports));
        if (raw === 0n) { capSol = null; tier = "unlimited"; }
        else { capSol = Number(raw) / 1e9; tier = "override"; }
      } else {
        const computed = computeTier(meta);
        capSol = computed.capSol;
        tier = computed.tier;
      }
      const openLamports = openByMint.get(t.mint) ?? 0n;
      const openSol = Number(openLamports) / 1e9;
      const remainingSol = capSol === null ? null : Math.max(0, capSol - openSol);
      return {
        mint: t.mint,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        image: meta.image_url || null,
        category: meta.category || "memecoin",
        raw_amount: t.raw_amount,
        amount: t.amount,
        priceUsd: null as number | null,
        // Per-token exposure cap fields — let the dashboard surface
        // tier + remaining capacity so users know up front whether
        // they'll hit the cap before they sign a borrow.
        tier,
        capSol,
        openSol,
        remainingSol,
        // Risk-preview fields, populated from DexScreener below. These
        // let the dashboard show users token fundamentals BEFORE they
        // confirm a borrow — liquidity depth, 24h volume, and 24h
        // price change are the three signals that most cleanly
        // separate "safe to collateralize" from "shallow pool, could
        // liquidate quickly."
        liquidityUsd: null as number | null,
        volume24hUsd: null as number | null,
        priceChange24hPct: null as number | null,
      };
    })
    .sort((a, b) => (b.amount || 0) - (a.amount || 0));

  // Enrich with live USD price from DexScreener — without this, the
  // dashboard's tier cards show "You receive $0.00" because valueUsd
  // can't be computed. DexScreener accepts up to 30 mints per call
  // and returns price + liquidity for each in a single roundtrip.
  if (eligibleBase.length > 0) {
    const mintList = eligibleBase.map((e) => e.mint).join(",");
    try {
      const r = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${mintList}`,
        { signal: AbortSignal.timeout(7_000) },
      );
      if (r.ok) {
        const pairs = (await r.json()) as Array<{
          baseToken?: { address?: string };
          priceUsd?: string;
          priceChange?: { h24?: number };
          volume?: { h24?: number };
          liquidity?: { usd?: number };
        }>;
        // Pick the deepest-liquidity pair per mint (defensive against
        // shallow-pool spoofing the price).
        const bestByMint = new Map<string, {
          price: number;
          liquidity: number;
          volume24h: number;
          priceChange24h: number;
        }>();
        for (const p of Array.isArray(pairs) ? pairs : []) {
          const addr = p?.baseToken?.address;
          const price = parseFloat(p?.priceUsd ?? "0");
          const liq = p?.liquidity?.usd ?? 0;
          if (!addr || !price) continue;
          const existing = bestByMint.get(addr);
          if (!existing || liq > existing.liquidity) {
            bestByMint.set(addr, {
              price,
              liquidity: liq,
              volume24h: p?.volume?.h24 ?? 0,
              priceChange24h: p?.priceChange?.h24 ?? 0,
            });
          }
        }
        for (const e of eligibleBase) {
          const best = bestByMint.get(e.mint);
          if (best && isFinite(best.price) && best.price > 0) {
            e.priceUsd = best.price;
            e.liquidityUsd = best.liquidity || null;
            e.volume24hUsd = best.volume24h || null;
            e.priceChange24hPct = isFinite(best.priceChange24h) ? best.priceChange24h : null;
          }
        }
      }
    } catch {
      // Network blip — return without priceUsd; dashboard will show
      // $0.00 (existing behavior) until next refresh.
    }
  }

  return NextResponse.json(
    {
      ok: true,
      wallet,
      sol: balance?.sol ?? null,
      held_count: heldTokens.length,
      approved_count: approved.length,
      eligible_count: eligibleBase.length,
      eligible: eligibleBase,
    },
    { headers: HEADERS },
  );
}
