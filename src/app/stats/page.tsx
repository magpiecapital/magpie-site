import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "Protocol Stats | Magpie",
  description:
    "Real-time metrics from the Magpie lending protocol. Total loans, volume, collateral distribution, and live activity feed.",
  openGraph: {
    title: "Protocol Stats | Magpie",
    description:
      "Live dashboard showing Magpie lending protocol statistics — loans originated, SOL lent, TVL, and more.",
  },
};

export default function Page() {
  return <StatsClient />;
}
