import type { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Lending — Magpie",
  description:
    "Borrow SOL instantly against your memecoins. Three loan tiers, 64+ approved tokens, and funds in under 30 seconds — all through Telegram.",
};

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
