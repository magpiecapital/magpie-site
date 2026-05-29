import type { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

export function generateMetadata(): Metadata {
  const count = TOKEN_REGISTRY.length;
  return {
    title: "Lending — Magpie",
    description: `Borrow SOL instantly against your memecoins. Three loan tiers, ${count} approved tokens, and funds in under 30 seconds — all through Telegram.`,
  };
}

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
