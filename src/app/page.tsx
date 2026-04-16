import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_bot";

const STEPS = [
  {
    n: "01",
    t: "Connect in Telegram",
    d: "Open @magpie_bot, verify your wallet, and pick a bag.",
    detail:
      "No seed phrase. Magpie generates a loan-scoped deposit address; your keys stay yours. Export anytime.",
  },
  {
    n: "02",
    t: "Pick your tier",
    d: "Choose loan length. Magpie quotes LTV, fee, and payout instantly.",
    detail:
      "Live oracle pricing on every quote. The bot shows your SOL payout and the liquidation price before you sign.",
  },
  {
    n: "03",
    t: "Deposit your bag",
    d: "Send tokens to the address. SOL lands when the deposit confirms.",
    detail:
      "Usually under 10 seconds on Solana mainnet. You'll get a Telegram ping the moment funds hit your wallet.",
  },
  {
    n: "04",
    t: "Manage or repay",
    d: "Top-up, partial-repay, or extend. Repay fully to reclaim your bag.",
    detail:
      "Health alerts fire at 90% and 24h-to-due. Miss repay and only the collateral is liquidated — never your other holdings.",
  },
];

const TIERS = [
  {
    name: "Express",
    days: "2 days",
    ltv: "30%",
    fee: "1.5%",
    best: "Degens catching a pump",
    points: [
      "Highest LTV available",
      "Fastest turnaround",
      "Best for short-term conviction",
    ],
    highlight: true,
  },
  {
    name: "Quick",
    days: "3 days",
    ltv: "25%",
    fee: "1.5%",
    best: "Weekend trades",
    points: [
      "Balanced risk profile",
      "Room to ride out volatility",
      "Most popular tier",
    ],
    highlight: false,
  },
  {
    name: "Standard",
    days: "7 days",
    ltv: "20%",
    fee: "1.5%",
    best: "Patient holders",
    points: [
      "Most headroom vs. liquidation",
      "Week-long runway",
      "Lowest stress, safest margin",
    ],
    highlight: false,
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
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark size={28} />
          <nav className="flex items-center gap-8">
            <a href="#how" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              How it works
            </a>
            <a href="#tiers" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tiers
            </a>
            <Link href="/dashboard" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-32 md:pb-36">
        <div className="fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] pulse-dot" />
          Live on Solana
        </div>

        <h1 className="fade-up fade-up-1 max-w-5xl text-[clamp(3.2rem,10vw,9rem)] leading-[0.9] tracking-[-0.045em] font-semibold">
          Borrow SOL.
          <br />
          Keep your bag.
        </h1>

        <p className="fade-up fade-up-2 mt-8 max-w-xl text-xl text-[var(--ink-soft)]">
          Lending for memecoin holders. All in a Telegram chat.
        </p>

        <div className="fade-up fade-up-3 mt-10 flex items-center gap-5">
          <a href={TELEGRAM_URL} className="btn-accent text-base">
            Launch on Telegram
            <span aria-hidden>→</span>
          </a>
          <a href="#how" className="text-sm font-medium text-[var(--ink-soft)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
            How it works
          </a>
        </div>

        {/* Floating mark */}
        <div className="pointer-events-none absolute right-0 top-24 hidden opacity-90 md:block">
          <div className="hop">
            <Mark size={220} />
          </div>
        </div>
      </section>

      {/* Value prop marquee */}
      <section className="overflow-hidden border-y border-[var(--hairline)] bg-[var(--accent)]">
        <div className="flex marquee whitespace-nowrap py-5 text-[var(--ink)] font-semibold tracking-tight">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="flex items-center gap-6 px-6 text-lg">
              {item}
              <span aria-hidden className="opacity-30">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="chip mb-5">How it works</div>
            <h2 className="max-w-3xl text-5xl tracking-[-0.035em] font-semibold md:text-7xl">
              Four taps.
              <br />
              <span className="text-[var(--ink-soft)]">You&apos;re funded.</span>
            </h2>
          </div>
          <p className="max-w-md text-lg text-[var(--ink-soft)]">
            Magpie wraps a Solana lending program in a Telegram bot. You pledge memecoins as collateral, receive SOL instantly, and repay on your own schedule.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-8 transition hover:border-[var(--ink)]"
            >
              <div className="flex items-baseline gap-4">
                <div className="font-mono text-sm text-[var(--ink-soft)]">{s.n}</div>
                <div className="text-3xl font-semibold tracking-tight">{s.t}</div>
              </div>
              <div className="mt-4 text-lg text-[var(--ink)]">{s.d}</div>
              <div className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lending tiers */}
      <section id="tiers" className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="chip mb-5">Lending tiers</div>
              <h2 className="max-w-3xl text-5xl tracking-[-0.035em] font-semibold md:text-7xl">
                Pick your risk.
                <br />
                <span className="text-[var(--ink-soft)]">Pick your payout.</span>
              </h2>
            </div>
            <p className="max-w-md text-lg text-[var(--ink-soft)]">
              Higher LTV means more SOL per bag, but less room before liquidation. Longer terms give the market time to breathe.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-3xl border p-8 transition ${
                  tier.highlight
                    ? "border-[var(--ink)] bg-[var(--bg)] shadow-[0_20px_60px_-30px_rgba(10,10,10,0.25)]"
                    : "border-[var(--hairline)] bg-[var(--bg)] hover:border-[var(--ink)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-semibold tracking-tight">{tier.name}</div>
                  {tier.highlight && (
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
                      Most SOL
                    </span>
                  )}
                </div>
                <div className="mt-8 flex items-baseline gap-2">
                  <div className="text-6xl font-semibold tracking-[-0.04em]">{tier.ltv}</div>
                  <div className="text-sm text-[var(--ink-soft)]">LTV</div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-soft)]">
                  {tier.days} · {tier.fee} flat fee
                </div>
                <div className="mt-6 border-t border-[var(--hairline)] pt-6">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                    Best for
                  </div>
                  <div className="mt-1 text-base font-medium">{tier.best}</div>
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
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--ink-soft)]">
              <span className="font-semibold text-[var(--ink)]">Every tier:</span>{" "}
              non-custodial, partial-repay anytime, extend for 1.5%, top-up collateral anytime.
            </div>
            <a href={TELEGRAM_URL} className="btn-ghost text-sm">
              Get a quote →
            </a>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-[var(--hairline)]">
          {[
            { v: "<10s", l: "Funded" },
            { v: "1.5%", l: "Flat fee" },
            { v: "30%", l: "Max LTV" },
          ].map((s) => (
            <div key={s.l} className="px-6 py-14 md:px-10 md:py-20 text-center">
              <div className="text-5xl md:text-7xl font-semibold tracking-[-0.04em]">{s.v}</div>
              <div className="mt-3 text-sm uppercase tracking-[0.18em] text-[var(--ink-soft)]">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-32 md:py-48 text-center">
        <Mark size={72} className="mx-auto mb-10 hop" />
        <h2 className="mx-auto max-w-4xl text-6xl tracking-[-0.04em] font-semibold md:text-8xl">
          Your bag&apos;s worth
          <br />
          <span className="bg-[var(--accent)] px-4 py-1 rounded-2xl">more liquid.</span>
        </h2>
        <div className="mt-14 flex flex-col items-center justify-center gap-4 md:flex-row">
          <a href={TELEGRAM_URL} className="btn-accent text-lg">
            Open @magpie_bot
            <span aria-hidden>→</span>
          </a>
          <Link href="/dashboard" className="btn-ghost text-lg">
            View dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex items-center gap-8 text-sm text-[var(--ink-soft)]">
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--ink)]">Telegram</a>
            <Link href="/dashboard" className="transition hover:text-[var(--ink)]">Dashboard</Link>
            <a href="#" className="transition hover:text-[var(--ink)]">X</a>
            <a href="#" className="transition hover:text-[var(--ink)]">Docs</a>
          </div>
          <div className="text-xs text-[var(--ink-soft)]">© {new Date().getFullYear()} Magpie</div>
        </div>
      </footer>
    </div>
  );
}
