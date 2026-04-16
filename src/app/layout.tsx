import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BagBank — Pawn your bags. Get SOL. Keep trading.",
  description:
    "Memecoin-collateralized SOL loans on Telegram. Deposit your bag, get SOL in seconds, repay before the clock runs out.",
  openGraph: {
    title: "BagBank",
    description: "Pawn your bags. Get SOL. Keep trading.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BagBank",
    description: "Pawn your bags. Get SOL. Keep trading.",
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
