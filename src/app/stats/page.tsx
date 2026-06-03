import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "Protocol Transparency | Magpie",
  description:
    "Live protocol stats — every loan, every reward, every dollar. Verifiable on-chain. Magpie's transparency dashboard.",
  openGraph: {
    title: "Protocol Transparency | Magpie",
    description:
      "Real-time protocol metrics — TVL, default rate, holder rewards, LP loyalty distributions, referral payouts. All public.",
  },
};

export default function Page() {
  return <StatsClient />;
}
