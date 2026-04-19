/**
 * GET /api/v1/risk?mint=<address>
 *
 * AI Token Risk Assessment API — returns real-time risk scoring for any
 * supported Solana token across five dimensions.
 */
import { NextResponse } from "next/server";

const DEXSCREENER_API = "https://api.dexscreener.com";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing ?mint=<token_address> parameter",
        docs: {
          description: "Magpie AI Token Risk Assessment API",
          endpoints: {
            "GET /api/v1/risk?mint=<address>": "Get risk profile for a token",
          },
          dimensions: {
            volatility: "Price stability (30% weight)",
            liquidity: "DEX liquidity depth (25% weight)",
            concentration: "Top-holder dominance (20% weight)",
            volume: "Trading consistency (15% weight)",
            rug_pull: "Rug-pull indicators (10% weight)",
          },
          risk_levels: {
            "0-25": "Low risk — +3% LTV bonus",
            "26-50": "Moderate risk — neutral",
            "51-75": "High risk — -5% LTV penalty",
            "76-100": "Critical risk — -10% LTV penalty, possible flag",
          },
        },
      },
      { status: 400 },
    );
  }

  try {
    // Fetch live market data from DexScreener
    const resp = await fetch(`${DEXSCREENER_API}/tokens/v1/solana/${mint}`, {
      next: { revalidate: 60 },
    });
    const pairs = await resp.json();
    const pair = Array.isArray(pairs) ? pairs[0] : null;

    if (!pair) {
      return NextResponse.json(
        { ok: false, error: "Token not found on DexScreener" },
        { status: 404 },
      );
    }

    // Compute risk scores
    const priceChange24h = pair.priceChange?.h24 || 0;
    const priceChange6h = pair.priceChange?.h6 || 0;
    const priceChange1h = pair.priceChange?.h1 || 0;
    const liquidityUsd = pair.liquidity?.usd || 0;
    const marketCap = pair.marketCap || 0;
    const volume24h = pair.volume?.h24 || 0;

    const volatility = scoreVolatility(priceChange24h, priceChange6h, priceChange1h);
    const liquidity = scoreLiquidity(liquidityUsd, marketCap);
    const concentration = 50; // requires on-chain data — default moderate
    const volume = scoreVolume(volume24h, liquidityUsd);
    const rugPull = 50; // requires on-chain data — default moderate

    const riskScore = Math.round(
      volatility * 0.3 + liquidity * 0.25 + concentration * 0.2 + volume * 0.15 + rugPull * 0.1,
    );

    const ltvModifier = riskScore <= 25 ? 3 : riskScore <= 50 ? 0 : riskScore <= 75 ? -5 : -10;
    const maxLtv = riskScore <= 25 ? 35 : riskScore <= 50 ? 30 : riskScore <= 75 ? 25 : 15;
    const flagged = riskScore >= 80;

    return NextResponse.json(
      {
        ok: true,
        data: {
          mint,
          symbol: pair.baseToken?.symbol || "UNKNOWN",
          name: pair.baseToken?.name || "",
          risk_score: riskScore,
          risk_level:
            riskScore <= 25 ? "low" : riskScore <= 50 ? "moderate" : riskScore <= 75 ? "high" : "critical",
          dimensions: { volatility, liquidity, concentration, volume, rug_pull: rugPull },
          market_data: {
            price_usd: Number(pair.priceUsd) || 0,
            price_change_24h: priceChange24h,
            liquidity_usd: liquidityUsd,
            volume_24h: volume24h,
            market_cap: marketCap,
          },
          lending_impact: { ltv_modifier: ltvModifier, max_allowed_ltv: maxLtv },
          flagged,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch market data" },
      { status: 500 },
    );
  }
}

function scoreVolatility(h24: number, h6: number, h1: number): number {
  const weighted = Math.abs(h1) * 0.4 + Math.abs(h6) * 0.35 + Math.abs(h24) * 0.25;
  return Math.min(100, Math.round((weighted / 50) * 100));
}

function scoreLiquidity(liq: number, mcap: number): number {
  if (!liq || liq <= 0) return 95;
  if (!mcap || mcap <= 0) return 70;
  const ratio = liq / mcap;
  if (ratio >= 0.1) return 10;
  if (ratio >= 0.05) return 30;
  if (ratio >= 0.02) return 50;
  if (ratio >= 0.01) return 70;
  return 90;
}

function scoreVolume(vol: number, liq: number): number {
  if (!vol || vol <= 0) return 80;
  const ratio = liq > 0 ? vol / liq : 0;
  if (ratio < 0.1) return 80;
  if (ratio <= 3) return 20;
  if (ratio <= 10) return 50;
  return 75;
}
