import type { Metadata } from "next";
import PointsClient from "./PointsClient";

export const metadata: Metadata = {
  title: "Magpie Points | Magpie",
  description: "Earn points on every successful loan. Bigger loans, faster repayment, and streaks multiply your rewards.",
  openGraph: {
    title: "Magpie Points | Magpie",
    description: "Earn points on every successful loan. The more you borrow and repay, the more you earn.",
  },
};

export default function Page() {
  return <PointsClient />;
}
