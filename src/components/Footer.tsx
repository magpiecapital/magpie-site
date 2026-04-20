import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const X_URL = "https://x.com/MagpieLending";
const GITHUB_URL = "https://github.com/magpiecapital";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Link href="/">
              <Wordmark size={24} />
            </Link>
            <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[var(--ink-soft)]">
              Borrow SOL against your memecoin bags, in a Telegram chat.
            </p>
          </div>
          <FooterCol title="Product">
            <FooterLink href="/tokens">Approved Tokens</FooterLink>
            <FooterLink href="/calculate">Loan Calculator</FooterLink>
            <FooterLink href="/credit">Credit System</FooterLink>
            <FooterLink href="/points">Points</FooterLink>
            <FooterLink href="/vault">Agent Vault</FooterLink>
            <FooterLink href="/marketplace">Marketplace</FooterLink>
            <FooterLink href="/dashboard">Dashboard</FooterLink>
            <FooterLink href="/demo">Demo</FooterLink>
          </FooterCol>
          <FooterCol title="Resources">
            <FooterLink href="/docs">Documentation</FooterLink>
            <FooterLink href="/whitepaper">Whitepaper</FooterLink>
            <FooterLink href="/security">Security</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
            <FooterLink href="/about">About</FooterLink>
          </FooterCol>
          <FooterCol title="Community">
            <FooterLink href={X_URL}>X / Twitter</FooterLink>
            <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
            <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
          </FooterCol>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--hairline)] pt-6 md:flex-row md:items-center">
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
