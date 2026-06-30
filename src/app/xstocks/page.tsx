import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

export const metadata: Metadata = {
  title: "Borrow against tokenized stocks | Magpie",
  description:
    "Lend SOL against your tokenized US stocks on Solana. 13 xStocks approved. Weekend-cutoff origination, 5-layer scam protection. Higher-LTV RWA tiers (50/60/70%) ship with v3.",
  openGraph: {
    title: "Borrow against tokenized stocks | Magpie",
    description:
      "Tokenized stocks as collateral on Solana. Weekend-cutoff origination so oracle gaps don't liquidate you. Built for tokenized stocks, not retrofitted. Higher-LTV RWA tiers shipping with v3.",
  },
};

const BLUE_CHIP = [
  { sym: "SPYx",   name: "S&P 500" },
  { sym: "QQQx",   name: "Nasdaq 100" },
  { sym: "GLDx",   name: "Gold" },
  { sym: "NVDAx",  name: "NVIDIA" },
  { sym: "TSLAx",  name: "Tesla" },
  { sym: "GOOGLx", name: "Alphabet" },
  { sym: "MSFTx",  name: "Microsoft" },
  { sym: "METAx",  name: "Meta" },
  { sym: "AMZNx",  name: "Amazon" },
];

const CRYPTO_ADJACENT = [
  { sym: "COINx",  name: "Coinbase" },
  { sym: "MSTRx",  name: "MicroStrategy" },
  { sym: "HOODx",  name: "Robinhood" },
  { sym: "CRCLx",  name: "Circle" },
];

const SAFETY_LAYERS = [
  {
    title: "Canonical mint pinning",
    body: "Every approved ticker has its mint address locked in a DB-level constraint. A scam token claiming to be 'SPYx' with a different mint cannot be inserted — the database rejects it.",
  },
  {
    title: "Pump.fun suffix block",
    body: "Memecoin mints can structurally never be classified as stock / ETF / metal. The category gate fails closed on every code path — onboarding scripts, manual SQL, future classifiers.",
  },
  {
    title: "Token-2022 extension authority allowlist",
    body: "Every Token-2022 extension authority on an approved RWA is allowlisted against the issuer's verified addresses. A scam that copies the extension shape but uses different authorities is rejected at audit time.",
  },
  {
    title: "Mint authority issuer verification",
    body: "The mint authority on every approved RWA is verified against the issuer's published address (Backed Finance for current xStocks). Any new ticker requires explicit operator opt-in.",
  },
  {
    title: "ScaledUiAmount-aware math",
    body: "Backed reinvests dividends and applies stock splits via the on-chain multiplier rather than rebasing user balances. The bot reads the live multiplier from the mint and adjusts collateral value at every health check.",
  },
];

export default function XStocksPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-8 sm:px-6 md:pt-24 md:pb-16">
          <Reveal>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-medium shadow-sm sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[var(--ink-faint)]">13 xStocks approved · vol-aware LTV</span>
            </div>
            <h1 className="font-display text-[2.25rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-7xl">
              Borrow SOL against your tokenized stocks.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-lg">
              Two LTV tiers calibrated to actual realized volatility. Weekend-cutoff
              origination so oracle gaps don&apos;t liquidate you. Built for tokenized
              stocks, not retrofitted from a memecoin lender.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── The two-tier LTV split (the headline) ── */}
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-6">
        <Reveal>
          <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
              Two LTV tiers, not one
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              Calibrated to 90-day realized vol
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="card card-hover h-full p-5 sm:p-7">
              <div className="flex flex-wrap items-baseline gap-2 mb-3">
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200">
                  Blue-chip
                </span>
                <span className="text-[11px] text-[var(--ink-faint)]">9 names</span>
              </div>
              <div className="font-display tabular text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
                50% <span className="text-2xl text-[var(--ink-soft)] sm:text-3xl">max LTV</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Index ETFs (SPYx, QQQx), gold (GLDx), and mega-cap tech (NVDAx, TSLAx,
                GOOGLx, MSFTx, METAx, AMZNx). Mean 90-day realized vol: 32%. Zero
                single-day 10%+ moves across the basket over the trailing quarter.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-1.5 sm:grid-cols-3">
                {BLUE_CHIP.map((t) => (
                  <div
                    key={t.sym}
                    className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-2.5 text-center"
                  >
                    <div className="font-mono text-[11px] font-semibold text-[var(--ink)] sm:text-xs">
                      {t.sym}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--ink-faint)] sm:text-[10px]">
                      {t.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="card card-hover h-full p-5 sm:p-7">
              <div className="flex flex-wrap items-baseline gap-2 mb-3">
                <span className="rounded-md bg-amber-500/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-100">
                  Crypto-adjacent
                </span>
                <span className="text-[11px] text-[var(--ink-faint)]">4 names</span>
              </div>
              <div className="font-display tabular text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
                30% <span className="text-2xl text-[var(--ink-soft)] sm:text-3xl">max LTV</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Coinbase, MicroStrategy, Robinhood, Circle. Mean 90-day vol: 79%. Their
                fundamentals are crypto exposure — they trade like equities but realize
                memecoin volatility. Same LTV as a blue-chip would get borrowers liquidated.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {CRYPTO_ADJACENT.map((t) => (
                  <div
                    key={t.sym}
                    className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-2.5 text-center"
                  >
                    <div className="font-mono text-[11px] font-semibold text-[var(--ink)] sm:text-xs">
                      {t.sym}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--ink-faint)] sm:text-[10px]">
                      {t.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The volatility math behind the split ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <Reveal>
            <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
                Why two tiers? The vol data.
              </h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
                90-day realized · our pull
              </span>
            </div>
            <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
              We pulled 90 days of daily closes on each ticker (Yahoo Finance for the
              underlying, CoinGecko for the memecoin comparison) and computed annualized
              vol from log returns. The result was sharp enough to change the product.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-3">
            <Reveal>
              <div className="card p-4 sm:p-6">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[10px] sm:tracking-[0.22em]">
                  Blue-chip basket
                </div>
                <div className="mt-2 font-display tabular text-2xl font-medium leading-[1.05] tracking-[-0.03em] sm:mt-3 sm:text-4xl md:text-5xl">
                  32%
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-[var(--ink-soft)] sm:mt-2 sm:text-xs">
                  Mean annualized vol. Mean max drawdown -13%. Zero +/-10% single-day moves
                  across 9 names in 90 days.
                </div>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <div className="card p-4 sm:p-6">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[10px] sm:tracking-[0.22em]">
                  Crypto-adjacent basket
                </div>
                <div className="mt-2 font-display tabular text-2xl font-medium leading-[1.05] tracking-[-0.03em] sm:mt-3 sm:text-4xl md:text-5xl">
                  79%
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-[var(--ink-soft)] sm:mt-2 sm:text-xs">
                  Mean vol. 2.5x the blue-chip basket. Mean max drawdown -33%. 16 +/-10%
                  single-day moves across 4 names in 90 days.
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="card p-4 sm:p-6">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[10px] sm:tracking-[0.22em]">
                  Top Solana memecoins
                </div>
                <div className="mt-2 font-display tabular text-2xl font-medium leading-[1.05] tracking-[-0.03em] sm:mt-3 sm:text-4xl md:text-5xl">
                  93%
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-[var(--ink-soft)] sm:mt-2 sm:text-xs">
                  Comparison set (BONK, WIF, POPCAT, FARTCOIN, others). 2.9x the blue-chip
                  basket. 46 +/-10% days across 9 names.
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <p className="mt-6 max-w-3xl text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-xs">
              Crypto-adjacent equities are closer to memecoin volatility than blue-chip
              volatility. Lumping them in the same LTV tier as SPYx assumes a safety
              margin that isn&apos;t there.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Weekend-cutoff origination ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <Reveal>
          <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
              The weekend problem nobody else solved
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              Origination cutoff
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="card p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[11px]">
                The problem
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-2xl">
                Tokenized-stock oracles run 24/5, not 24/7.
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Chainlink Data Streams cover Monday 8:30 ET through Friday 4:00 ET. From
                Friday close to Monday open, the on-chain price doesn&apos;t update against
                a real market. If a stock drops 8% on weekend news (earnings beat, Fed
                announcement, geopolitical event), the lender&apos;s safety model is
                blind for 64 hours.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                When the oracle wakes up Monday morning, naive lenders liquidate at the
                first stale-but-finally-fresh price. Borrowers eat the gap.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="card p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80 sm:text-[11px]">
                Our solution
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-2xl">
                We refuse to originate inside the oracle gap.
              </h3>
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90 sm:text-xs">
                  Cutoff window
                </div>
                <div className="mt-1.5 font-mono text-sm text-[var(--ink)] sm:text-base">
                  Fri 21:00 UTC <span className="text-[var(--ink-faint)]">→</span> Mon 13:30 UTC
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--ink-faint)] sm:text-[11px]">
                  Fri 16:00 ET (US RTH close) → Mon 08:30 ET (pre-market open)
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Existing loans roll through the weekend unaffected. Repay, extend, and
                topup remain available. The block is exclusively on NEW origination —
                you cannot open a fresh xStock-collateralized loan into the gap.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Safety stack ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <Reveal>
            <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
                Five layers blocking scam tokens
              </h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
                Defense in depth
              </span>
            </div>
            <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
              A memecoin renamed &quot;Tesla Stock Token&quot; or a fake xStock with the
              same shape but a different mint cannot enter the collateral set at any
              layer. Defense designed assuming any single check might fail.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SAFETY_LAYERS.map((layer, i) => (
              <Reveal key={layer.title} delay={i * 40}>
                <div className="card p-4 sm:p-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-[var(--accent-deep)]">
                      L{i + 1}
                    </span>
                    <h3 className="font-display text-sm font-medium leading-tight tracking-[-0.02em] sm:text-base">
                      {layer.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                    {layer.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to borrow ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <Reveal>
          <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
              How to borrow
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              Telegram-native or dashboard
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="card p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[11px]">
                Live today
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-2xl">
                Existing tiers, 18 approved xStocks
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Already accepted as collateral via the Standard / Quick / Express tiers
                (2-day, 3-day, 7-day terms). Open the bot, run /borrow, pick an xStock,
                pick a tier, sign. SOL hits your wallet in under 90 seconds.
              </p>
              <ol className="mt-4 space-y-2 text-[13px] text-[var(--ink-soft)] sm:text-sm">
                <li>
                  <span className="font-semibold text-[var(--ink)]">1.</span> Deposit
                  your xStocks (SPYx, TSLAx, NVDAx, etc.) into your Magpie wallet.
                </li>
                <li>
                  <span className="font-semibold text-[var(--ink)]">2.</span> Run
                  /borrow, pick the ticker + tier, confirm.
                </li>
                <li>
                  <span className="font-semibold text-[var(--ink)]">3.</span> SOL lands.
                  Collateral locks. Your equity exposure stays intact.
                </li>
              </ol>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="card p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)] sm:text-[11px]">
                Coming
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-2xl">
                Premium tier with the vol-aware LTV caps
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                15-day and 30-day terms designed for stock-holder timelines. 50% LTV on
                blue-chips, 30% on crypto-adjacent. Friday-close cutoff baked in.
                Aggregate exposure caps per ticker.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Premium-tier activation is gated on the v3 program deploy (under
                external audit) and the MGP governance proposals required to ratify the
                economics. Conservative timeline; we&apos;d rather be late than wrong
                here.
              </p>
              <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Track progress
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] sm:text-[13px]">
                  <Link href="/governance" className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]">
                    Governance →
                  </Link>
                  <Link href="/stats" className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]">
                    Live protocol stats →
                  </Link>
                  <Link href="/tokens" className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]">
                    Approved collateral →
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <h2 className="font-display mx-auto max-w-3xl text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-[var(--bg-elevated)] sm:text-4xl md:text-6xl">
            Your equity stays yours.
            <br />
            <span className="italic text-[var(--accent)]">The SOL is borrowed against it.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[var(--bg-elevated)]/70 sm:text-base">
            Telegram-native. Permissionless. Borrow without selling, repay without losing your stack.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:items-center sm:gap-4 md:mt-10 md:flex-row">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-base"
            >
              Open the bot
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/tokens"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10"
            >
              Browse approved xStocks
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
