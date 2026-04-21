import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const SITE_URL = "https://magpie.capital";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Magpie — Programmable vaults for AI agents on Solana.",
  description:
    "On-chain infrastructure for the AI agent economy. First app: instant memecoin-backed lending via Telegram.",
  applicationName: "Magpie",
  keywords: [
    "Solana lending",
    "memecoin lending",
    "SOL loan",
    "memecoin collateral",
    "Telegram bot",
    "DeFi",
    "non-custodial",
  ],
  authors: [{ name: "Magpie" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Magpie — Programmable vaults for AI agents on Solana.",
    description:
      "On-chain infrastructure for the AI agent economy. First app: instant memecoin-backed lending via Telegram.",
    url: SITE_URL,
    siteName: "Magpie",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Magpie — Borrow SOL against your bags.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie",
    description: "Programmable vaults for AI agents on Solana.",
    site: "@MagpieCapital",
    creator: "@MagpieCapital",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
