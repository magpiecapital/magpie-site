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
  title: "Magpie — Solana lending. Liquidity without selling your bag.",
  description:
    "Three collateral classes, one protocol. Magpie is a Solana lending protocol: borrow SOL against your memecoins, tokenized stocks, and collectibles — and set take-profits and stops on the same collateral. Collateral that can still sell itself.",
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
    title: "Magpie — Solana lending. Liquidity without selling your bag.",
    description:
      "Three collateral classes, one protocol. Magpie is a Solana lending protocol: borrow SOL against your memecoins, tokenized stocks, and collectibles — and set take-profits and stops on the same collateral. Collateral that can still sell itself.",
    url: SITE_URL,
    siteName: "Magpie",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Magpie — Solana lending protocol · Liquidity without selling your bag.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie — Solana lending. Liquidity without selling your bag.",
    description: "Three collateral classes, one protocol. Borrow SOL against your memecoins, tokenized stocks, and collectibles on Solana — and set take-profits and stops on the same collateral. Collateral that can still sell itself.",
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
                  "@type": "FAQPage",
                  "@id": "https://magpie.capital/#faq",
                  mainEntity: [
                    {
                      "@type": "Question",
                      name: "What is Magpie Capital?",
                      acceptedAnswer: { "@type": "Answer", text: "Magpie Capital is a permissionless lending protocol on Solana. Users borrow SOL against tokens they already hold — memecoins, tokenized stocks & RWAs, and tokenized collectibles — on fixed terms with no margin calls." },
                    },
                    {
                      "@type": "Question",
                      name: "How is Magpie different from other crypto lending protocols?",
                      acceptedAnswer: { "@type": "Answer", text: "With a normal loan your collateral is locked away — if the market spikes you can only watch. Magpie's V4 pools let borrowers arm take-profit ladders and stop-losses on the collateral itself: exit orders fire inside the on-chain vault while the loan stays active, so borrowers never miss market upside while borrowed against." },
                    },
                    {
                      "@type": "Question",
                      name: "What can I borrow against on Magpie?",
                      acceptedAnswer: { "@type": "Answer", text: "Three collateral classes: 200+ screened Solana memecoins (WIF, BONK and others), 25+ tokenized stocks and real-world assets (xStocks equities, tokenized gold and silver), and tokenized graded collectibles (in design, via partners like Collector Crypt)." },
                    },
                    {
                      "@type": "Question",
                      name: "Can a loan on Magpie get margin-called or liquidated early?",
                      acceptedAnswer: { "@type": "Answer", text: "No. Magpie loans are fixed-term: a price dip cannot trigger liquidation before the due date, and there are no margin calls. Liquidation only occurs if a loan is not repaid by its due date." },
                    },
                    {
                      "@type": "Question",
                      name: "Can AI agents use Magpie?",
                      acceptedAnswer: { "@type": "Answer", text: "Yes — Magpie serves AI agents natively via x402 payment-gated APIs (standard v2). Autonomous agents can take loans, arm exit orders, and repay programmatically at magpie.capital/x402." },
                    },
                    {
                      "@type": "Question",
                      name: "Is Magpie Capital audited?",
                      acceptedAnswer: { "@type": "Answer", text: "The V4 pool completed a Sec3 security review (24 findings; 20 resolved, 4 acknowledged, 0 open at close), and the same fix classes have been replicated to the V1 and V3 pools. Program upgrades sit behind a hardware-key multisig with a 48-hour public timelock, verifiable live at magpie.capital/security." },
                    },
                  ],
                },
                {
                  "@type": "VideoObject",
                  "@id": "https://magpie.capital/#how-it-works-video",
                  name: "How Magpie works — borrow SOL without leaving the market",
                  description:
                    "60-second walkthrough of the real Magpie dashboard: borrow SOL against your tokens, arm a take-profit ladder and stop-loss on the collateral itself, and never miss a market spike — the loan stays active while exits fire in-vault.",
                  thumbnailUrl: "https://magpie.capital/media/how-it-works-poster.jpg",
                  contentUrl: "https://magpie.capital/media/how-it-works.mp4",
                  uploadDate: "2026-08-15",
                  duration: "PT70S",
                  publisher: { "@id": "https://magpie.capital/#organization" },
                },
                {
                  "@type": "Organization",
                  "@id": "https://magpie.capital/#organization",
                  name: "Magpie Capital",
                  alternateName: "Magpie",
                  url: "https://magpie.capital",
                  logo: "https://magpie.capital/icon-512.png",
                  description:
                    "Permissionless Solana lending protocol. Borrow SOL against memecoins, tokenized stocks & RWAs, and collectibles — three collateral classes, one protocol. Fixed terms, in-vault exit orders, on-chain verifiable.",
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
                    "Magpie is a Solana lending protocol. Borrow SOL against your memecoins, tokenized stocks, and RWAs — and set take-profits and stops on the same collateral. Collateral that can still sell itself.",
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
