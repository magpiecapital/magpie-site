import type { Metadata } from "next";
import TokensClient from "./TokensClient";

export const metadata: Metadata = {
  title: "Approved Tokens | Magpie",
  description:
    "Browse all 50+ tokens accepted as collateral on Magpie. Live prices, volume, market cap, and performance data powered by DexScreener.",
  openGraph: {
    title: "Approved Tokens | Magpie",
    description: "50+ memecoin collateral tokens with live market data.",
  },
};

export default function Page() {
  return <TokensClient />;
}
