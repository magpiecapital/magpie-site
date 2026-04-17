import type { Metadata } from "next";
import CreditClient from "./CreditClient";

export const metadata: Metadata = {
  title: "Credit System | Magpie",
  description:
    "The first on-chain credit system for memecoin lending. Build your score with every on-time repayment — unlock better LTV, lower fees, and longer terms.",
  openGraph: {
    title: "Credit System | Magpie",
    description:
      "Build your on-chain credit score. Every repayment unlocks better rates, higher LTV, and exclusive perks across the Magpie lending protocol.",
  },
};

export default function Page() {
  return <CreditClient />;
}
