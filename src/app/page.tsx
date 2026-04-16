import { Wordmark, LogoMark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/BagBankBot"; // TODO: update after BotFather
const TWITTER_URL = "https://x.com/bagbankxyz"; // TODO: set real handle

const TIERS = [
  { ltv: "30%", days: "2 days", tag: "Express" },
  { ltv: "25%", days: "3 days", tag: "Quick" },
  { ltv: "20%", days: "7 days", tag: "Standard" },
];

const STEPS = [
  {
    n: "01",
    title: "Deposit your bag",
    body: "Send any supported memecoin to your BagBank wallet. We auto-detect it.",
  },
  {
    n: "02",
    title: "Pick a tier",
    body: "Choose your LTV + duration. We quote the SOL you'll receive, net of a 1.5% fee.",
  },
  {
    n: "03",
    title: "SOL hits instantly",
    body: "One on-chain tx. Your bag locks in the vault, SOL lands in your wallet.",
  },
  {
    n: "04",
    title: "Repay or get liquidated",
    body: "Pay back in SOL before the clock runs out or your collateral's value drops below 1.1x.",
  },
];

const FEATURES = [
  {
    title: "No credit check.",
    body: "Your bag is the credit. No KYC, no email, no form.",
  },
  {
    title: "Telegram native.",
    body: "The entire protocol lives in a DM. Inline buttons, no dApp to install.",
  },
  {
    title: "Fully custodial wallet.",
    body: "We generate your Solana wallet on first /start. Export your key any time.",
  },
  {
    title: "Manage loans live.",
    body: "Top up collateral, partially repay, or extend your loan — all on-chain.",
  },
  {
    title: "Health alerts.",
    body: "Progressive DMs at 1.3x, 1.2x, 1.1x collateral ratio. Never get surprised.",
  },
  {
    title: "Auto-repay.",
    body: "Deposit SOL into your wallet and we'll close your loan for you.",
  },
];

const FAQ = [
  {
    q: "What can I use as collateral?",
    a: "Any memecoin we've whitelisted with a live Jupiter oracle price. Run /supported in the bot to see the current list.",
  },
  {
    q: "What happens if I don't repay on time?",
    a: "Your collateral gets liquidated on-chain. The vault transfers your bag to the lender and swaps it to SOL. You keep the loan you took — so it's effectively a sale at the LTV you chose.",
  },
  {
    q: "Can I get liquidated early?",
    a: "Only if your collateral's SOL value falls below 1.1x of what you owe. We DM warnings at 1.3x, 1.2x, and 1.1x with quick-action buttons.",
  },
  {
    q: "What's the fee?",
    a: "1.5% origination, charged at loan open. Same 1.5% to extend. No interest accrues — the amount you owe is fixed at loan open.",
  },
  {
    q: "Is my key safe?",
    a: "It's custodial. We hold an AES-256-GCM encrypted private key server-side. You can /export it any time and migrate your funds off-platform.",
  },
];

export default function Home() {
  return (
    <div className="relative z-10 min-h-screen">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,204,74,0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(20,241,149,0.08), transparent 60%)",
        }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark />
          <nav className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            <a href="#how" className="transition hover:text-[var(--foreground)]">How it works</a>
            <a href="#tiers" className="transition hover:text-[var(--foreground)]">Tiers</a>
            <a href="#features" className="transition hover:text-[var(--foreground)]">Features</a>
            <a href="#faq" className="transition hover:text-[var(--foreground)]">FAQ</a>
          </nav>
          <a
            href={TELEGRAM_URL}
            className="rounded-full bg-[var(--gold-bright)] px-4 py-2 text-sm font-semibold text-[var(--background)] transition hover:bg-[var(--gold)]"
          >
            Launch bot
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        <div className="fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)] shimmer" />
            Live on Solana mainnet
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Pawn your bags.
            <br />
            <span className="bg-gradient-to-r from-[var(--gold-bright)] via-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">
              Get SOL instantly.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] md:text-xl">
            Memecoin-collateralized loans on Telegram. Deposit your bag, pick a tier,
            get SOL in your wallet in a single transaction. Repay in 2, 3, or 7 days.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={TELEGRAM_URL}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gold-bright)] px-6 py-3.5 text-base font-semibold text-[var(--background)] transition hover:bg-[var(--gold)]"
            >
              Open in Telegram
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-3.5 text-base font-medium text-[var(--foreground)] transition hover:border-[var(--gold-bright)]"
            >
              How it works
            </a>
          </div>
        </div>

        {/* Hero visual */}
        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Funded in", value: "< 10 sec" },
            { label: "Origination fee", value: "1.5%" },
            { label: "Min tenor", value: "2 days" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <div className="text-sm text-[var(--muted)]">{s.label}</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-[var(--border)] bg-[var(--card)]/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14">
            <div className="text-sm uppercase tracking-[0.2em] text-[var(--gold-bright)]">How it works</div>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
              Four steps. One Telegram chat.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-[var(--gold-bright)]"
              >
                <div className="font-mono text-xs text-[var(--gold-bright)]">{s.n}</div>
                <div className="mt-3 text-xl font-semibold">{s.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14">
            <div className="text-sm uppercase tracking-[0.2em] text-[var(--gold-bright)]">Loan tiers</div>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
              Pick your risk. Pick your runway.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TIERS.map((t, i) => (
              <div
                key={t.tag}
                className={`relative rounded-2xl border p-8 transition ${
                  i === 1
                    ? "border-[var(--gold-bright)] bg-gradient-to-b from-[var(--gold-bright)]/10 to-transparent"
                    : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                {i === 1 && (
                  <div className="absolute -top-3 left-6 rounded-full bg-[var(--gold-bright)] px-3 py-1 text-xs font-semibold text-[var(--background)]">
                    Most used
                  </div>
                )}
                <div className="text-sm text-[var(--muted)]">{t.tag}</div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight">{t.ltv}</span>
                  <span className="text-[var(--muted)]">LTV</span>
                </div>
                <div className="mt-2 text-lg">{t.days} to repay</div>
                <div className="mt-6 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
                  Borrow {t.ltv} of your bag&apos;s SOL value.
                  Repay within {t.days}. 1.5% origination.
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-[var(--muted)]">
            Liquidation trigger: collateral value &lt; 1.1× owed, or past due. Health alerts DMed before every threshold.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[var(--border)] bg-[var(--card)]/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14">
            <div className="text-sm uppercase tracking-[0.2em] text-[var(--gold-bright)]">Why BagBank</div>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
              Built for the Telegram trader.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
              >
                <div className="text-lg font-semibold">{f.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Command preview */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-[var(--gold-bright)]">Commands</div>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Every action is one slash away.
              </h2>
              <p className="mt-4 text-[var(--muted)]">
                The entire lending protocol — borrow, repay, top-up, partial repay, extend,
                withdraw — lives in a Telegram chat. Inline buttons, no menus, no dApp.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] font-mono text-sm">
              <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-[var(--muted)]">@BagBankBot</span>
              </div>
              <div className="space-y-2 p-5">
                {[
                  ["/borrow", "take out a SOL loan"],
                  ["/positions", "active loans + live health"],
                  ["/repay", "full repayment"],
                  ["/partialrepay", "pay down part of a loan"],
                  ["/topup", "add collateral, boost health"],
                  ["/extend", "roll the clock for 1.5%"],
                  ["/withdraw", "send SOL or tokens out"],
                  ["/export", "export your private key"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-3">
                    <span className="text-[var(--gold-bright)]">{cmd}</span>
                    <span className="text-[var(--muted)]">— {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-[var(--border)] bg-[var(--card)]/30">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <div className="mb-14">
            <div className="text-sm uppercase tracking-[0.2em] text-[var(--gold-bright)]">FAQ</div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Questions, answered.
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group py-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4">
                  <span className="text-lg font-medium">{item.q}</span>
                  <span className="text-[var(--gold-bright)] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[var(--muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-28 text-center">
          <h2 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Your bag&apos;s worth more{" "}
            <span className="bg-gradient-to-r from-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent">
              liquid.
            </span>
          </h2>
          <p className="mt-5 text-lg text-[var(--muted)]">Open the bot. Get SOL in under a minute.</p>
          <a
            href={TELEGRAM_URL}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--gold-bright)] px-7 py-4 text-base font-semibold text-[var(--background)] transition hover:bg-[var(--gold)]"
          >
            Launch @BagBankBot →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <span className="text-sm text-[var(--muted)]">
              © {new Date().getFullYear()} BagBank. Built on Solana.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--foreground)]">
              Telegram
            </a>
            <a href={TWITTER_URL} className="transition hover:text-[var(--foreground)]">
              Twitter / X
            </a>
            <a href="#faq" className="transition hover:text-[var(--foreground)]">
              FAQ
            </a>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-6 py-5 text-center text-xs text-[var(--muted)]">
          Loans are secured by on-chain collateral. Missed repayments or a collateral drop below 1.1× your owed amount will trigger liquidation. Not financial advice.
        </div>
      </footer>
    </div>
  );
}
