import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_bot"; // update post-BotFather

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--ink)]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Wordmark size={28} />
          <a
            href={TELEGRAM_URL}
            className="rounded-full bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--gold-bright)]"
          >
            Launch
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(232,198,116,0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-28 pb-32 md:pt-40 md:pb-44">
          <div className="fade-up">
            <div className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--stone)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-bright)] pulse-dot" />
              Live on Solana
            </div>
          </div>

          <h1 className="fade-up fade-up-1 max-w-5xl text-[clamp(3.5rem,9vw,8rem)] leading-[0.95] tracking-[-0.04em] font-medium">
            Borrow SOL
            <br />
            <span style={{ fontFamily: "var(--font-display)" }} className="italic text-[var(--gold-bright)]">
              against your bags.
            </span>
          </h1>

          <p className="fade-up fade-up-2 mt-10 max-w-xl text-lg text-[var(--paper-dim)] md:text-xl">
            Memecoin-collateralized lending. One Telegram chat. Funded in seconds.
          </p>

          <div className="fade-up fade-up-3 mt-12 flex items-center gap-4">
            <a
              href={TELEGRAM_URL}
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--gold-bright)] px-7 py-4 text-base font-medium text-[var(--ink)] transition hover:bg-[var(--paper)]"
            >
              Open in Telegram
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#how"
              className="text-base font-medium text-[var(--paper-dim)] transition hover:text-[var(--paper)]"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-[var(--hairline)]">
          {[
            { v: "< 10s", l: "Funding time" },
            { v: "1.5%", l: "Flat origination" },
            { v: "30%", l: "Max LTV" },
          ].map((s) => (
            <div key={s.l} className="px-6 py-10 md:px-10 md:py-14">
              <div
                style={{ fontFamily: "var(--font-display)" }}
                className="text-5xl text-[var(--gold-bright)] md:text-6xl"
              >
                {s.v}
              </div>
              <div className="mt-3 text-sm uppercase tracking-[0.15em] text-[var(--stone)]">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <div className="mb-20 max-w-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--stone)]">How it works</div>
            <h2 className="mt-4 text-5xl tracking-[-0.03em] font-medium md:text-6xl">
              Three steps.
              <br />
              <span style={{ fontFamily: "var(--font-display)" }} className="italic text-[var(--gold-bright)]">
                No paperwork.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {[
              { n: "01", t: "Deposit", d: "Send your bag to your Magpie wallet." },
              { n: "02", t: "Borrow", d: "Pick a tier. SOL hits instantly." },
              { n: "03", t: "Repay", d: "Pay back in days. Reclaim your bag." },
            ].map((s) => (
              <div key={s.n} className="border-t border-[var(--hairline)] pt-6">
                <div className="font-mono text-sm text-[var(--gold-bright)]">{s.n}</div>
                <div className="mt-4 text-2xl font-medium">{s.t}</div>
                <p className="mt-2 text-[var(--paper-dim)]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal preview */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--stone)]">Product</div>
              <h2 className="mt-4 text-5xl tracking-[-0.03em] font-medium md:text-6xl">
                A bank
                <br />
                <span style={{ fontFamily: "var(--font-display)" }} className="italic text-[var(--gold-bright)]">
                  in a DM.
                </span>
              </h2>
              <p className="mt-8 max-w-sm text-[var(--paper-dim)]">
                Every action — borrow, repay, top-up, extend — lives in Telegram.
                No dApp. No menus. Just slash commands.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-soft)] font-mono text-sm">
              <div className="flex items-center gap-1.5 border-b border-[var(--hairline)] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline)]" />
                <span className="ml-3 text-xs text-[var(--stone)]">@magpie_bot</span>
              </div>
              <div className="space-y-2.5 p-6 text-[var(--paper-dim)]">
                {[
                  ["/borrow", "open a SOL loan"],
                  ["/positions", "active loans & health"],
                  ["/topup", "add collateral"],
                  ["/extend", "extend the due date"],
                  ["/repay", "close & reclaim"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-4">
                    <span className="w-28 text-[var(--gold-bright)]">{cmd}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-6 py-32 md:py-44 text-center">
          <Mark size={80} className="mx-auto mb-10" />
          <h2 className="mx-auto max-w-4xl text-6xl tracking-[-0.03em] font-medium md:text-7xl">
            Your bag is worth
            <br />
            <span style={{ fontFamily: "var(--font-display)" }} className="italic text-[var(--gold-bright)]">
              more liquid.
            </span>
          </h2>
          <a
            href={TELEGRAM_URL}
            className="mt-14 inline-flex items-center gap-2 rounded-full bg-[var(--gold-bright)] px-8 py-4 text-base font-medium text-[var(--ink)] transition hover:bg-[var(--paper)]"
          >
            Open @magpie_bot →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={24} />
          <div className="flex items-center gap-8 text-sm text-[var(--stone)]">
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--paper)]">Telegram</a>
            <a href="#" className="transition hover:text-[var(--paper)]">X</a>
            <a href="#" className="transition hover:text-[var(--paper)]">Docs</a>
          </div>
          <div className="text-xs text-[var(--stone)]">© {new Date().getFullYear()} Magpie</div>
        </div>
      </footer>
    </div>
  );
}
