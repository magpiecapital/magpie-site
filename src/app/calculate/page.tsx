import type { Metadata } from "next";
import CalculatorClient from "./CalculatorClient";

export const metadata: Metadata = {
  title: "Loan Calculator | Magpie",
  description:
    "See exactly what you'll receive before you open the bot. Calculate SOL payouts, fees, and liquidation prices for all 64 approved tokens.",
  openGraph: {
    title: "Loan Calculator | Magpie",
    description:
      "Calculate your memecoin loan — collateral value, SOL payout, fees, and liquidation price across all three tiers.",
  },
};

export default function Page() {
  return <CalculatorClient />;
}
