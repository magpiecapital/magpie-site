import { Mark } from "@/components/Logo";

export const metadata = {
  title: "Magpie · V4",
  description: "Borrow against your bag. Lock the win. Close on your tempo.",
};

/**
 * V4 deck — single-viewport pitch (h-screen, no scroll). The page IS
 * a dialogue: the user's mental model on the left, Magpie's one-word
 * answer on the right. Everything else is whitespace.
 *
 * Designed to be screen-recorded on a desktop viewport; constrained
 * to fit a 1440×900 minimum without scrolling.
 *
 * Direct URL only — not linked from public nav.
 */
export default function V4DeckPage() {
  return (
    <main
      className="flex min-h-screen w-screen flex-col overflow-y-auto md:h-screen md:overflow-hidden font-sans antialiased"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col px-5 py-6 sm:px-10 sm:py-8 md:px-20 md:py-10">
        {/* ── Letterhead ── */}
        <header className="flex flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <Mark size={28} variant="static" />
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
            V4 / Lending Program
          </div>
        </header>

        {/* ── The dialogue — fills the rest of the viewport ── */}
        <section className="flex flex-1 items-center">
          <div className="grid w-full items-center gap-12 md:grid-cols-[1.45fr_1fr] md:gap-20">
            {/* Left — the user's mental model, in their voice */}
            <div>
              <div
                className="mb-6 text-[10px] font-semibold uppercase tracking-[0.32em]"
                style={{ color: "var(--ink-faint)" }}
              >
                A holder asks
              </div>
              <p
                className="text-[18px] font-normal leading-[1.55] tracking-[-0.005em] md:text-[21px] md:leading-[1.5]"
                style={{ color: "var(--ink)" }}
              >
                &ldquo;I hold 10K{" "}
                <span className="font-medium">$FARTCOIN</span> at{" "}
                <span className="tabular-nums">$119M</span> market cap. I want
                some SOL out as a loan.
              </p>
              <p
                className="mt-5 text-[18px] font-normal leading-[1.55] tracking-[-0.005em] md:text-[21px] md:leading-[1.5]"
                style={{ color: "var(--ink)" }}
              >
                But if it pumps to{" "}
                <span className="tabular-nums">$145M</span> while my loan is
                out, I want to lock that profit in — before it falls back to{" "}
                <span className="tabular-nums">$130M</span>, or all the way
                back to my entry at{" "}
                <span className="tabular-nums">$119M</span>.
              </p>
              <p
                className="mt-5 text-[18px] font-normal leading-[1.55] tracking-[-0.005em] md:text-[21px] md:leading-[1.5]"
                style={{ color: "var(--ink)" }}
              >
                Can Magpie do both for me — without me babysitting a chart and
                rushing to repay the loan just to sell?&rdquo;
              </p>
            </div>

            {/* Right — the answer */}
            <div className="flex flex-col">
              <div
                className="mb-6 text-[10px] font-semibold uppercase tracking-[0.32em]"
                style={{ color: "var(--accent-deep)" }}
              >
                Magpie V4
              </div>
              <div
                className="text-[72px] sm:text-[96px] font-medium leading-[0.88] tracking-[-0.055em] md:text-[176px]"
                style={{ color: "var(--accent-deep)" }}
              >
                Yes.
              </div>
              <p
                className="mt-8 text-[15px] font-normal leading-[1.6] md:text-[16px]"
                style={{ color: "var(--ink-soft)" }}
              >
                Borrow against your bag. Arm an auto-sell at your strike.
                <br />
                When it fires, the SOL lands inside your loan vault.
                <br />
                Close the loan on your timeline — not the market&apos;s.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer
          className="flex flex-shrink-0 items-center justify-between border-t pt-5"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div
            className="text-[10px] font-medium uppercase tracking-[0.32em]"
            style={{ color: "var(--ink-faint)" }}
          >
            Live · Solana Mainnet
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
