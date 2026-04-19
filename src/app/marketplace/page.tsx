import type { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "P2P Marketplace — Magpie",
  description:
    "Earn yield by lending SOL in risk-adjusted tranches. Senior, mezzanine, and junior pools with automatic borrower matching.",
};

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
