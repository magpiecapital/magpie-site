import type { Metadata } from "next";
import CalculatorClient from "./CalculatorClient";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

export function generateMetadata(): Metadata {
  const count = TOKEN_REGISTRY.length;
  return {
    title: "Loan Calculator | Magpie",
    description: `See exactly what you'll receive before you open the bot. Calculate SOL payouts, fees, and liquidation prices for all ${count} approved tokens.`,
    openGraph: {
      title: "Loan Calculator | Magpie",
      description:
        "Calculate your memecoin loan — collateral value, SOL payout, fees, and liquidation price across all three tiers.",
    },
  };
}

export default function Page() {
  return <CalculatorClient />;
}
