import { Mark } from "@/components/Logo";

export const metadata = {
  title: "Magpie · V4",
  description: "Borrow. Lock the exit. Keep both.",
};

/**
 * V4 deck — minimal, VC-pitch style. Hero statement does the work; the
 * rest is whitespace + three short labels. Designed to lead a video
 * demo: full-screen, screen-record, talk over it.
 *
 * Direct URL only — not in public nav.
 */
export default function V4DeckPage() {
  return (
    <main
      className="flex min-h-screen w-full flex-col"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-12 py-12 md:px-16 md:py-14">
        {/* Letterhead — minimal */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mark size={36} variant="static" />
            <div className="font-display text-[15px] tracking-[-0.01em]"
                 style={{ color: "var(--ink)" }}>
              Magpie Capital
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em]"
               style={{ color: "var(--ink-faint)" }}>
            V4
          </div>
        </header>

        {/* Hero — the entire pitch in three lines */}
        <section className="flex flex-1 flex-col justify-center py-16">
          <div className="font-display text-[64px] leading-[1.05] tracking-[-0.035em] md:text-[88px]"
               style={{ color: "var(--ink)" }}>
            <div>The auto-sell fires.</div>
            <div>The loan stays open.</div>
            <div>
              You decide{" "}
              <span style={{ color: "var(--accent-deep)" }}>when to close</span>.
            </div>
          </div>

          <div className="mt-10 max-w-[640px] text-[18px] leading-[1.45]"
               style={{ color: "var(--ink-soft)" }}>
            The lending program that doesn&apos;t make you choose between
            holding the bag and locking the win.
          </div>
        </section>

        {/* Three-step model — minimal labels */}
        <section className="border-t pt-10"
                 style={{ borderColor: "var(--hairline)" }}>
          <div className="grid grid-cols-3 gap-10">
            <Step n="1" title="Borrow">
              Get SOL. Bag stays as collateral.
            </Step>
            <Step n="2" title="Auto-sell">
              Hits your strike. SOL fills the loan vault.
            </Step>
            <Step n="3" title="Close">
              On your tempo. Pay back. Take what&apos;s yours.
            </Step>
          </div>
        </section>

        {/* Footer strip */}
        <footer className="mt-10 flex items-center justify-between border-t pt-6"
                style={{ borderColor: "var(--hairline)" }}>
          <div className="text-[10px] uppercase tracking-[0.28em]"
               style={{ color: "var(--ink-faint)" }}>
            Live · Mainnet
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em]"
               style={{ color: "var(--ink-faint)" }}>
            magpie.capital
          </div>
        </footer>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.28em] mb-3"
           style={{ color: "var(--accent-deep)" }}>
        {n}
      </div>
      <div className="font-display text-[28px] tracking-[-0.02em] mb-2"
           style={{ color: "var(--ink)" }}>
        {title}
      </div>
      <div className="text-[14px] leading-[1.45]"
           style={{ color: "var(--ink-soft)" }}>
        {children}
      </div>
    </div>
  );
}
