import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { PhoneMock } from "@/components/PhoneMock";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CountUp } from "@/components/CountUp";
import { TokenMarquee } from "@/components/TokenMarquee";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const TOKEN_COUNT = TOKEN_REGISTRY.length;

/* ─── Data ─── */

const PROTOCOL_FEATURES = [
  {
    title: "Permissionless pools",
    desc: "Anyone can supply SOL to the lending pool and earn yield from loan origination fees. Share-based accounting — deposit, withdraw, compound.",
    icon: "◉",
  },
  {
    title: "On-chain credit oracle",
    desc: "The first DeFi credit system. Every repayment builds a 300–850 score, stored on-chain. Better score unlocks better LTV and lower fees over time.",
    icon: "★",
  },
  {
    title: "Keeper network",
    desc: "Liquidations are permissionless. Any wallet can execute an overdue liquidation and earn a bounty — no staking required, no gatekeepers.",
    icon: "⚡",
  },
  {
    title: "Tokenized stock collateral",
    desc: "Borrow against real equities on Solana. xTSLA, xNVDA, xAAPL, and more via tokens.xyz — the first lending protocol to accept both memecoins and stocks.",
    icon: "◈",
  },
];

const THREE_SIDES = [
  {
    chip: "Borrow",
    title: `${TOKEN_COUNT} tokens accepted`,
    desc: "Pledge memecoins or tokenized stocks, pick a tier, get SOL in seconds. Non-custodial, on-chain, delivered in a Telegram chat.",
    href: "/tokens",
    cta: "Browse tokens",
  },
  {
    chip: "Earn",
    title: "Supply & earn yield",
    desc: "Deposit SOL into the permissionless lending pool. Earn a share of every loan fee, proportional to your deposit. Withdraw anytime.",
    href: "/earn",
    cta: "Start earning",
  },
  {
    chip: "Reputation",
    title: "On-chain credit scores",
    desc: "Every repayment builds your score (300–850). Higher scores unlock better rates. First portable DeFi credit system — your history, on-chain.",
    href: "/credit",
    cta: "Credit system",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Open @magpie_capital_bot",
    d: "Start a chat. Connect your wallet. No seed phrase — keys stay yours.",
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
    d: "Top-up, partial-repay, or extend anytime. Repay fully to reclaim your bag. Alerts fire at 90% health.",
  },
];

const TIERS = [
  {
    name: "Express",
    days: "2 days",
    ltv: "30%",
    fee: "3%",
    best: "Fast cash, premium rate",
    points: ["Highest LTV — borrow more", "2-day turnaround", "Higher fee offsets higher risk"],
    highlight: false,
  },
  {
    name: "Quick",
    days: "3 days",
    ltv: "25%",
    fee: "2%",
    best: "Balanced speed & value",
    points: ["Mid-range LTV", "3-day runway", "Most popular tier"],
    highlight: true,
  },
  {
    name: "Standard",
    days: "7 days",
    ltv: "20%",
    fee: "1.5%",
    best: "Best rate, more time to repay",
    points: ["Lowest fee available", "Full week to repay", "Most headroom to liquidation"],
    highlight: false,
  },
];

const PILLARS = [
  {
    title: "Non-custodial",
    body: "Loan-scoped deposit addresses. Your other holdings are untouchable. Collateral held in on-chain vaults, not our wallets.",
  },
  {
    title: "Transparent pricing",
    body: "Tiered fees: 3% Express, 2% Quick, 1.5% Standard. No hidden rate curves, no dynamic APR, no liquidation penalties beyond what you pledged.",
  },
  {
    title: "Permissionless",
    body: "Anyone can supply liquidity. Anyone can run a keeper. Anyone can build on top. No gatekeepers, no whitelists, open protocol.",
  },
  {
    title: "Telegram-native",
    body: "No new app. No extension. No seed phrase in a browser tab. Borrow SOL in a chat — the whole flow takes under 30 seconds.",
  },
];

const FAQ = [
  {
    q: "What is LTV and how does it work?",
    a: "LTV stands for Loan-to-Value — the percentage of your collateral's dollar value you receive as SOL. $1,000 of WIF at 30% LTV = $300 in SOL. Lower LTV = less SOL but more safety margin.",
  },
  {
    q: "What tokens can I pledge?",
    a: `${TOKEN_COUNT} tokens — ${TOKEN_REGISTRY.filter(t => t.category === "memecoin").length} memecoins (WIF, BONK, Fartcoin, POPCAT, and more) plus ${TOKEN_REGISTRY.filter(t => t.category === "stock").length} tokenized stocks (xTSLA, xNVDA, xAAPL, xGOOGL, xAMZN, xMSFT, xMETA, xMSTR, xCOIN). Check the Approved Tokens page for the full list.`,
  },
  {
    q: "What happens if the price drops?",
    a: "Your loan has a health ratio tracking collateral value vs. debt. You get alerts at 90% health. You can top-up or partial-repay. If health drops below threshold, the position is liquidated on-chain by the keeper network.",
  },
  {
    q: "How do I earn yield?",
    a: "Deposit SOL into the lending pool on the Earn page. You receive pool shares. When borrowers pay fees, the pool grows and your shares are worth more. Withdraw anytime — no lockups.",
  },
  {
    q: "What is the credit oracle?",
    a: "An on-chain program (BBYtty9...) that tracks a 300–850 credit score per wallet. Every on-time repayment increases your score. Higher scores will unlock better LTV ratios and lower fees.",
  },
  {
    q: "What is the keeper network?",
    a: "Liquidations are permissionless. When a loan becomes overdue, any wallet can execute the liquidation and earn a bounty (configurable, up to 20% of seized collateral). No staking required.",
  },
  {
    q: "Is this custodial?",
    a: "No. Collateral sits in on-chain vaults governed by the Anchor program, not in anyone's wallet. The smart contract is publicly auditable and deterministic.",
  },
  {
    q: "What's the smart contract?",
    a: "magpie-lending — an Anchor program on Solana (7tapn...). Permissionless lending pools with share-based accounting, configurable keeper rewards, and tiered fee structure. 68 tests passing.",
  },
];

const MARQUEE = [
  "Permissionless pools",
  "Non-custodial",
  "On-chain credit scores",
  `${TOKEN_COUNT} approved tokens`,
  "Keeper network",
  "Tokenized stocks",
  "1.5–3% tiered fee",
  "Repay anytime",
  "Live health alerts",
  "Solana mainnet",
];

/* ─── Page ─── */

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* ══════════ HERO ══════════ */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:px-6 md:pt-28 md:pb-36">
          <div className="fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span className="text-[var(--ink)]">Live on Solana mainnet</span>
          </div>

          <h1 className="fade-up fade-up-1 font-display max-w-5xl text-[clamp(3rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.04em] font-medium">
            Borrow SOL.
            <br />
            <span className="italic">Keep your bag.</span>
          </h1>

          <p className="fade-up fade-up-2 mt-5 max-w-xl text-base text-[var(--ink-soft)] leading-relaxed sm:mt-8 sm:text-xl">
            Permissionless lending protocol on Solana. Pledge memecoins or tokenized stocks as collateral, get SOL in seconds — all in a Telegram chat. Every repayment builds your on-chain credit score.
          </p>

          <div className="fade-up fade-up-3 mt-8 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
            <a href={TELEGRAM_URL} className="btn-accent shimmer text-sm sm:text-base">
              Start borrowing
              <span aria-hidden>→</span>
            </a>
            <Link href="/earn" className="btn-ghost text-sm sm:text-base">
              Earn yield
            </Link>
            <Link href="/tokens" className="btn-ghost text-sm sm:text-base">
              {TOKEN_COUNT} approved tokens
            </Link>
          </div>

          <div className="fade-up fade-up-4 mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] shadow-sm sm:grid-cols-4 md:mt-16">
            <div className="bg-[var(--bg-elevated)] px-4 py-4 text-center md:px-6 md:py-5">
              <div className="font-display tabular text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl"><CountUp value={TOKEN_COUNT} /></div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">Tokens you can borrow against</div>
            </div>
            <div className="bg-[var(--bg-elevated)] px-4 py-4 text-center md:px-6 md:py-5">
              <div className="font-display tabular text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">1.5–3%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">Flat fee per loan</div>
            </div>
            <div className="bg-[var(--bg-elevated)] px-4 py-4 text-center md:px-6 md:py-5">
              <div className="font-display tabular text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">&lt;10s</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">SOL in your wallet</div>
            </div>
            <div className="bg-[var(--bg-elevated)] px-4 py-4 text-center md:px-6 md:py-5">
              <div className="font-display tabular text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">100%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">Non-custodial &amp; on-chain</div>
            </div>
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
            Built with
          </div>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
            <EcoLogo label="Solana" />
            <EcoLogo label="Anchor" />
            <EcoLogo label="Jupiter" />
            <EcoLogo label="tokens.xyz" />
            <EcoLogo label="Telegram" />
          </div>
        </div>
      </section>

      {/* Elevator pitch */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-6 md:py-32">
        <Reveal>
          <p className="font-display text-xl font-medium leading-relaxed tracking-[-0.02em] text-[var(--ink)] sm:text-2xl md:text-4xl md:leading-[1.4]">
            Magpie is a permissionless lending protocol on Solana. Anyone can
            {" "}<span className="italic text-[var(--accent-deep)]">supply liquidity</span>{" "}
            to earn yield. Anyone can
            {" "}<span className="italic text-[var(--accent-deep)]">borrow SOL</span>{" "}
            against memecoins and tokenized stocks. And anyone can
            {" "}<span className="italic text-[var(--accent-deep)]">run a keeper</span>{" "}
            to earn bounties on liquidations. Every repayment builds your on-chain credit score.
          </p>
        </Reveal>
      </section>

      {/* Token logo marquee */}
      <section className="overflow-hidden border-b border-[var(--hairline)] bg-[var(--surface)] py-5">
        <div className="mb-3 text-center text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
          Accepted collateral
        </div>
        <TokenMarquee />
      </section>

      {/* Feature marquee */}
      <section className="overflow-hidden border-b border-[var(--hairline)] bg-[var(--accent)]">
        <div className="flex marquee whitespace-nowrap py-4 text-[var(--ink)] font-semibold tracking-tight">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="flex items-center gap-6 px-6 text-base">
              {item}
              <span aria-hidden className="opacity-30">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* ══════════ THE PROTOCOL ══════════ */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-36">
          <Reveal>
            <div className="chip mb-4 md:mb-5">The protocol</div>
            <h2 className="font-display max-w-4xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-7xl">
              Open infrastructure.
              <br />
              <span className="italic text-[var(--ink-soft)]">No gatekeepers.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed sm:mt-6 sm:text-lg">
              An Anchor program on Solana that powers permissionless lending pools, an on-chain credit oracle, and a keeper network for liquidations.
              Every constraint is enforced by the smart contract — not by us.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
            {PROTOCOL_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="flex h-full flex-col gap-3 bg-[var(--bg-elevated)] p-6 sm:p-8 md:p-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-dim)] text-base text-[var(--accent-deep)] sm:h-10 sm:w-10 sm:text-lg">
                      {f.icon}
                    </div>
                    <div className="text-lg font-semibold tracking-tight sm:text-xl">{f.title}</div>
                  </div>
                  <div className="text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
                    {f.desc}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Protocol code snippet */}
          <Reveal delay={200}>
            <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[#0e1621]">
              <div className="flex items-center justify-between border-b border-white/5 bg-[#17212b] px-5 py-3">
                <span className="font-mono text-[11px] font-semibold text-white/80">magpie-lending</span>
                <span className="text-[10px] text-white/40">Anchor program on Solana</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-white/70 sm:p-5 sm:text-[12px]">
{`// Permissionless liquidation — any wallet can be a keeper
pub fn liquidate_loan(ctx: Context<LiquidateLoan>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let loan = &mut ctx.accounts.loan;

    // Verify loan is overdue
    require!(Clock::get()?.unix_timestamp > loan.due_timestamp,
        LendingError::LoanNotDue);

    // Split collateral: keeper bounty + authority remainder
    let keeper_reward = collateral_balance
        .checked_mul(pool.keeper_reward_bps as u64)
        .unwrap() / 10_000;
    // Transfer reward to keeper, remainder to pool authority
    ...
}`}
              </pre>
            </div>
          </Reveal>

          {/* On-chain proof */}
          <Reveal delay={220}>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 md:grid-cols-2">
              <a
                href="https://solscan.io/account/7tapneCmNwRVEtdeZks4649Q2rf8W1t9tshMN9yHX99P"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-dim)] text-lg text-[var(--accent-deep)]">
                  ◉
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">magpie-lending</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--ink-faint)]">7tapneCmNwRVEtdeZks4649Q2rf8W1t9tshMN9yHX99P</div>
                </div>
                <span className="text-xs font-medium text-[var(--accent-deep)] opacity-0 transition group-hover:opacity-100">Solscan →</span>
              </a>
              <a
                href="https://solscan.io/account/BBYtty9sqWjHzTuoXSNfDCpNtLn6ZjfSfhYEoY6MFP2E"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-dim)] text-lg text-[var(--accent-deep)]">
                  ★
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">magpie-credit-oracle</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--ink-faint)]">BBYtty9sqWjHzTuoXSNfDCpNtLn6ZjfSfhYEoY6MFP2E</div>
                </div>
                <span className="text-xs font-medium text-[var(--accent-deep)] opacity-0 transition group-hover:opacity-100">Solscan →</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/docs" className="btn-accent text-base">
                Read the docs
                <span aria-hidden>→</span>
              </Link>
              <Link href="/earn" className="btn-ghost text-base">
                Supply liquidity
              </Link>
              <Link href="/stats" className="btn-ghost text-base">
                Protocol stats
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ THREE SIDES ══════════ */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-36">
        <Reveal>
          <div className="chip mb-4 md:mb-5">The marketplace</div>
          <h2 className="font-display max-w-4xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-7xl">
            Borrow. Earn.
            <br />
            <span className="italic text-[var(--ink-soft)]">Build your score.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed sm:mt-6 sm:text-lg">
            Three sides of a permissionless lending marketplace — all governed on-chain, all accessible from day one.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {THREE_SIDES.map((s, i) => (
            <Reveal key={s.chip} delay={i * 80}>
              <Link
                href={s.href}
                className="group flex h-full flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--accent)] hover:shadow-lg sm:rounded-3xl sm:p-8"
              >
                <div className="chip mb-3">{s.chip}</div>
                <h3 className="font-display text-2xl font-medium tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm text-[var(--ink-soft)] leading-relaxed">
                  {s.desc}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[var(--accent-deep)] group-hover:text-[var(--accent)]">
                  {s.cta} <span aria-hidden className="transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-40">
        <Reveal>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
            <div>
              <div className="chip mb-4 md:mb-5">How it works</div>
              <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-7xl">
                Four taps.
                <br />
                <span className="italic text-[var(--ink-soft)]">You&apos;re funded.</span>
              </h2>
            </div>
            <p className="max-w-md text-base text-[var(--ink-soft)] leading-relaxed sm:text-lg">
              The Telegram bot wraps the on-chain program in a conversational interface. Pledge collateral, receive SOL, repay on your schedule.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:mt-20 md:grid-cols-2 md:items-center md:gap-20">
          <Reveal className="order-2 md:order-1">
            <div className="flex flex-col gap-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className="group flex gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 transition hover:border-[var(--ink)] hover:shadow-sm sm:gap-5 sm:p-5 md:p-6"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] font-mono text-sm font-semibold text-[var(--ink-soft)] group-hover:bg-[var(--accent)] group-hover:text-[var(--ink)] transition">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight sm:text-lg">{s.t}</div>
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
              <a href={TELEGRAM_URL} className="text-sm font-medium text-[var(--ink-soft)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
                Try it live on Telegram →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ WHY MAGPIE ══════════ */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-36">
          <Reveal>
            <div className="chip mb-4 md:mb-5">Why Magpie</div>
            <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-6xl">
              The <span className="italic">quiet</span> lender for loud bags.
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] sm:mt-16 sm:rounded-3xl md:grid-cols-2">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="flex h-full flex-col gap-3 bg-[var(--bg-elevated)] p-6 sm:p-8 md:p-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--ink)]">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-lg font-semibold tracking-tight sm:text-xl">{p.title}</div>
                  </div>
                  <div className="text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
                    {p.body}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ LENDING TIERS ══════════ */}
      <section id="tiers" className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-40">
          <Reveal>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
              <div>
                <div className="chip mb-4 md:mb-5">Lending tiers</div>
                <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-7xl">
                  Pick your risk.
                  <br />
                  <span className="italic text-[var(--ink-soft)]">Pick your payout.</span>
                </h2>
              </div>
              <div className="max-w-md text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
                <p>LTV (Loan-to-Value) is the percentage of your collateral&apos;s value you receive as SOL. Higher LTV = more SOL, but less room before liquidation.</p>
                <p className="mt-3 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2.5 text-sm sm:px-4 sm:py-3">
                  <span className="font-semibold text-[var(--ink)]">Example:</span> $1,000 of WIF at 20% LTV = <span className="font-semibold text-[var(--ink)]">$200 in SOL</span>, minus 1.5% fee. Choose Express (30% LTV) to borrow $300, at a 3% fee.
                </p>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-16 sm:gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 100}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-6 transition sm:rounded-3xl sm:p-8 ${
                    tier.highlight
                      ? "border-[var(--ink)] bg-[var(--bg-elevated)] shadow-[0_30px_80px_-30px_rgba(30,22,0,0.3)]"
                      : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--ink)] hover:shadow-md"
                  }`}
                >
                  {tier.highlight && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)] shadow-sm">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="font-display text-2xl font-medium tracking-[-0.02em] sm:text-3xl">{tier.name}</div>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2 sm:mt-8">
                    <div className="font-display tabular text-5xl font-medium tracking-[-0.04em] sm:text-7xl">{tier.ltv}</div>
                    <div className="text-sm text-[var(--ink-soft)]">LTV</div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--ink-soft)]">
                    {tier.days} · {tier.fee} fee
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
                <span className="font-semibold text-[var(--ink)]">Every tier includes</span> non-custodial deposit, partial-repay anytime, extend at your tier&apos;s fee rate, live health alerts, and credit score accrual. Works with <Link href="/tokens" className="font-semibold text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">{TOKEN_COUNT} approved tokens</Link>.
              </div>
              <a href={TELEGRAM_URL} className="btn-dark shrink-0 text-sm">
                Get a quote →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-40">
        <Reveal>
          <div className="chip mb-4 md:mb-5">Questions</div>
          <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl md:text-6xl">
            What you&apos;ll want to know.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-x-16 gap-y-8 sm:mt-16 sm:gap-y-10 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={(i % 2) * 80}>
              <div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-[var(--accent-deep)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-base font-semibold tracking-tight sm:text-xl">{item.q}</div>
                </div>
                <div className="mt-2 pl-9 text-sm leading-relaxed text-[var(--ink-soft)] sm:mt-3 sm:text-base">
                  {item.a}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ CLOSING CTA ══════════ */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:px-6 md:py-40">
          <Mark size={64} className="mx-auto mb-8 hop sm:mb-10" />
          <h2 className="font-display mx-auto max-w-4xl text-4xl font-medium tracking-[-0.04em] text-white sm:text-6xl md:text-8xl">
            Your bags.
            <br />
            <span className="italic text-[var(--accent)]">Your liquidity.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/70 sm:mt-6 sm:text-lg">
            Borrow SOL. Earn yield. Build your credit score. All permissionless, all on Solana.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-12 sm:gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-base sm:text-lg">
              Start borrowing
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/earn"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Earn yield
            </Link>
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Browse tokens
            </Link>
          </div>
        </div>
      </section>

      <Footer />
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
