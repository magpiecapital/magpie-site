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
}

/**
 * Pulls a small representative slice of approved tokens per category to
 * render as chips on the marketplace dual-class panels. The chips are
 * decorative — the canonical token list lives at /tokens — but they're
 * the fastest way to communicate "you can borrow against X" at-a-glance.
 *
 * Uses the bot's /api/v1/tokens endpoint (already battle-tested and
 * cached). Falls back to an empty list on failure — the panels render
 * fine without chips, just less marketing-pop.
 */
async function fetchCategorySamples(): Promise<{ memecoin: TokenChip[]; rwa: TokenChip[] }> {
  const botUrl = process.env.BOT_API_URL;
  if (!botUrl) return { memecoin: [], rwa: [] };
  try {
    const res = await fetch(`${botUrl}/api/v1/tokens?limit=300`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { memecoin: [], rwa: [] };
    const d = await res.json() as { tokens?: Array<{ symbol: string; name: string; mint: string; category?: string }> };
    if (!d.tokens) return { memecoin: [], rwa: [] };
    const memecoin = d.tokens
      .filter((t) => t.category === "memecoin" || !t.category)
      .slice(0, 14)
      .map((t) => ({ symbol: t.symbol, name: t.name, mint: t.mint }));
    const rwa = d.tokens
      .filter((t) => t.category === "stock" || t.category === "etf" || t.category === "metal")
      .slice(0, 14)
      .map((t) => ({ symbol: t.symbol, name: t.name, mint: t.mint }));
    return { memecoin, rwa };
  } catch {
    return { memecoin: [], rwa: [] };
  }
}

export default async function MarketplacePage() {
  const [{ count, stockCount }, memeTiers, rwaTiers, samples] = await Promise.all([
    getTokenStats(),
    getLoanTiers("memecoin"),
    getLoanTiers("stock"),
    fetchCategorySamples(),
  ]);
  return (
    <MarketplaceClient
      tokenCount={count}
      stockCount={stockCount}
      memeTiers={memeTiers}
      rwaTiers={rwaTiers}
      memeSamples={samples.memecoin}
      rwaSamples={samples.rwa}
    />
  );
}
