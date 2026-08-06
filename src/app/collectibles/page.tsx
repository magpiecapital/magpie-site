import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const DESIGN_REPO = "https://github.com/magpiecapital/magpie-collectibles-lending";

export const metadata: Metadata = {
  title: "Borrow against graded trading cards | Magpie",
  description:
    "A design-phase vertical: fixed-term loans against tokenized, vault-held graded trading cards, valued on real sold comps — not listings. Recovery is by resale of proven-liquid cards, not a vendor buyback. Not live yet; the full design is public.",
  openGraph: {
    title: "Borrow against graded trading cards | Magpie",
    description:
      "Collectibles lending, in design. Valued on real sold comps, not listings. Fixed-term so illiquid collateral is never force-liquidated. The full threat model and parameters are public.",
  },
};

// Proposed LTV tiers from the data spike (design-phase, not live). Bands are
// deliberately conservative: they must break even against verified ~40–70%
// peak-to-trough drawdowns plus buyback/marketplace fees.
const TIERS = [
  {
    tag: "Tier A",
    tone: "emerald",
    ltv: "≤ 40%",
    label: "Blue-chip vintage",
    body: "Iconic, deeply-liquid graded cards — WOTC-era holos like Base Set Charizard — where dozens of recent sold comps exist every month across multiple auction houses.",
    examples: ["Base Set Charizard", "1st-ed holos", "Iconic promos"],
  },
  {
    tag: "Tier B",
    tone: "amber",
    ltv: "≤ 35%",
    label: "Liquid chase cards",
    body: "Graded modern & vintage chase cards with a steady sold-comp history but thinner per-card volume. Real market, wider spreads — so a lower cap and a stricter comp-count floor.",
    examples: ["Graded modern chase", "Key set holos", "Popular alt-arts"],
  },
  {
    tag: "Tier C",
    tone: "slate",
    ltv: "≤ 20%",
    label: "Long-tail",
    body: "Sparse-comp, low-liquidity cards. Most are ineligible; the few that qualify take the lowest cap. We would rather decline than underwrite a card we can't honestly value or exit.",
    examples: ["Sparse comps", "Low pop + low demand", "Unverifiable variants"],
  },
];

const VALUATION = [
  {
    title: "Real sold comps, not listings",
    body: "Value is built from prices cards actually SOLD for — recency-weighted, median-based, with outlier and wash-trade rejection and a minimum-comp-count floor. What someone lists a card at is ignored entirely.",
  },
  {
    title: "An eBay-independent anchor",
    body: "A single marketplace can be gamed. Every valuation is confirmed against PSA Auction Prices Realized — multi-house, structurally independent sold data — so no one source can inflate borrowing power. If sources diverge past a threshold, we don't lend.",
  },
  {
    title: "Recovery by resale, sized for a bear market",
    body: "Because we only lend against cards with a real, recent sales record — at conservative LTV — default recovery is a straightforward resale into that proven market, plus physical redemption. We never depend on a single vendor's buyback, and the book is sized with a reserve to survive a downturn.",
  },
];

const GRADE_KEYS = [
  { k: "Exact match", v: "Comps are keyed to the precise {grader, grade, set, card number, variant, cert #} — a PSA 10 is a different asset from a PSA 9." },
  { k: "Tamper & counterfeit checks", v: "Cert-number verification against the grader's population data; slab-tampering and counterfeit-slab defenses before a card is ever eligible." },
  { k: "Pop-report aware", v: "Population and gem-rate context, so a thin-pop card gets a thinner cap — not a blue-chip's terms." },
];

const INCLUDED = [
  "Graded by a recognized house (PSA / CGC / BGS / SGC)",
  "A verifiable cert that matches the population record",
  "Enough recent real sold comps to value it honestly",
  "Liquid enough to exit without moving the whole market",
];

const EXCLUDED = [
  "Raw (ungraded) cards — no objective grade to key comps to",
  "Cards with sparse or wash-traded comp history",
  "Unverifiable variants or suspected altered/counterfeit slabs",
  "Anything we can't independently cross-source a value for",
];

const toneClass: Record<string, string> = {
  emerald: "bg-emerald-500/20 text-emerald-200",
  amber: "bg-amber-500/25 text-amber-100",
  slate: "bg-slate-500/25 text-slate-200",
};

export default function CollectiblesPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-8 sm:px-6 md:pt-24 md:pb-16">
          <Reveal>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-medium shadow-sm sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[var(--ink-faint)]">In design · fixed-term · real-comp valued</span>
            </div>
            <h1 className="font-display text-[2.25rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-7xl">
              Borrow SOL against your graded trading cards.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-lg">
              A new collateral class for Magpie: fixed-term loans against tokenized
              graded cards, valued on what cards actually <em>sold</em> for — not what
              they&apos;re listed at. This vertical is <strong>in design</strong>, and the
              full threat model and parameters are public.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── The core idea ── */}
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-6">
        <Reveal>
          <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
              The same safety core, a new asset class
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              Screen · price · exit
            </span>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Reveal>
            <div className="card card-hover h-full p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)] sm:text-[11px]">
                Priced honestly
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-xl">
                Real sold comps, not listings
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Borrowing power comes from prices cards actually sold for, cross-sourced
                and outlier-filtered — so a hopeful listing or a wash trade can never
                inflate a loan.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="card card-hover h-full p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)] sm:text-[11px]">
                Never force-liquidated
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-xl">
                Fixed-term, not price-liquidated
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                Illiquid collateral should never be dumped on a wick. A card-backed loan
                runs to a fixed term — you repay and keep the card, or the collateral is
                resolved at maturity. No margin-call liquidation cascade.
              </p>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="card card-hover h-full p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)] sm:text-[11px]">
                Collateral that can sell itself
              </div>
              <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-xl">
                Proven-liquid, so it can be sold
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                We only lend against cards with a real, recent, multi-venue sales record.
                On default, recovery is a straightforward resale into that proven market,
                plus physical redemption — never a reliance on any single buyer.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How we'll value a card ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <Reveal>
            <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
                How a card gets valued
              </h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
                Cross-sourced · manipulation-resistant
              </span>
            </div>
            <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
              The card market is thin and gameable — so valuation is the whole ballgame.
              The design uses independent sources that no single actor can move together.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-3">
            {VALUATION.map((v, i) => (
              <Reveal key={v.title} delay={i * 60}>
                <div className="card h-full p-4 sm:p-6">
                  <div className="font-display text-base font-medium tracking-[-0.02em] sm:text-lg">
                    {v.title}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                    {v.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3">
            {GRADE_KEYS.map((g, i) => (
              <Reveal key={g.k} delay={i * 60}>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    {g.k}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-soft)] sm:text-[13px]">
                    {g.v}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proposed LTV tiers ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <Reveal>
          <div className="mb-5 flex flex-col gap-1.5 sm:mb-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
              Proposed LTV, by liquidity tier
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-xs">
              Design-phase · sized for the drawdown
            </span>
          </div>
          <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
            Card prices have swung 40–70% peak-to-trough in real cycles. These caps are
            set to survive that <em>plus</em> exit fees — conservative on purpose. Final
            numbers are gated on the data work and an external audit.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.tag} delay={i * 80}>
              <div className="card card-hover h-full p-5 sm:p-7">
                <div className="flex flex-wrap items-baseline gap-2 mb-3">
                  <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${toneClass[t.tone]}`}>
                    {t.tag}
                  </span>
                  <span className="text-[11px] text-[var(--ink-faint)]">{t.label}</span>
                </div>
                <div className="font-display tabular text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                  {t.ltv}
                  <span className="ml-2 text-lg text-[var(--ink-soft)] sm:text-xl">max LTV</span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                  {t.body}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {t.examples.map((e) => (
                    <span
                      key={e}
                      className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--ink-soft)] sm:text-[11px]"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── What's collateral-grade ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
          <Reveal>
            <h2 className="font-display mb-5 text-xl font-medium tracking-[-0.02em] sm:mb-8 sm:text-2xl md:text-3xl">
              What&apos;s collateral-grade
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Reveal>
              <div className="card h-full p-5 sm:p-7">
                <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 sm:text-[11px]">
                  Eligible
                </div>
                <ul className="mt-3 space-y-2.5">
                  {INCLUDED.map((x) => (
                    <li key={x} className="flex gap-2.5 text-[13px] leading-snug text-[var(--ink-soft)] sm:text-sm">
                      <span aria-hidden className="mt-0.5 text-emerald-400">✓</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="card h-full p-5 sm:p-7">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:text-[11px]">
                  Declined
                </div>
                <ul className="mt-3 space-y-2.5">
                  {EXCLUDED.map((x) => (
                    <li key={x} className="flex gap-2.5 text-[13px] leading-snug text-[var(--ink-soft)] sm:text-sm">
                      <span aria-hidden className="mt-0.5 text-[var(--ink-faint)]">✕</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Why fixed-term (the cautionary tale) ── */}
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12 md:py-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <div>
              <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl md:text-3xl">
                Why fixed-term, and never a forced sale
              </h2>
              <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                When lenders force-liquidate illiquid collateral on a price dip, a few
                sales crater the floor and trigger the next liquidation — the cascade that
                broke NFT lending. A physical card can&apos;t be dumped in a block, so we
                don&apos;t pretend it can. Loans run to a fixed term with a known,
                conservative exit — the safe way to lend against something that takes days,
                not seconds, to sell.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="card p-5 sm:p-7">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)]">
                The model
              </div>
              <ul className="mt-3 space-y-3 text-[13px] leading-snug text-[var(--ink-soft)] sm:text-sm">
                <li><strong className="text-[var(--ink)]">Fixed term</strong> — no price-triggered liquidation of card collateral.</li>
                <li><strong className="text-[var(--ink)]">Conservative LTV</strong> — sized to survive a 40–70% drawdown plus fees.</li>
                <li><strong className="text-[var(--ink)]">Cross-sourced value</strong> — real sold comps + an independent anchor.</li>
                <li><strong className="text-[var(--ink)]">Proven-liquid only</strong> — recovery by resale into a real market, plus a reserve.</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── In-design status ── */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-6">
        <Reveal>
          <div className="card p-5 sm:p-7">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-deep)] sm:text-[11px]">
              Status · in design
            </div>
            <h3 className="mt-2 font-display text-lg font-medium leading-tight tracking-[-0.02em] sm:text-2xl">
              Not live yet — and we&apos;re building it in the open
            </h3>
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
              The market analysis, valuation oracle, underwriting bands, threat model, and
              open questions are all published. Activation is gated on closing the data
              work, the legal review, and an external audit — we&apos;d rather be late than
              wrong on a brand-new asset class.
            </p>
            <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Read the design
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] sm:text-[13px]">
                <a
                  href={DESIGN_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]"
                >
                  Public design repo →
                </a>
                <Link href="/whitepaper" className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]">
                  Whitepaper →
                </Link>
                <Link href="/security" className="text-[var(--accent-deep)] underline hover:text-[var(--accent)]">
                  Security →
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <h2 className="font-display mx-auto max-w-3xl text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-[var(--bg-elevated)] sm:text-4xl md:text-6xl">
            Your cards stay in the vault.
            <br />
            <span className="italic text-[var(--accent)]">The SOL is borrowed against them.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[var(--bg-elevated)]/70 sm:text-base">
            Collateral that can still sell itself — extended to the cards collectors
            actually hold. In design; follow along as it ships.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:items-center sm:gap-4 md:mt-10 md:flex-row">
            <a
              href={DESIGN_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-base"
            >
              Read the design
              <span aria-hidden>→</span>
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10"
            >
              Follow on Telegram
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
