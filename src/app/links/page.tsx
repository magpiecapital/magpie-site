import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/Logo";
import { TELEGRAM_BOT, TELEGRAM_COMMUNITY } from "@/lib/telegram-links";

/**
 * /links — the canonical "linktree" for Magpie Capital.
 *
 * This page exists for one reason: in DeFi, scammers register
 * lookalike domains, fake X accounts, and impostor TG bots. The safest
 * way to direct users to the real Magpie surfaces is to hand them a
 * URL on the *protocol's own domain* — `magpie.capital/links` — and
 * let them follow the buttons from there. Anyone who finds a different
 * "Magpie linktree" can verify against this page.
 *
 * Design constraints:
 *   - Zero distractions. No header chrome, no footer, no extra nav.
 *     Get users to the right surface in one click.
 *   - Mobile-first. People share these URLs from phones.
 *   - The "anyone else is impersonation" trust signal at the bottom
 *     is the most important part — it teaches users the rule, not
 *     just the destination.
 *   - URLs come from telegram-links.ts (single source of truth) so a
 *     future handle change updates everywhere at once.
 */

const X_URL = "https://x.com/MagpieLoans";
const GITHUB_URL = "https://github.com/magpiecapital";
const SITE_URL = "https://magpie.capital";

export const metadata: Metadata = {
  title: "Official links — Magpie Capital",
  description:
    "The complete list of Magpie's official accounts. Anything claiming to be Magpie outside these is impersonation.",
  openGraph: {
    title: "Magpie · Official Links",
    description:
      "Every official Magpie surface in one place. Anything else is impersonation.",
    url: `${SITE_URL}/links`,
    siteName: "Magpie",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie · Official Links",
    description:
      "Every official Magpie surface in one place. Anything else is impersonation.",
    site: "@MagpieLoans",
    creator: "@MagpieLoans",
    images: ["/opengraph-image"],
  },
  alternates: { canonical: "/links" },
};

type LinkCard = {
  href: string;
  label: string;
  handle: string;
  description: string;
  icon: React.ReactNode;
  accent?: boolean;
};

function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const PRIMARY_LINKS: LinkCard[] = [
  {
    href: TELEGRAM_BOT.url,
    label: "Telegram · Wallet bot",
    handle: "@magpie_capital_bot",
    description: "Your private 1:1 with the bot — borrow, repay, manage loans.",
    icon: <TelegramIcon />,
    accent: true,
  },
  {
    href: TELEGRAM_COMMUNITY.url,
    label: "Telegram · Community",
    handle: "@magpietalk",
    description: "Public group chat — discussion, questions, announcements.",
    icon: <TelegramIcon />,
  },
  {
    href: X_URL,
    label: "X (Twitter)",
    handle: "@MagpieLoans",
    description: "Official announcements + protocol updates.",
    icon: <XIcon />,
  },
  {
    href: SITE_URL,
    label: "Website",
    handle: "magpie.capital",
    description: "Dashboard, docs, live stats, calculator, all of it.",
    icon: <GlobeIcon />,
  },
  {
    href: "https://linktr.ee/magpiecapital",
    label: "Linktree",
    handle: "linktr.ee/magpiecapital",
    description: "Every official Magpie link in one tap — socials, app, docs.",
    icon: <GlobeIcon />,
  },
];

export default function LinksPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-md px-5 py-12 sm:py-16">
        {/* Header — wordmark + tagline */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <Mark size={64} />
          </Link>
          <h1 className="font-display text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Magpie · Official Links
          </h1>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            Every official Magpie surface in one place. Anything else is impersonation.
          </p>
        </div>

        {/* Primary link cards */}
        <div className="space-y-3">
          {PRIMARY_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-2xl border p-4 transition active:scale-[0.98] ${
                l.accent
                  ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]/40 hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]/60"
                  : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--ink-faint)] hover:bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    l.accent ? "bg-[var(--accent)]/15 text-[var(--accent-deep)]" : "bg-[var(--surface)] text-[var(--ink-soft)]"
                  }`}
                >
                  {l.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] leading-tight">
                    {l.label}
                  </div>
                  <div className="text-[13px] font-medium text-[var(--ink-soft)] mt-0.5">
                    {l.handle}
                  </div>
                  <div className="text-[12px] text-[var(--ink-faint)] mt-1 leading-snug">
                    {l.description}
                  </div>
                </div>
                <span className="text-[var(--ink-faint)] text-xl shrink-0" aria-hidden>
                  →
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Trust signal — the most important part */}
        <div className="mt-10 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] p-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--bad)] mb-2">
            ⚠️ Anyone else is a scammer
          </div>
          <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
            No Magpie account will ever DM you first, ask for your seed phrase, promise to recover lost funds, or hand out free airdrops. There&apos;s no &quot;Magpie Support&quot; account.
          </p>
        </div>

        {/* Secondary links — source code, smaller */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--ink-faint)]">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-[var(--ink-soft)] transition"
          >
            <GithubIcon />
            Source code
          </a>
          <Link href="/stats" className="hover:text-[var(--ink-soft)] transition">
            Live stats
          </Link>
          <Link href="/docs" className="hover:text-[var(--ink-soft)] transition">
            Docs
          </Link>
          <Link href="/security" className="hover:text-[var(--ink-soft)] transition">
            Security
          </Link>
        </div>

        <div className="mt-8 text-center text-[10px] text-[var(--ink-faint)]">
          Bookmark <span className="font-mono">magpie.capital/links</span> · share this page, not screenshots
        </div>
      </div>
    </main>
  );
}
