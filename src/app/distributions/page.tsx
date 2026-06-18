import type { Metadata } from "next";
import DistributionsClient from "./DistributionsClient";

export const metadata: Metadata = {
  title: "Distributions | Magpie",
  description:
    "Every SOL distribution Magpie has made — holder rewards, governance ratifications, LP loyalty. Real numbers, on-chain tx sigs, lifetime totals. No marketing fluff.",
  openGraph: {
    title: "Magpie distributions",
    description:
      "Audit trail of every SOL distribution Magpie has made to stakeholders.",
  },
};

export default function Page() {
  return <DistributionsClient />;
}
