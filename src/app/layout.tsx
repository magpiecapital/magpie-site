import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
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
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
