import type { Metadata } from "next";
import TokensClient from "./TokensClient";

export const metadata: Metadata = {
  title: "Approved Tokens | Magpie",
  description:
    "Browse 78 tokens accepted as collateral on Magpie — memecoins and tokenized stocks. Live prices, volume, market cap, and performance data powered by DexScreener.",
  openGraph: {
    title: "Approved Tokens | Magpie",
    description: "78 memecoin and tokenized stock collateral tokens with live market data.",
  },
};

export default function Page() {
  return <TokensClient />;
}
