import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { TELEGRAM_BOT, TELEGRAM_COMMUNITY } from "@/lib/telegram-links";

const X_URL = "https://x.com/MagpieLoans";
const GITHUB_URL = "https://github.com/magpiecapital";
const LINKTREE_URL = "https://linktr.ee/magpiecapital";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <Wordmark size={24} />
            </Link>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-[var(--ink-soft)] sm:mt-4">
              Permissionless lending on Solana. Borrow SOL against memecoins and tokenized stocks.
            </p>
          </div>
          <FooterCol title="Product">
            <FooterLink href="/earn">Earn</FooterLink>
            <FooterLink href="/marketplace">Borrow</FooterLink>
            <FooterLink href="/tokens">Approved Tokens</FooterLink>
            <FooterLink href="/x402">x402 · Agent API</FooterLink>
            <FooterLink href="/dashboard">Dashboard</FooterLink>
            <FooterLink href="/stats">Protocol Stats</FooterLink>
            <FooterLink href="/credit">Credit System</FooterLink>
            <FooterLink href="/holders">$MAGPIE Holders</FooterLink>
            <FooterLink href="/refer">Refer &amp; Earn</FooterLink>
            <FooterLink href="/points">Points</FooterLink>
            <FooterLink href="/calculate">Loan Calculator</FooterLink>
            <FooterLink href="/leaderboard">Leaderboard</FooterLink>
            <FooterLink href="/status">Status</FooterLink>
          </FooterCol>
          <FooterCol title="Resources">
            <FooterLink href="/docs">Documentation</FooterLink>
            <FooterLink href="/whitepaper">Whitepaper</FooterLink>
            <FooterLink href="/governance">Governance</FooterLink>
            <FooterLink href="/security">Security</FooterLink>
            <FooterLink href="/privacy">Privacy & data</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
            <FooterLink href="/about">About</FooterLink>
          </FooterCol>
          <FooterCol title="Community">
            <FooterLink href={X_URL}>X (Twitter)</FooterLink>
            <FooterLink href={TELEGRAM_COMMUNITY.url}>
              Telegram — Community
            </FooterLink>
            <FooterLink href={TELEGRAM_BOT.url}>
              Telegram — Wallet bot
            </FooterLink>
            <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
            <FooterLink href={LINKTREE_URL}>Linktree</FooterLink>
            <FooterLink href="/links">All official links</FooterLink>
          </FooterCol>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[var(--hairline)] pt-5 sm:mt-14 sm:gap-4 sm:pt-6 md:flex-row md:items-center">
          <div className="text-xs text-[var(--ink-soft)]">
            &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
          </div>
          <div className="text-xs text-[var(--ink-faint)]">
            Not financial advice. Loans carry liquidation risk.
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
        {title}
      </div>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
      {children}
    </Link>
  );
}
