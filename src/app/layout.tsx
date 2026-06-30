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
  title: "Magpie — Collateral that can still sell itself.",
  description:
    "Borrow SOL against your tokens — and set auto-sells on the same collateral. Liquidity, without giving up the upside.",
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
    title: "Magpie — Collateral that can still sell itself.",
    description:
      "Borrow SOL against your tokens — and set auto-sells on the same collateral. Liquidity, without giving up the upside.",
    url: SITE_URL,
    siteName: "Magpie",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Magpie — Collateral that can still sell itself.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie — Collateral that can still sell itself.",
    description: "Borrow SOL against your tokens — and set auto-sells on the same collateral. Liquidity, without giving up the upside.",
    site: "@MagpieLoans",
    creator: "@MagpieLoans",
    images: ["/opengraph-image"],
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
        {/*
          JSON-LD structured data — declares the canonical identity of
          Magpie Capital to every crawler / preview-renderer / security
          reviewer that hits the site. Two parallel schemas:

          1. Organization — who we are + every official channel. Helps
             reviewers cross-check the site against our X / TG / GitHub
             identities. Critical for false-positive-flag appeals: when
             a Blowfish reviewer loads magpie.capital, this is the
             first piece of structured evidence that says "yes, the
             site, the bot, and @MagpieLoans are all the same project."
          2. WebSite — gives search engines a canonical entry for the
             site, with the protocol-defining tagline.

          All info is already public; nothing leaked here.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://magpie.capital/#organization",
                  name: "Magpie Capital",
                  alternateName: "Magpie",
                  url: "https://magpie.capital",
                  logo: "https://magpie.capital/icon-512.png",
                  description:
                    "Permissionless Solana lending protocol. Borrow SOL against memecoins and tokenized stocks. Custodial-by-export, open source, on-chain verifiable.",
                  sameAs: [
                    "https://x.com/MagpieLoans",
                    "https://t.me/magpie_capital_bot",
                    "https://t.me/magpietalk",
                    "https://github.com/magpiecapital",
                    "https://linktr.ee/magpiecapital",
                  ],
                  contactPoint: [
                    {
                      "@type": "ContactPoint",
                      contactType: "security",
                      url: "https://magpie.capital/security",
                      areaServed: "Worldwide",
                      availableLanguage: ["English"],
                    },
                    {
                      "@type": "ContactPoint",
                      contactType: "customer support",
                      url: "https://t.me/magpie_capital_bot",
                      areaServed: "Worldwide",
                    },
                  ],
                },
                {
                  "@type": "WebSite",
                  "@id": "https://magpie.capital/#website",
                  url: "https://magpie.capital",
                  name: "Magpie Capital",
                  description:
                    "Collateral that can still sell itself. Borrow SOL against your tokens — and set auto-sells on the same collateral. Liquidity, without giving up the upside.",
                  publisher: { "@id": "https://magpie.capital/#organization" },
                  inLanguage: "en",
                },
              ],
            }),
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
