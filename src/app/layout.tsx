import type { Metadata } from "next";
import Script from "next/script";
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
  title: "Magpie — Permissionless lending protocol on Solana.",
  description:
    "Borrow SOL against memecoins and tokenized stocks. Permissionless pools, on-chain credit scores, and a keeper network — all in a Telegram chat.",
  applicationName: "Magpie",
  keywords: [
    "Solana lending",
    "memecoin lending",
    "tokenized stocks",
    "SOL loan",
    "memecoin collateral",
    "permissionless lending",
    "DeFi credit score",
    "keeper network",
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
    title: "Magpie — Permissionless lending protocol on Solana.",
    description:
      "Borrow SOL against memecoins and tokenized stocks. Permissionless pools, on-chain credit scores, and a keeper network.",
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
    description: "Permissionless lending protocol on Solana. Borrow SOL against memecoins and tokenized stocks.",
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
      <head>
        {/* Buffer polyfill — MUST load before any Solana JS. Synchronous script. */}
        <Script src="/buffer-polyfill.js" strategy="beforeInteractive" />
      </head>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
