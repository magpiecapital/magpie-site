import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Magpie",
  description:
    "Manage your Magpie portfolio — view balances, loans, and collateral in one place.",
  openGraph: {
    title: "Dashboard — Magpie",
    description:
      "Manage your Magpie portfolio — view balances, loans, and collateral in one place.",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
