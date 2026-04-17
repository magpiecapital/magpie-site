import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { MobileNav } from "@/components/MobileNav";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const X_URL = "https://x.com/MagpieLending";
const GITHUB_URL = "https://github.com/magpiecapital";

export const metadata = {
  title: "About | Magpie",
  description:
    "The mission behind Magpie — unlocking liquidity from memecoin bags on Solana.",
};

const FEATURES = [
  {
    title: "Telegram-Native Lending",
    body: "The first lending protocol that lives entirely in a chat. No dApp, no browser extension, no seed phrase in a tab.",
  },
  {
    title: "64+ Memecoin Collateral",
    body: "From WIF to Fartcoin to Moo Deng. If it has liquidity, we'll lend against it.",
  },
  {
    title: "On-Chain Credit System",
    body: "The first DeFi credit score for memecoin lending. Build reputation. Unlock better rates.",
  },
  {
    title: "Points & Rewards",
    body: "Earn points on every successful loan. Bigger loans, riskier tiers, and repayment streaks multiply your rewards.",
  },
  {
    title: "Sub-10-Second Funding",
    body: "Deposit confirms, SOL arrives. The entire flow takes less time than reading this card.",
  },
];

const STATS = [
  { value: "64+", label: "Approved Tokens" },
  { value: "<10s", label: "Average Funding Time" },
  { value: "1.5%", label: "Flat Fee" },
  { value: "3", label: "Lending Tiers" },
  { value: "850", label: "Max Credit Score" },
  { value: "24/7", label: "Live on Solana" },
];

const ROADMAP = [
  {
    quarter: "Q1 2026",
    done: true,
    items: "Protocol launch, Telegram bot, 64 token support",
  },
  {
    quarter: "Q2 2026",
    done: true,
    items: "Credit system, loan calculator, open source release",
  },
  {
    quarter: "Q3 2026",
    done: false,
    items: "Multi-chain expansion (Base, Arbitrum), governance token",
  },
  {
    quarter: "Q4 2026",
    done: false,
    items: "Mobile app, institutional lending pools, DAO launch",
  },
];

const VALUES = [
  {
    title: "Transparency",
    body: "One fee. No hidden rates. Open source code. What you see is what you get.",
  },
  {
    title: "Accessibility",
    body: "If you can use Telegram, you can borrow SOL. No DeFi expertise required.",
  },
  {
    title: "Security",
    body: "Non-custodial. On-chain liquidation. AES-256 encryption. Your keys, your coins.",
  },
];

export default function AboutPage() {
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
            <Link href="/calculate" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Calculator
            </Link>
            <Link href="/tokens" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tokens
            </Link>
            <Link href="/credit" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Credit
            </Link>
            <Link href="/docs" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Docs
            </Link>
            <Link href="/stats" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Stats
            </Link>
            <Link href="/dashboard" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <Reveal>
            <div className="flex justify-center mb-8">
              <div className="hop">
                <Mark size={96} />
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] md:text-7xl lg:text-8xl leading-[0.95]">
              The <span className="italic">quiet</span> lender
              <br />
              for loud bags.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-[var(--ink-soft)]">
              Magpie exists because we believe your bags should work for you — not sit idle while you miss opportunities.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The Thesis */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">The thesis</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Billions locked.
              <br />
              <span className="italic text-[var(--ink-soft)]">Zero options.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-20">
            <Reveal delay={80}>
              <div className="space-y-6 text-lg leading-relaxed text-[var(--ink-soft)]">
                <p>
                  Memecoins represent over <span className="font-semibold text-[var(--ink)]">$50 billion in market cap</span> on Solana alone. Holders are emotionally invested — they won&apos;t sell the bottom, won&apos;t take profits, won&apos;t rotate. But they need SOL. For gas. For the next play. For real life.
                </p>
                <p>
                  Traditional DeFi lending ignores memecoins entirely. Aave won&apos;t touch them. Solend lists a handful. The result? <span className="font-semibold text-[var(--ink)]">Billions in dormant capital</span> with no way to unlock liquidity without selling.
                </p>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="flex flex-col justify-center">
                <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-8 md:p-10">
                  <p className="text-2xl font-medium leading-snug tracking-[-0.02em] font-display">
                    Magpie changes this.
                  </p>
                  <p className="mt-4 text-lg leading-relaxed text-[var(--ink-soft)]">
                    We accept the tokens nobody else will. We deliver SOL in seconds, not hours. And we do it all inside Telegram — where the memecoin community already lives.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* What We Built */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">What we built</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            DeFi that fits in
            <br />
            <span className="italic text-[var(--ink-soft)]">a chat window.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="flex h-full flex-col gap-3 bg-[var(--bg-elevated)] p-8 md:p-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--ink)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="text-xl font-semibold tracking-tight">{f.title}</div>
                </div>
                <div className="text-base leading-relaxed text-[var(--ink-soft)]">
                  {f.body}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* By The Numbers */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">By the numbers</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Built to <span className="italic">perform.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center md:p-8">
                  <div className="font-display tabular text-4xl font-medium tracking-[-0.03em] md:text-5xl">
                    {s.value}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">
                    {s.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Open source</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            Auditable by <span className="italic">default.</span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-12">
            <p className="max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Magpie is fully open source. Both the site and the bot are publicly available for audit, contribution, and competition entry.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dark text-sm"
              >
                View on GitHub
                <span aria-hidden>→</span>
              </a>
              <span className="text-sm font-medium text-[var(--ink-soft)]">
                Built for hackathons. Built to win.
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Roadmap */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Roadmap</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Where we&apos;re <span className="italic">headed.</span>
            </h2>
          </Reveal>

          <div className="mt-16 relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--hairline-strong)] md:left-6" />

            <div className="space-y-8">
              {ROADMAP.map((r, i) => (
                <Reveal key={r.quarter} delay={i * 80}>
                  <div className="relative flex gap-6 pl-12 md:pl-16">
                    {/* Dot */}
                    <div
                      className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 md:left-4.5 ${
                        r.done
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--hairline-strong)] bg-[var(--bg-elevated)]"
                      }`}
                    />
                    <div className="flex-1 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--hairline-strong)] hover:shadow-sm md:p-8">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg font-medium tracking-[-0.02em]">
                          {r.quarter}
                        </span>
                        {r.done && (
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-base leading-relaxed text-[var(--ink-soft)]">
                        {r.items}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Our values</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            Three <span className="italic">pillars.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 100}>
              <div className="flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--ink)] hover:shadow-md md:p-10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--ink)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-5 text-xl font-semibold tracking-tight">{v.title}</div>
                <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
                  {v.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
          <Mark size={80} className="mx-auto mb-10 hop" />
          <h2 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] text-white md:text-7xl lg:text-8xl">
            Join the <span className="italic text-[var(--accent)]">flock.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-white/70">
            Your bags are sitting idle. Put them to work.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-lg">
              Launch on Telegram
              <span aria-hidden>→</span>
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Follow on X
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              <Wordmark size={24} />
              <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[var(--ink-soft)]">
                Borrow SOL against your memecoin bags, in a Telegram chat.
              </p>
            </div>
            <FooterCol title="Product">
              <FooterLink href="/calculate">Calculator</FooterLink>
              <FooterLink href="/tokens">Approved Tokens</FooterLink>
              <FooterLink href="/credit">Credit</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
            </FooterCol>
            <FooterCol title="Company">
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/docs">Docs</FooterLink>
              <FooterLink href="/stats">Stats</FooterLink>
              <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
            </FooterCol>
            <FooterCol title="Social">
              <FooterLink href={X_URL}>X</FooterLink>
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
    </div>
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
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
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
