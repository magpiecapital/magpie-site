import { Mark } from "@/components/Logo";

export const metadata = {
  title: "Magpie · V4",
  description: "The auto-sell fires. The loan stays open.",
};

/**
 * V4 deck — VC-pitch posture. Inter throughout (the Fraunces display
 * serif read as literary/playful, not professional). Generous
 * whitespace, restrained amber accent reserved for the price tick on
 * the worked example. Designed to lead a video demo.
 *
 * Direct URL only — not linked from public nav.
 */
export default function V4DeckPage() {
  return (
    <main
      className="flex min-h-screen w-full flex-col font-sans antialiased"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-12 pt-10 pb-12 md:px-20 md:pt-14 md:pb-16">
        {/* ── Letterhead ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mark size={32} variant="static" />
            <div
              className="text-[11px] font-medium uppercase tracking-[0.32em]"
              style={{ color: "var(--ink)" }}
            >
              Magpie Capital
            </div>
          </div>
          <div
            className="text-[10px] font-medium uppercase tracking-[0.36em]"
            style={{ color: "var(--ink-faint)" }}
          >
            V4 / Lending program
          </div>
        </header>

        {/* ── Hero — the thesis in two lines ── */}
        <section className="pt-20 pb-14 md:pt-24 md:pb-16">
          <div
            className="text-[14px] font-medium uppercase tracking-[0.24em] mb-7"
            style={{ color: "var(--accent-deep)" }}
          >
            The new lending primitive
          </div>
          <h1
            className="text-[56px] font-medium leading-[1.02] tracking-[-0.035em] md:text-[80px]"
            style={{ color: "var(--ink)" }}
          >
            Lock the win.
            <br />
            Keep the loan open.
          </h1>
          <p
            className="mt-8 max-w-[680px] text-[19px] leading-[1.5] font-normal"
            style={{ color: "var(--ink-soft)" }}
          >
            V4 separates the auto-sell from the loan close. Your price target
            fires the moment it hits. The proceeds sit inside your loan vault.
            You close on your timeline — not the market&apos;s.
          </p>
        </section>

        {/* ── Worked example — the Fartcoin story ── */}
        <section
          className="rounded-2xl border px-10 py-12 md:px-14 md:py-14"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--bg-elevated)",
          }}
        >
          <div className="flex items-baseline justify-between mb-10">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: "var(--ink-faint)" }}
            >
              Worked example
            </div>
            <div
              className="text-[11px] font-medium tracking-[0.04em]"
              style={{ color: "var(--ink-faint)" }}
            >
              $FARTCOIN&nbsp;·&nbsp;illustrative
            </div>
          </div>

          {/* Price arc — visual punch */}
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-6 md:gap-10 mb-12">
            <div>
              <div
                className="text-[10px] font-medium uppercase tracking-[0.28em] mb-2"
                style={{ color: "var(--ink-faint)" }}
              >
                Entry
              </div>
              <div
                className="text-[40px] font-medium tabular-nums tracking-[-0.025em] md:text-[52px]"
                style={{ color: "var(--ink)" }}
              >
                $0.50
              </div>
            </div>
            <div
              className="text-[28px] font-light tracking-[-0.02em]"
              style={{ color: "var(--ink-faint)" }}
            >
              →
            </div>
            <div className="text-right">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.28em] mb-2"
                style={{ color: "var(--accent-deep)" }}
              >
                Strike hits
              </div>
              <div
                className="text-[40px] font-medium tabular-nums tracking-[-0.025em] md:text-[52px]"
                style={{ color: "var(--accent-deep)" }}
              >
                $1.50
              </div>
            </div>
          </div>

          {/* Three-act story */}
          <div className="grid gap-10 md:grid-cols-3 md:gap-14">
            <Act
              n="01"
              title="Borrow"
              line="Lock $FARTCOIN as collateral. Take SOL out at 30% LTV. Your bag stays yours."
            />
            <Act
              n="02"
              title="Auto-sell fires"
              line="$FARTCOIN hits $1.50. Your slice converts to SOL on-chain. SOL lands inside your loan vault."
              accent
            />
            <Act
              n="03"
              title="Close on your tempo"
              line="Two weeks later, the dip comes. You close the loan, take your SOL profit, and buy back in."
            />
          </div>
        </section>

        {/* ── Why this matters — single sentence ── */}
        <section className="pt-14 pb-2">
          <p
            className="max-w-[740px] text-[17px] leading-[1.55] font-normal"
            style={{ color: "var(--ink-soft)" }}
          >
            Every other lending protocol forces a choice: hold the bag and
            pray, or sell and kill the upside. V4 is the first program where
            the auto-sell and the loan close are two separate decisions.
          </p>
        </section>

        {/* ── Footer ── */}
        <footer
          className="mt-auto flex items-center justify-between border-t pt-6"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div
            className="text-[10px] font-medium uppercase tracking-[0.32em]"
            style={{ color: "var(--ink-faint)" }}
          >
            Live · Solana mainnet
          </div>
          <div
            className="text-[10px] font-medium uppercase tracking-[0.32em]"
            style={{ color: "var(--ink-faint)" }}
          >
            magpie.capital
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ── Act card — used by the worked-example three-column ── */
function Act({
  n,
  title,
  line,
  accent = false,
}: {
  n: string;
  title: string;
  line: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div
        className="text-[10px] font-semibold tabular-nums tracking-[0.18em] mb-4"
        style={{ color: accent ? "var(--accent-deep)" : "var(--ink-faint)" }}
      >
        {n}
      </div>
      <div
        className="text-[20px] font-medium tracking-[-0.015em] mb-3"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </div>
      <div
        className="text-[14px] leading-[1.55] font-normal"
        style={{ color: "var(--ink-soft)" }}
      >
        {line}
      </div>
    </div>
  );
}
