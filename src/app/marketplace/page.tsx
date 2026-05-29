import type { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";
import { getTokenStats } from "@/lib/db";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await getTokenStats();
  return {
    title: "Lending — Magpie",
    description: `Borrow SOL instantly against your memecoins. Three loan tiers, ${count} approved tokens, and funds in under 30 seconds — all through Telegram.`,
  };
}

export default async function MarketplacePage() {
  const { count } = await getTokenStats();
  return <MarketplaceClient tokenCount={count} />;
}
