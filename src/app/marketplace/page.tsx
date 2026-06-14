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
      ? `Borrow SOL instantly against ${count} approved tokens — memecoins and tokenized stocks. Memecoin tiers: 30% / 25% / 20% LTV across Express / Quick / Standard (2 / 3 / 7-day terms). RWA tiers (v3, live): 50% / 60% / 70% LTV at 7 / 15 / 30-day terms.`
      : `Borrow SOL instantly against your memecoins. Three loan tiers, ${count} approved tokens, and funds in under 30 seconds.`,
  };
}

export default async function MarketplacePage() {
  const [{ count, stockCount }, memeTiers, rwaTiers] = await Promise.all([
    getTokenStats(),
    getLoanTiers("memecoin"),
    getLoanTiers("stock"),
  ]);
  return (
    <MarketplaceClient
      tokenCount={count}
      stockCount={stockCount}
      memeTiers={memeTiers}
      rwaTiers={rwaTiers}
    />
  );
}
