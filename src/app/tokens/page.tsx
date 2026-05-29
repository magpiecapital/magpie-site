import type { Metadata } from "next";
import TokensClient from "./TokensClient";
import { getTokenStats } from "@/lib/db";

// Re-derive metadata at runtime so the count stays synced with the bot's
// canonical DB instead of being frozen at build time.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await getTokenStats();
  return {
    title: "Approved Tokens | Magpie",
    description: `Browse ${count} tokens accepted as collateral on Magpie — memecoins and tokenized stocks. Live prices, volume, market cap, and performance data powered by DexScreener.`,
    openGraph: {
      title: "Approved Tokens | Magpie",
      description: `${count} memecoin and tokenized stock collateral tokens with live market data.`,
    },
  };
}

export default function Page() {
  return <TokensClient />;
}
