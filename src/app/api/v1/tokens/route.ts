import { NextResponse } from "next/server";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

const REGISTRY = TOKEN_REGISTRY;

/* ─── In-memory cache (60s TTL) ─── */
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/* ─── DexScreener fetch ─── */
async function fetchMarketData(
  mints: string[],
): Promise<
  Map<
    string,
    {
      priceUsd: number | null;
      priceChange24h: number | null;
      volume24h: number | null;
      marketCap: number | null;
      liquidity: number | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      priceUsd: number | null;
      priceChange24h: number | null;
      volume24h: number | null;
      marketCap: number | null;
      liquidity: number | null;
    }
  >();
  const BATCH = 30;

  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += BATCH)
    batches.push(mints.slice(i, i + BATCH));

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch(
          `https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`,
        );
        if (!res.ok) return;
        const pairs: Record<string, unknown>[] = await res.json();
        if (!Array.isArray(pairs)) return;

        for (const p of pairs) {
          const addr = (p as { baseToken?: { address?: string } }).baseToken
            ?.address;
          if (!addr) continue;
          const liq =
            (p as { liquidity?: { usd?: number } }).liquidity?.usd ?? 0;
          const existing = map.get(addr);
          if (existing && (existing.liquidity ?? 0) >= liq) continue;

          const pr = p as {
            priceUsd?: string;
            priceChange?: { h24?: number };
            volume?: { h24?: number };
            marketCap?: number;
            fdv?: number;
          };

          map.set(addr, {
            priceUsd: pr.priceUsd ? parseFloat(pr.priceUsd) : null,
            priceChange24h: pr.priceChange?.h24 ?? null,
            volume24h: pr.volume?.h24 ?? null,
            marketCap: pr.marketCap ?? pr.fdv ?? null,
            liquidity: liq,
          });
        }
      } catch {
        /* ignore batch error */
      }
    }),
  );

  return map;
}

export async function GET() {
  const now = Date.now();

  /* Serve from cache if fresh */
  if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Powered-By": "Magpie Protocol",
      },
    });
  }

  try {
    const mints = REGISTRY.map((t) => t.mint);
    const marketData = await fetchMarketData(mints);

    const tokens = REGISTRY.map((t) => {
      const d = marketData.get(t.mint);
      return {
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        priceUsd: d?.priceUsd ?? null,
        priceChange24h: d?.priceChange24h ?? null,
        volume24h: d?.volume24h ?? null,
        marketCap: d?.marketCap ?? null,
        liquidity: d?.liquidity ?? null,
      };
    });

    const response = {
      ok: true,
      count: tokens.length,
      data: tokens,
      timestamp: new Date().toISOString(),
    };

    /* Update cache */
    cachedData = response;
    cacheTimestamp = now;

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Powered-By": "Magpie Protocol",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch token data",
        message: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-cache",
          "X-Powered-By": "Magpie Protocol",
        },
      },
    );
  }
}
