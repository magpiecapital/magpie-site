import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { PhoneMock } from "@/components/PhoneMock";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWallet } from "@/components/ConnectWallet";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const X_URL = "https://x.com/MagpieLending";

const STEPS = [
  {
    n: "01",
    t: "Open @magpie_capital_bot",
    d: "Start a chat. Verify your wallet. No seed phrase — keys stay yours, exportable anytime.",
  },
  {
    n: "02",
    t: "Get an instant quote",
    d: "Pick a tier and a bag. Live oracle pricing shows your payout and liquidation price before you sign.",
  },
  {
    n: "03",
    t: "Deposit your bag",
    d: "Send to a loan-scoped address. SOL hits your wallet when the deposit confirms — usually under ten seconds.",
  },
  {
    n: "04",
    t: "Manage or repay",
    d: "Top-up, partial-repay, or extend anytime. Repay fully to reclaim your bag. Alerts fire at 90% health and 24h-to-due.",
  },
];

const TIERS = [
  {
    name: "Express",
    days: "2 days",
    ltv: "30%",
    fee: "1.5%",
    best: "Degens catching a pump",
    points: ["Highest LTV available", "Fastest turnaround", "Short-term conviction"],
    highlight: true,
  },
  {
    name: "Quick",
    days: "3 days",
    ltv: "25%",
    fee: "1.5%",
    best: "Weekend trades",
    points: ["Balanced risk profile", "Room for volatility", "Most popular"],
    highlight: false,
  },
  {
    name: "Standard",
    days: "7 days",
    ltv: "20%",
    fee: "1.5%",
    best: "Patient holders",
    points: ["Most headroom to liquidation", "Week-long runway", "Lowest stress"],
    highlight: false,
  },
];

const PILLARS = [
  {
    title: "Non-custodial",
    body: "Loan-scoped deposit addresses. Your other holdings are untouchable. Export your keys anytime.",
  },
  {
    title: "Transparent pricing",
    body: "One flat 1.5% origination fee. No hidden rate curves, no dynamic APR, no variable haircuts.",
  },
  {
    title: "Liquidation-safe",
    body: "Only the pledged bag can be liquidated — never your wallet. On-chain, auditable, deterministic.",
  },
  {
    title: "Telegram-native",
    body: "No new app. No extension. No seed phrase in a browser tab. Just a chat and a confirm button.",
  },
];

const FAQ = [
  {
    q: "What is LTV and how does it work?",
    a: "LTV stands for Loan-to-Value — it's the percentage of your collateral's dollar value that you receive as a SOL loan. For example, if you deposit $1,000 worth of WIF at 30% LTV, you receive $300 in SOL. Lower LTV means you borrow less but have more safety margin before liquidation. Higher LTV gives you more SOL upfront but leaves less room for price drops.",
  },
  {
    q: "What tokens can I pledge?",
    a: "We accept 64+ Solana memecoins including WIF, BONK, Fartcoin, Moo Deng, GOAT, and many more. Check our Approved Tokens page for the full list with live prices and market data. Don't see your bag? You can request a new listing directly from that page.",
  },
  {
    q: "What happens if the price drops?",
    a: "Your loan has a health ratio that tracks your collateral's value against what you owe. You get alerts at 90% health and 24 hours before the due date. You can top-up more collateral, partial-repay, or extend — all in the chat. If health drops below 1.1x (meaning your collateral is worth only 10% more than your debt), the position is liquidated on-chain.",
  },
  {
    q: "How is my loan amount calculated?",
    a: "Magpie uses real-time oracle prices (via Jupiter) to value your collateral in SOL. Your payout = collateral value × LTV tier percentage, minus the 1.5% origination fee. For example: 10,000 WIF at $0.50 each = $5,000 collateral. At 30% LTV that's $1,500 in SOL, minus the 1.5% fee.",
  },
  {
    q: "How fast is this really?",
    a: "A typical end-to-end flow is under 30 seconds. The SOL payout lands as soon as your deposit confirms on Solana mainnet, usually in 8–12 seconds.",
  },
  {
    q: "Do I need to lock the full collateral upfront?",
    a: "Yes — collateral funds the loan. But you can add more anytime to improve your health ratio, or partial-repay to reduce what you owe.",
  },
  {
    q: "Is this custodial?",
    a: "No. Magpie generates a fresh deposit address per loan. You can export the private key from the bot at any time. We never hold your other assets.",
  },
  {
    q: "What's the smart contract?",
    a: "An Anchor program deployed on Solana mainnet. Source is publicly auditable. Liquidations and fee flows are deterministic and enforced on-chain.",
  },
];

const MARQUEE = [
  "No credit check",
  "Non-custodial",
  "1.5% flat fee",
  "Repay anytime",
  "Top-up anytime",
  "Live health alerts",
  "On-chain liquidation",
  "Solana mainnet",
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Wordmark size={28} />
          </div>
          <nav className="flex items-center gap-6">
            <a href="#how" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] lg:inline">
              How it works
            </a>
            <Link href="/tokens" className="hidden text-sm font-semibold text-[var(--accent-deep)] transition hover:text-[var(--accent)] md:inline">
              Tokens
            </Link>
            <Link href="/calculate" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Calculator
            </Link>
            <Link href="/credit" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Credit
            </Link>
            <Link href="/marketplace" className="hidden text-sm font-semibold text-[var(--accent-deep)] transition hover:text-[var(--accent)] lg:inline">
              Marketplace
            </Link>
            <Link href="/dashboard" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] lg:inline">
              Dashboard
            </Link>
            <Link href="/docs" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] lg:inline">
              Docs
            </Link>
            <ConnectWallet variant="ghost" className="hidden md:flex" />
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-28 md:pt-28 md:pb-36">
          <div className="fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span className="text-[var(--ink)]">Live on Solana mainnet</span>
          </div>

          <h1 className="fade-up fade-up-1 font-display max-w-5xl text-[clamp(3rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.04em] font-medium">
            Borrow SOL.
            <br />
            Keep your <span className="italic">bag</span>.
          </h1>

          <p className="fade-up fade-up-2 mt-8 max-w-xl text-xl text-[var(--ink-soft)] leading-relaxed">
            Memecoin-collateralized lending, delivered in a Telegram chat. Pledge your bag, get SOL in seconds, repay on your schedule.
          </p>

          <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center gap-4">
            <a href={TELEGRAM_URL} className="btn-accent text-base">
              Launch on Telegram
              <span aria-hidden>→</span>
            </a>
            <Link href="/calculate" className="btn-ghost text-base">
              Loan calculator
            </Link>
            <Link href="/tokens" className="btn-ghost text-base">
              Browse 64+ tokens
            </Link>
          </div>

          <div className="fade-up fade-up-4 mt-16 grid max-w-3xl grid-cols-3 gap-0 divide-x divide-[var(--hairline)] rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            {[
              { v: "<10s", l: "Funded" },
              { v: "1.5%", l: "Flat fee" },
              { v: "30%", l: "Max LTV ratio" },
            ].map((s) => (
              <div key={s.l} className="px-4 py-5 text-center md:px-6">
                <div className="font-display tabular text-3xl font-medium tracking-[-0.03em] md:text-4xl">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Floating mark */}
          <div className="pointer-events-none absolute right-8 top-32 hidden opacity-90 lg:block">
            <div className="hop">
              <Mark size={240} />
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-10 md:flex-row md:justify-between">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--ink-soft)]">
            Built on
          </div>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
            <EcoLogo label="Solana" />
            <EcoLogo label="Anchor" />
            <EcoLogo label="Pyth" />
            <EcoLogo label="Jupiter" />
            <EcoLogo label="Telegram" />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section className="overflow-hidden border-b border-[var(--hairline)] bg-[var(--accent)]">
        <div className="flex marquee whitespace-nowrap py-5 text-[var(--ink)] font-semibold tracking-tight">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="flex items-center gap-6 px-6 text-lg">
              {item}
              <span aria-hidden className="opacity-30">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* Approved tokens callout */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <Reveal>
          <Link
            href="/tokens"
            className="group flex flex-col gap-6 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--accent)] hover:shadow-lg md:flex-row md:items-center md:justify-between md:p-10"
          >
            <div>
              <div className="chip mb-3">Accepted collateral</div>
              <h3 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                64+ approved tokens
              </h3>
              <p className="mt-2 max-w-lg text-base text-[var(--ink-soft)] leading-relaxed">
                From WIF and BONK to Fartcoin and Moo Deng — browse the full list with live prices, market caps, and 24h performance. Don&apos;t see your bag? Request a new listing.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-lg font-semibold text-[var(--accent-deep)] transition group-hover:text-[var(--accent)]">
              View all tokens
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* Credit + Points callout */}
      <section className="mx-auto max-w-6xl px-6 pb-8 space-y-5">
        <Reveal>
          <Link
            href="/credit"
            className="group flex flex-col gap-6 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--accent)] hover:shadow-lg md:flex-row md:items-center md:justify-between md:p-10"
          >
            <div>
              <div className="chip mb-3">New</div>
              <h3 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                Build your DeFi credit score
              </h3>
              <p className="mt-2 max-w-lg text-base text-[var(--ink-soft)] leading-relaxed">
                The first on-chain credit system for memecoin lending. Repay on time, level up, and unlock better LTV rates, lower fees, and longer terms.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-lg font-semibold text-[var(--accent-deep)] transition group-hover:text-[var(--accent)]">
              Learn more
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </Reveal>
        <Reveal delay={80}>
          <Link
            href="/points"
            className="group flex flex-col gap-6 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--accent)] hover:shadow-lg md:flex-row md:items-center md:justify-between md:p-10"
          >
            <div>
              <div className="chip mb-3">Rewards</div>
              <h3 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                Earn points on every loan
              </h3>
              <p className="mt-2 max-w-lg text-base text-[var(--ink-soft)] leading-relaxed">
                Bigger loans, riskier tiers, early repayments, and streaks all multiply your rewards. Accumulate now — redemptions coming soon.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-lg font-semibold text-[var(--accent-deep)] transition group-hover:text-[var(--accent)]">
              See how it works
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-28 md:py-40">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="chip mb-5">How it works</div>
              <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
                Four taps.
                <br />
                <span className="italic text-[var(--ink-soft)]">You&apos;re funded.</span>
              </h2>
            </div>
            <p className="max-w-md text-lg text-[var(--ink-soft)] leading-relaxed">
              Magpie wraps a Solana lending program in a Telegram bot. Pledge memecoins as collateral, receive SOL instantly, repay on your own schedule.
            </p>
          </div>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 gap-14 md:grid-cols-2 md:items-center md:gap-20">
          <Reveal className="order-2 md:order-1">
            <div className="flex flex-col gap-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className="group flex gap-5 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 transition hover:border-[var(--ink)] hover:shadow-sm md:p-6"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] font-mono text-sm font-semibold text-[var(--ink-soft)] group-hover:bg-[var(--accent)] group-hover:text-[var(--ink)] transition">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-lg font-semibold tracking-tight">{s.t}</div>
                    <div className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {s.d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="order-1 md:order-2" delay={150}>
            <PhoneMock />
            <div className="mt-6 text-center">
              <Link href="/demo" className="text-sm font-medium text-[var(--ink-soft)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
                Watch the full interactive demo →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why Magpie — pillars */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Why Magpie</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
              The <span className="italic">quiet</span> lender for loud bags.
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="flex h-full flex-col gap-3 bg-[var(--bg-elevated)] p-8 md:p-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--ink)]">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-xl font-semibold tracking-tight">{p.title}</div>
                  </div>
                  <div className="text-base leading-relaxed text-[var(--ink-soft)]">
                    {p.body}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Lending tiers */}
      <section id="tiers" className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-40">
          <Reveal>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="chip mb-5">Lending tiers</div>
                <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
                  Pick your risk.
                  <br />
                  <span className="italic text-[var(--ink-soft)]">Pick your payout.</span>
                </h2>
              </div>
              <div className="max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
                <p>LTV (Loan-to-Value) is the percentage of your collateral&apos;s value you receive as SOL. Higher LTV = more SOL, but less room before liquidation.</p>
                <p className="mt-3 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-4 py-3 text-sm">
                  <span className="font-semibold text-[var(--ink)]">Example:</span> $1,000 of WIF at 30% LTV = <span className="font-semibold text-[var(--ink)]">$300 in SOL</span>, minus 1.5% fee.
                </p>
              </div>
            </div>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 100}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-8 transition ${
                    tier.highlight
                      ? "border-[var(--ink)] bg-[var(--bg-elevated)] shadow-[0_30px_80px_-30px_rgba(30,22,0,0.3)]"
                      : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--ink)] hover:shadow-md"
                  }`}
                >
                  {tier.highlight && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)] shadow-sm">
                      Most SOL
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="font-display text-3xl font-medium tracking-[-0.02em]">{tier.name}</div>
                  </div>
                  <div className="mt-8 flex items-baseline gap-2">
                    <div className="font-display tabular text-7xl font-medium tracking-[-0.04em]">{tier.ltv}</div>
                    <div className="text-sm text-[var(--ink-soft)]">LTV</div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--ink-soft)]">
                    {tier.days} · {tier.fee} flat fee
                  </div>
                  <div className="mt-8 border-t border-[var(--hairline)] pt-6">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                      Best for
                    </div>
                    <div className="mt-1.5 text-base font-medium">{tier.best}</div>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {tier.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
                        <span aria-hidden className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--ink)]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div className="text-sm leading-relaxed text-[var(--ink-soft)]">
                <span className="font-semibold text-[var(--ink)]">Every tier includes</span> non-custodial deposit, partial-repay anytime, extend for 1.5%, and live health alerts. Works with <Link href="/tokens" className="font-semibold text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">64+ approved tokens</Link>.
              </div>
              <a href={TELEGRAM_URL} className="btn-dark text-sm">
                Get a quote →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-28 md:py-40">
        <Reveal>
          <div className="chip mb-5">Questions</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            What you&apos;ll want to know.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={(i % 2) * 80}>
              <div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-[var(--accent-deep)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-xl font-semibold tracking-tight">{item.q}</div>
                </div>
                <div className="mt-3 pl-9 text-base leading-relaxed text-[var(--ink-soft)]">
                  {item.a}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
          <Mark size={80} className="mx-auto mb-10 hop" />
          <h2 className="font-display mx-auto max-w-4xl text-6xl font-medium tracking-[-0.04em] text-white md:text-8xl">
            Your bag&apos;s worth
            <br />
            <span className="italic text-[var(--accent)]">more liquid.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-white/70">
            Stop selling the bottom. Stop missing entries. Borrow against what you hold.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-lg">
              Open @magpie_capital_bot
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Browse approved tokens
            </Link>
            <Link
              href="/credit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Build your credit
            </Link>
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
              <FooterLink href="/tokens">Approved Tokens</FooterLink>
              <FooterLink href="/calculate">Loan Calculator</FooterLink>
              <FooterLink href="/credit">Credit System</FooterLink>
              <FooterLink href="/points">Points</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href="/demo">Demo</FooterLink>
            </FooterCol>
            <FooterCol title="Resources">
              <FooterLink href="/docs">Documentation</FooterLink>
              <FooterLink href="/whitepaper">Whitepaper</FooterLink>
              <FooterLink href="/security">Security</FooterLink>
              <FooterLink href="/changelog">Changelog</FooterLink>
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="#faq">FAQ</FooterLink>
            </FooterCol>
            <FooterCol title="Community">
              <FooterLink href={X_URL}>X / Twitter</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
              <FooterLink href="https://github.com/magpiecapital">GitHub</FooterLink>
            </FooterCol>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--hairline)] pt-6 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              © {new Date().getFullYear()} Magpie · Built on Solana
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

function EcoLogo({ label }: { label: string }) {
  return (
    <div className="font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink-soft)] opacity-70 transition hover:opacity-100">
      {label}
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
  return (
    <a href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
      {children}
    </a>
  );
}
