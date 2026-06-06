import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  // viewport-fit=cover lets us use env(safe-area-inset-*) so floating
  // elements (chat button, fixed banners) clear iOS home indicators
  // and Android nav bars on mobile.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Mobile browser chrome (Android Chrome address bar, iOS status bar
  // edge) gets tinted to match the site instead of plain white/grey.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

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
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
        {/* Theme initializer — runs BEFORE React hydration so users
            never see a flash of the wrong theme. Reads localStorage
            "magpie-theme" (set by ThemeToggle), falls back to OS
            prefers-color-scheme on first visit. Sets html[data-theme]
            which globals.css uses to switch every CSS variable. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem("magpie-theme");
                  var theme = stored === "dark" || stored === "light"
                    ? stored
                    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.setAttribute("data-theme", theme);
                } catch (e) { /* localStorage blocked — default light */ }
              })();
            `,
          }}
        />
        {/* Buffer polyfill — MUST load before any Solana JS. Synchronous script. */}
        <Script src="/buffer-polyfill.js" strategy="beforeInteractive" />
        {/* Connect early to the third-party services we hit on dashboard load. */}
        <link rel="preconnect" href="https://magpie-bot-production.up.railway.app" />
        <link rel="dns-prefetch" href="https://magpie-bot-production.up.railway.app" />
        <link rel="dns-prefetch" href="https://api.mainnet-beta.solana.com" />
        <link rel="dns-prefetch" href="https://api.dexscreener.com" />
        <link rel="dns-prefetch" href="https://dd.dexscreener.com" />
      </head>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
