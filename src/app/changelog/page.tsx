import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { MobileNav } from "@/components/MobileNav";

export const metadata = {
  title: "Changelog | Magpie",
  description:
    "What's new at Magpie. Protocol updates, new features, and improvements.",
};

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

type Tag = "Feature" | "Improvement" | "Security" | "Launch";

interface Entry {
  date: string;
  tag: Tag;
  title: string;
  bullets: string[];
}

const ENTRIES: Entry[] = [
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Public REST API (v1)",
    bullets: [
      "GET /api/v1/stats — Protocol-level statistics",
      "GET /api/v1/tokens — All 64 tokens with live DexScreener pricing",
      "GET /api/v1/health — Protocol health overview",
      "GET /api/v1/calculate — Loan calculator with real-time pricing",
      "60-second caching, structured JSON responses, versioned endpoints",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Whitepaper & Security Page",
    bullets: [
      "Magpie Protocol Litepaper v1.0 at /whitepaper",
      "Full security audit report and transparency page at /security",
      "Bug bounty program and responsible disclosure policy",
      "10/10 security checklist with architecture diagrams",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Security",
    title: "60-Second Quote Expiry & Slippage Guard",
    bullets: [
      "Loan quotes now expire after 60 seconds to protect against price fluctuations",
      "2% maximum slippage tolerance between quote and execution",
      "Price re-verified at confirmation time — freshest price always used",
      "Stale sessions auto-cleaned from memory",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Magpie Points System",
    bullets: [
      "Earn points on every successful loan repayment",
      "Base formula: Loan SOL \u00d7 100, multiplied by tier, timing, and streak bonuses",
      "Express tier earns 1.5\u00d7, Quick 1.25\u00d7, Standard 1.0\u00d7",
      "Early repayment +25%, on-time +10%, streak bonuses up to +50%",
      "Interactive points calculator and mock leaderboard at /points",
      "Redemption features coming soon \u2014 accumulate now",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Security",
    title: "Security Hardening",
    bullets: [
      "Input sanitization on all API endpoints",
      "SSL enforcement on database connections",
      "Added .dockerignore to prevent secret leakage in builds",
      "Removed hardcoded program IDs from public configs",
      "Revoked and rotated all deployment tokens",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Open Source Release",
    bullets: [
      "Both repositories now public on GitHub (magpiecapital)",
      "Site: magpiecapital/magpie-site",
      "Bot: magpiecapital/magpie-bot",
      "Full audit confirms zero secrets in code or git history",
      "Ready for hackathon competition entry",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Credit System",
    bullets: [
      "Introducing Magpie Credit Score (300\u2013850)",
      "Four tiers: Bronze, Silver, Gold, Platinum",
      "Score based on repayment history, volume, age, diversity, liquidations",
      "Higher scores unlock better LTV, lower fees, extended terms",
      "Interactive score simulator on /credit",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Loan Calculator",
    bullets: [
      "Interactive calculator at /calculate",
      "Real-time DexScreener pricing for all 64 tokens",
      "Side-by-side tier comparison (Express, Quick, Standard)",
      "Shows SOL payout, fees, liquidation price, and health",
      "LTV education section included",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Technical Documentation",
    bullets: [
      "Comprehensive docs at /docs",
      "Architecture, loan lifecycle, security model",
      "Pricing & oracles, fee structure, wallet model",
      "Credit system documentation",
      "Stripe-inspired clean layout with sidebar navigation",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Protocol Stats Dashboard",
    bullets: [
      "Live protocol metrics at /stats",
      "Loan volume, TVL, active loans, health distribution",
      "Top collateral tokens ranking",
      "Recent activity feed",
      "Tier distribution visualization",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Feature",
    title: "Submit Token Flow",
    bullets: [
      '\u201CSubmit Token\u201D button added to nav and tokens page hero',
      "Token request form sends to admin via Telegram",
      "Input validation and Markdown injection protection",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Token Page Enhancements",
    bullets: [
      "Added 61 new tokens (3 \u2192 64 total)",
      "Live DexScreener data: price, 24h change, volume, market cap",
      "Sortable columns, search by name/ticker/address",
      "Token image fallback chain (DexScreener \u2192 letter circle)",
      "Stats cards: token count, combined mcap, combined volume",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Homepage Overhaul",
    bullets: [
      'Prominent "Approved Tokens" callout section',
      "Expanded FAQ (6 \u2192 8 items) with LTV explainers",
      "Added token page links throughout (hero, tiers, nav, footer)",
      "Removed Discord link (no Discord exists)",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Feature",
    title: "Approved Tokens Page",
    bullets: [
      "CoinMarketCap-style token listing at /tokens",
      "Real-time pricing from DexScreener API",
      "Market cap, volume, 1h/24h performance",
      "Token request form for community submissions",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Brand Migration",
    bullets: [
      "Rebranded from BagBank to Magpie across all surfaces",
      "Updated Telegram bot messages, commands, and responses",
      "Added X/Twitter account: @MagpieLending",
      "Updated all meta tags and OG data",
    ],
  },
  {
    date: "April 15, 2026",
    tag: "Feature",
    title: "Infrastructure Migration",
    bullets: [
      "Migrated repos to magpiecapital GitHub organization",
      "Vercel connected to magpiecapital/magpie-site",
      "Railway connected to magpiecapital/magpie-bot",
      "Docker workflow updated for new org",
    ],
  },
  {
    date: "April 2026",
    tag: "Launch",
    title: "Magpie Protocol Launch",
    bullets: [
      "Telegram bot live: @magpie_capital_bot",
      "Anchor program deployed on Solana mainnet",
      "3 lending tiers: Express (30% LTV), Quick (25%), Standard (20%)",
      "Non-custodial wallet model with AES-256 encryption",
      "Deposit watcher, health alerts, auto-liquidation",
      "Site live at magpie.capital",
    ],
  },
];

const TAG_STYLES: Record<Tag, { bg: string; text: string; dot: string; glow?: string }> = {
  Feature: {
    bg: "bg-[var(--accent-dim)]",
    text: "text-[var(--accent-deep)]",
    dot: "bg-[var(--accent)]",
  },
  Improvement: {
    bg: "bg-[var(--surface)]",
    text: "text-[var(--ink-soft)]",
    dot: "bg-[var(--ink-soft)]",
  },
  Security: {
    bg: "bg-[#f5f0ff]",
    text: "text-[#6e56a0]",
    dot: "bg-[#9b82c8]",
  },
  Launch: {
    bg: "bg-[var(--accent)]",
    text: "text-[var(--accent-ink)]",
    dot: "bg-[var(--accent)]",
    glow: "shadow-[0_0_16px_rgba(247,201,72,0.5)]",
  },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/"><Wordmark size={28} /></Link>
          </div>
          <nav className="flex items-center gap-8">
            <Link
              href="/about"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              About
            </Link>
            <Link
              href="/tokens"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Tokens
            </Link>
            <Link
              href="/credit"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Credit
            </Link>
            <Link
              href="/docs"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Docs
            </Link>
            <Link
              href="/stats"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Stats
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">
              Launch
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <Reveal>
          <div className="chip mb-5">Ship log</div>
          <h1 className="font-display text-6xl font-medium tracking-[-0.04em] md:text-8xl">
            Changelog
          </h1>
          <p className="mt-5 text-xl text-[var(--ink-soft)] leading-relaxed md:text-2xl">
            What we shipped, when we shipped it.
          </p>
        </Reveal>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-3xl px-6 pb-28 md:pb-40">
        <div className="relative border-l-2 border-[var(--hairline-strong)] pl-8 md:pl-12">
          {ENTRIES.map((entry, i) => {
            const style = TAG_STYLES[entry.tag];
            const isLaunch = entry.tag === "Launch";

            return (
              <Reveal key={`${entry.title}-${i}`} delay={i * 40}>
                <div className={`relative pb-12 ${i === ENTRIES.length - 1 ? "pb-0" : ""}`}>
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg)] md:-left-[calc(3rem+5px)] ${style.dot} ${style.glow ?? ""}`}
                  />

                  {/* Date + Tag */}
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <time className="text-sm font-medium text-[var(--ink-faint)] tabular">
                      {entry.date}
                    </time>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.bg} ${style.text} ${isLaunch ? style.glow ?? "" : ""}`}
                    >
                      {entry.tag}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className={`font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl ${
                      isLaunch ? "text-[var(--accent-deep)]" : ""
                    }`}
                  >
                    {entry.title}
                  </h3>

                  {/* Bullets */}
                  <ul className="mt-4 space-y-2">
                    {entry.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--ink-faint)]"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex flex-wrap items-center gap-6 text-sm text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--ink)]">
              Home
            </Link>
            <Link href="/tokens" className="transition hover:text-[var(--ink)]">
              Tokens
            </Link>
            <Link href="/docs" className="transition hover:text-[var(--ink)]">
              Docs
            </Link>
            <Link href="/stats" className="transition hover:text-[var(--ink)]">
              Stats
            </Link>
            <a
              href={TELEGRAM_URL}
              className="transition hover:text-[var(--ink)]"
            >
              Telegram
            </a>
          </div>
          <div className="text-xs text-[var(--ink-faint)]">
            &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
          </div>
        </div>
      </footer>
    </div>
  );
}
