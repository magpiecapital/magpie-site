import type { Metadata } from "next";
import TokensClient from "./TokensClient";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

const count = TOKEN_REGISTRY.length;

export const metadata: Metadata = {
  title: "Approved Tokens | Magpie",
  description:
    `Browse ${count} tokens accepted as collateral on Magpie — memecoins and tokenized stocks. Live prices, volume, market cap, and performance data powered by DexScreener.`,
  openGraph: {
    title: "Approved Tokens | Magpie",
    description: `${count} memecoin and tokenized stock collateral tokens with live market data.`,
  },
};

export default function Page() {
  return <TokensClient />;
}
