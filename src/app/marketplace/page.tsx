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
      ? `Borrow SOL instantly against ${count} approved tokens — memecoins or tokenized stocks. Up to 70% LTV on real-world assets, terms from 2 to 30 days.`
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
