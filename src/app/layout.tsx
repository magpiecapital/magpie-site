import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Magpie — Borrow SOL against your bags.",
  description:
    "Memecoin-collateralized SOL lending on Telegram. Pledge your bag, get SOL, repay in days.",
  openGraph: {
    title: "Magpie",
    description: "Borrow SOL against your bags.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie",
    description: "Borrow SOL against your bags.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
