import type { Metadata } from "next";
import HoldersClient from "./HoldersClient";

export const metadata: Metadata = {
  title: "$MAGPIE Holder Rewards | Magpie",
  description:
    "Hold $MAGPIE → earn 10% of every loan fee, distributed weekly to all holders pro-rata. Sourced from protocol revenue. LPs unaffected. No staking required.",
  openGraph: {
    title: "Hold $MAGPIE, earn real yield — Magpie",
    description:
      "10% of every loan fee on Magpie flows to $MAGPIE holders pro-rata, weekly. Real revenue, on-chain payout, no staking.",
  },
};

export default function Page() {
  return <HoldersClient />;
}
