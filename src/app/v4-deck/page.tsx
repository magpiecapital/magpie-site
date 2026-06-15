import { Mark } from "@/components/Logo";

export const metadata = {
  title: "Magpie · V4 Brief",
  description:
    "V4 in-vault auto-sells — borrow against the bag, lock the exit, never choose.",
};

/**
 * One-page V4 brief — designed to lead a video demo. Single full-screen
 * slide layout that screen-records cleanly. Print/PDF-friendly margins.
 *
 * Not linked from the public nav. Operator pulls up directly at
 * /v4-deck when they want to record the lead-in.
 */
export default function V4DeckPage() {
  return (
    <main
      className="min-h-screen w-full"
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-10 py-10 md:px-16 md:py-14">
        {/* ── Letterhead ───────────────────────────────────────── */}
        <header className="flex items-center justify-between border-b pb-6"
                style={{ borderColor: "var(--hairline)" }}>
          <div className="flex items-center gap-4">
            <Mark size={44} variant="static" />
            <div className="leading-tight">
              <div className="font-display text-xl tracking-[-0.02em]"
                   style={{ color: "var(--ink)" }}>
                Magpie Capital
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em]"
                   style={{ color: "var(--ink-faint)" }}>
                Protocol Brief · V4
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] uppercase tracking-[0.22em]"
               style={{ color: "var(--ink-faint)" }}>
            magpie.capital
          </div>
        </header>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="mt-12 md:mt-14">
          <div className="text-[11px] uppercase tracking-[0.22em] mb-5"
               style={{ color: "var(--accent-deep)" }}>
            New on Magpie · Live 2026
          </div>
          <h1 className="font-display text-[44px] md:text-[58px] leading-[1.02] tracking-[-0.03em]"
              style={{ color: "var(--ink)" }}>
            Take the loan.
            <br />
            Lock the exit.
            <br />
            <span style={{ color: "var(--accent-deep)" }}>Never choose.</span>
          </h1>
          <p className="mt-6 max-w-[680px] text-[17px] leading-[1.55]"
             style={{ color: "var(--ink-soft)" }}>
            V4 is the first lending program that lets you borrow against
            your bag <em>and</em> set an auto-sell at your strike — without
            forcing you to close the loan when the sell fires. The SOL
            proceeds accumulate inside your loan. You decide when to claim.
          </p>
        </section>

        {/* ── Two-up: how + example ────────────────────────────── */}
        <section className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* HOW IT WORKS */}
          <div className="rounded-2xl border p-8"
               style={{
                 background: "var(--bg-elevated)",
                 borderColor: "var(--hairline)",
               }}>
            <div className="text-[10px] uppercase tracking-[0.22em] mb-4"
                 style={{ color: "var(--ink-faint)" }}>
              How it works
            </div>
            <ol className="space-y-5">
              <Step n={1} title="Borrow + attach an auto-sell">
                Open a loan against your token. In the same flow, set a
                take-profit, stop-loss, or ladder. Loan routes to V4
                automatically.
              </Step>
              <Step n={2} title="Use the SOL for buying power">
                The SOL principal lands in your wallet. Spend it, trade it,
                stake it — the bag stays locked in the loan as collateral.
              </Step>
              <Step n={3} title="Trigger hits → SOL fills the loan vault">
                When your strike is reached, the engine sells the slice
                on-chain. Proceeds accumulate <em>inside the loan vault</em>.
                Loan stays Active.
              </Step>
              <Step n={4} title="Close on your tempo">
                Repay whenever you want — minutes, days, weeks later. The
                vault SOL flows back to you in the same transaction as the
                close. Tax + tempo control, in your hands.
              </Step>
            </ol>
          </div>

          {/* WORKED EXAMPLE — $FARTCOIN */}
          <div className="rounded-2xl p-8"
               style={{
                 background: "var(--accent-dim)",
                 border: "1px solid var(--accent)",
               }}>
            <div className="text-[10px] uppercase tracking-[0.22em] mb-4"
                 style={{ color: "var(--accent-deep)" }}>
              Worked example · $FARTCOIN
            </div>
            <div className="space-y-5">
              <ExampleStage tag="Day 0">
                You hold <Strong>100,000 $FARTCOIN</Strong>. Spot is
                <Strong> $1.00</Strong> — collateral value
                <Strong> $100,000</Strong>.
                <br />
                Borrow Express tier (30% LTV, 2 days): receive
                <Strong> ~100 SOL</Strong> in your wallet.
                <br />
                Set a <Strong>2× take-profit</Strong>. Same screen, one tap.
              </ExampleStage>
              <ExampleStage tag="Day 1">
                FARTCOIN moons to <Strong>$2.00</Strong>. Engine fires
                automatically across cross-sourced oracles.
                <br />
                Sells your <Strong>100k FART</Strong> via Jupiter →
                <Strong> ~660 SOL</Strong> (after 1% protocol fee) lands
                <em> inside the loan vault</em>.
                <br />
                Your loan stays <Strong>Active</Strong>.
              </ExampleStage>
              <ExampleStage tag="Day 1–14, your call">
                Close anytime within the loan term. You repay
                <Strong> ~103 SOL</Strong> (principal + fee).
                The vault returns its <Strong>660 SOL</Strong> in the same
                transaction.
                <br />
                <Strong style={{ color: "var(--accent-deep)" }}>
                  Net to you: ~557 SOL.
                </Strong>
              </ExampleStage>
            </div>
          </div>
        </section>

        {/* ── Why it's "best of both worlds" ───────────────────── */}
        <section className="mt-14">
          <div className="text-[10px] uppercase tracking-[0.22em] mb-5"
               style={{ color: "var(--ink-faint)" }}>
            Why it&apos;s the best of both worlds
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Benefit title="Buying power without selling">
              The loan principal funds whatever you want to do next —
              another trade, hedge, real-life expense — while the bag stays
              locked, working for upside.
            </Benefit>
            <Benefit title="Never miss your strike">
              The auto-sell fires at your target without you watching the
              chart. Cross-sourced from Jupiter, DexScreener, and Pyth —
              no false fills.
            </Benefit>
            <Benefit title="Close at your tempo">
              The sale doesn&apos;t force the loan close. Hold for
              tax-year timing. Wait for a calmer settlement window. Decide
              after the fact.
            </Benefit>
          </div>
        </section>

        {/* ── Foot ─────────────────────────────────────────────── */}
        <footer className="mt-14 flex items-center justify-between border-t pt-6"
                style={{ borderColor: "var(--hairline)" }}>
          <div className="text-[11px] uppercase tracking-[0.22em]"
               style={{ color: "var(--ink-faint)" }}>
            Live · Mainnet · HA1h…UwNo
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em]"
               style={{ color: "var(--ink-faint)" }}>
            magpie.capital/v4-deck
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ─── Components ───────────────────────────────────────────── */

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[13px]"
        style={{
          background: "var(--accent)",
          color: "var(--accent-ink)",
        }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[15px] mb-1"
             style={{ color: "var(--ink)" }}>
          {title}
        </div>
        <div className="text-[14px] leading-[1.55]"
             style={{ color: "var(--ink-soft)" }}>
          {children}
        </div>
      </div>
    </li>
  );
}

function ExampleStage({
  tag,
  children,
}: {
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 text-[10px] uppercase tracking-[0.22em] mt-1 w-[68px]"
           style={{ color: "var(--accent-deep)" }}>
        {tag}
      </div>
      <div className="flex-1 text-[14px] leading-[1.65]"
           style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

function Benefit({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-6"
         style={{
           background: "var(--bg-elevated)",
           borderColor: "var(--hairline)",
         }}>
      <div className="font-display text-[19px] tracking-[-0.02em] mb-2"
           style={{ color: "var(--ink)" }}>
        {title}
      </div>
      <div className="text-[14px] leading-[1.55]"
           style={{ color: "var(--ink-soft)" }}>
        {children}
      </div>
    </div>
  );
}

function Strong({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span className="font-semibold" style={style}>
      {children}
    </span>
  );
}
