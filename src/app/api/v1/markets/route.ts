/**
 * GET /api/v1/markets
 *
 * $MAGPIE DEX trading pairs in a shape CoinMarketCap & CoinGecko
 * reviewers consume during listing reviews. Live-fetched from
 * DexScreener — pair address, DEX, quote token, 24h volume, current
 * liquidity, and last traded price.
 *
 * Reviewers use this to verify there's real volume on real venues
 * before accepting the listing. Without an endpoint they have to dig
 * pair addresses out by hand — this is the "make it easy for them"
 * artifact.
 */
import { NextResponse } from "next/server";
import { MAGPIE_MINT_STR } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; symbol?: string; name?: string };
  priceNative?: string;
  priceUsd?: string;
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${MAGPIE_MINT_STR}`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 60 } },
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `DexScreener returned ${res.status}` },
        { status: 503 },
      );
    }
    const pairs = (await res.json()) as DexScreenerPair[];
    if (!Array.isArray(pairs)) {
      return NextResponse.json(
        { ok: false, error: "Unexpected DexScreener response shape" },
        { status: 503 },
      );
    }

    // Sort by 24h volume desc — the venue with the most volume is the
    // first one reviewers should look at.
    const sorted = [...pairs].sort(
      (a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0),
    );

    const markets = sorted.map((p) => {
      const isBase = p.baseToken?.address === MAGPIE_MINT_STR;
      const quote = isBase ? p.quoteToken : p.baseToken;
      return {
        exchange: p.dexId,
        pair_address: p.pairAddress,
        pair_url: p.url,
        base_token: {
          address: MAGPIE_MINT_STR,
          symbol: "MAGPIE",
        },
        quote_token: quote
          ? {
              address: quote.address,
              symbol: quote.symbol,
              name: quote.name,
            }
          : null,
        last_price_usd: p.priceUsd ? parseFloat(p.priceUsd) : null,
        last_price_native: p.priceNative ? parseFloat(p.priceNative) : null,
        volume_24h_usd: p.volume?.h24 ?? 0,
        liquidity_usd: p.liquidity?.usd ?? 0,
        price_change_24h_pct: p.priceChange?.h24 ?? null,
        pair_created_at: p.pairCreatedAt
          ? new Date(p.pairCreatedAt).toISOString()
          : null,
      };
    });

    const totals = {
      pair_count: markets.length,
      total_volume_24h_usd: markets.reduce((s, m) => s + (m.volume_24h_usd ?? 0), 0),
      total_liquidity_usd: markets.reduce((s, m) => s + (m.liquidity_usd ?? 0), 0),
    };

    return NextResponse.json(
      {
        ok: true,
        mint: MAGPIE_MINT_STR,
        symbol: "MAGPIE",
        source: "dexscreener",
        totals,
        markets,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}
