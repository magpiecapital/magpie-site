import type { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";
import { getTokenStats, getLoanTiers } from "@/lib/db";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { count, stockCount } = await getTokenStats();
  const hasRwa = stockCount > 0;
  return {
    title: "Lending — Magpie",
    description: hasRwa
      ? `Borrow SOL instantly against ${count} approved tokens — memecoins and tokenized stocks. Memecoin tiers: 30% / 25% / 20% LTV across Express / Quick / Standard (2 / 3 / 7-day terms). RWA tiers (V3, live): 50% / 60% / 70% LTV at 7 / 15 / 30-day terms.`
      : `Borrow SOL instantly against your memecoins. Three loan tiers, ${count} approved tokens, and funds in under 30 seconds.`,
  };
}

interface TokenChip {
  symbol: string;
  name: string;
  mint: string;
  category: "memecoin" | "stock" | "etf" | "metal";
}

/**
 * Pulls the full approved-tokens list split per category. The hero
 * panels show a marquee of the first ~14 per class for at-a-glance
 * recognition; the dedicated "All approved collateral" section below
 * renders the complete list so users can confirm a specific holding
 * is supported without navigating away.
 *
 * Uses the bot's /api/v1/tokens endpoint (cached). Falls back to
 * empty lists on failure — the marketplace renders cleanly without
 * the token grid, just less marketing-pop.
 */
async function fetchTokensByCategory(): Promise<{ memecoin: TokenChip[]; rwa: TokenChip[] }> {
  const botUrl = process.env.BOT_API_URL;
  if (!botUrl) return { memecoin: [], rwa: [] };
  try {
    const res = await fetch(`${botUrl}/api/v1/tokens?limit=500`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { memecoin: [], rwa: [] };
    const d = await res.json() as {
      tokens?: Array<{ symbol: string; name: string; mint: string; category?: string }>;
    };
    if (!d.tokens) return { memecoin: [], rwa: [] };
    const memecoin: TokenChip[] = d.tokens
      .filter((t) => t.category === "memecoin" || !t.category)
      .map((t) => ({ symbol: t.symbol, name: t.name, mint: t.mint, category: "memecoin" }));
    const rwa: TokenChip[] = d.tokens
      .filter((t) => t.category === "stock" || t.category === "etf" || t.category === "metal")
      .map((t) => ({
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        category: (t.category as "stock" | "etf" | "metal"),
      }));
    return { memecoin, rwa };
  } catch {
    return { memecoin: [], rwa: [] };
  }
}

export default async function MarketplacePage() {
  const [{ count, stockCount }, memeTiers, rwaTiers, allTokens] = await Promise.all([
    getTokenStats(),
    getLoanTiers("memecoin"),
    getLoanTiers("stock"),
    fetchTokensByCategory(),
  ]);
  return (
    <MarketplaceClient
      tokenCount={count}
      stockCount={stockCount}
      memeTiers={memeTiers}
      rwaTiers={rwaTiers}
      memeSamples={allTokens.memecoin.slice(0, 14)}
      rwaSamples={allTokens.rwa.slice(0, 14)}
      allMemes={allTokens.memecoin}
      allRwas={allTokens.rwa}
    />
  );
}
