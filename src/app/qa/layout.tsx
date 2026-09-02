import type { Metadata } from "next";

/**
 * /qa/* — internal render-QA surfaces. Real components, hostile fixtures,
 * exercised by scripts/check-loan-overlap.mjs in CI. Not user-facing:
 * noindexed, linked from nowhere.
 */
export const metadata: Metadata = {
  title: "Magpie QA",
  robots: { index: false, follow: false },
};

export default function QaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
