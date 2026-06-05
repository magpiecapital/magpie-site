import type { Metadata } from "next";
import LeaderboardClient from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Credit Leaderboard | Magpie",
  description:
    "Top borrowers by on-chain credit score. Every on-time repayment moves you up the board.",
  openGraph: {
    title: "Credit Leaderboard | Magpie",
    description:
      "The top 20 Magpie borrowers ranked by on-chain credit score. Earn your spot with on-time repayments.",
  },
};

export default function Page() {
  return <LeaderboardClient />;
}
