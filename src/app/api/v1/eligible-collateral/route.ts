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

  // Fan out the two reads in parallel.
  const [balanceRes, approvedRes] = await Promise.allSettled([
    fetch(`${BOT_API_URL}/api/v1/wallet/balance?wallet=${wallet}`, {
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json()),
    query(
      `SELECT mint, symbol, name, decimals, category, image_url
         FROM supported_mints
        WHERE enabled = TRUE`,
    ),
  ]);

  const balance = balanceRes.status === "fulfilled" ? balanceRes.value : null;
  const approved = approvedRes.status === "fulfilled" ? approvedRes.value.rows : [];
  const heldTokens: BotToken[] = (balance?.tokens ?? []) as BotToken[];

  // Build mint → approved metadata map, then intersect with holdings.
  const approvedByMint = new Map(
    approved.map((row: { mint: string; symbol: string; name: string; decimals: number; category: string | null; image_url: string | null }) => [row.mint, row]),
  );

  const eligibleBase = heldTokens
    .filter((t) => approvedByMint.has(t.mint))
    .map((t) => {
      const meta = approvedByMint.get(t.mint)! as { mint: string; symbol: string; name: string; decimals: number; category: string | null; image_url: string | null };
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
        const pairs = (await r.json()) as Array<{ baseToken?: { address?: string }; priceUsd?: string; liquidity?: { usd?: number } }>;
        // Pick the deepest-liquidity pair per mint (defensive against
        // shallow-pool spoofing the price).
        const bestPriceByMint = new Map<string, number>();
        const bestLiqByMint = new Map<string, number>();
        for (const p of Array.isArray(pairs) ? pairs : []) {
          const addr = p?.baseToken?.address;
          const price = parseFloat(p?.priceUsd ?? "0");
          const liq = p?.liquidity?.usd ?? 0;
          if (!addr || !price) continue;
          if (!bestLiqByMint.has(addr) || liq > (bestLiqByMint.get(addr) ?? 0)) {
            bestPriceByMint.set(addr, price);
            bestLiqByMint.set(addr, liq);
          }
        }
        for (const e of eligibleBase) {
          const p = bestPriceByMint.get(e.mint);
          if (p && isFinite(p) && p > 0) e.priceUsd = p;
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
