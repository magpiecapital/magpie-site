import type { Metadata } from "next";
import ReferClient from "./ReferClient";

export const metadata: Metadata = {
  title: "Referral Program | Magpie",
  description:
    "Earn 10% of every loan fee from anyone you refer to Magpie. Lifetime, paid in SOL, sourced from real protocol revenue.",
  openGraph: {
    title: "Earn 10% of every loan fee — Magpie Referrals",
    description:
      "Share your link. Friend borrows. You earn 10% of every fee they pay, forever. Paid in SOL.",
  },
};

export default function Page() {
  return <ReferClient />;
}
