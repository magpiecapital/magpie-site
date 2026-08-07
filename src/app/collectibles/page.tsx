import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const DESIGN_REPO = "https://github.com/magpiecapital/magpie-collectibles-lending";

export const metadata: Metadata = {
  title: "Borrow against graded trading cards | Magpie",
  description:
    "Borrow SOL against your graded trading cards without selling them — priced on real sales, fixed-term, keep your card. In design; see how it works.",
  openGraph: {
    title: "Borrow against your graded cards | Magpie",
    description:
      "Get SOL against your graded cards without selling them. Priced on real sales. Fixed-term. In design.",
  },
};

const STEPS = [
  {
    n: "1",
    t: "Pick your card",
    d: "Your graded card, already vaulted and tokenized on a platform like Collector Crypt, Courtyard or Phygitals.",
  },
  {
    n: "2",
    t: "See its value",
    d: "We price it on what cards like yours actually sold for recently — not asking prices.",
  },
  {
    n: "3",
    t: "Borrow SOL",
    d: "Get up to 50% of that value. Fixed term — repay when you're ready and keep your card.",
  },
];

// The hero fan. All three are photographs of slabs the operator personally
// owns (copyright-cleared) — we never use marketplace product photos.
// Charizard leads: biggest, centred, in front.
const HERO_FAN = [
  {
    src: "/collectibles/blastoise-base-set-shadowless-psa9.jpg",
    alt: "1999 Base Set Shadowless Blastoise Holo #2, graded PSA MINT 9",
    wrap: "w-[34%] -mr-[9%] -rotate-[11deg] translate-y-[6%]",
  },
  {
    src: "/collectibles/charizard-base-set-psa10.jpg",
    alt: "1999 Base Set Charizard Holo #4, graded PSA GEM-MT 10",
    wrap: "relative z-10 w-[42%]",
  },
  {
    src: "/collectibles/curry-2009-topps-rc-auto.jpg",
    alt: "2009 Topps Stephen Curry rookie #321, PSA/DNA authenticated with a 10 autograph",
    wrap: "w-[34%] -ml-[9%] rotate-[11deg] translate-y-[6%]",
  },
];

const SLABS = [
  {
    img: "/collectibles/charizard-base-set-psa10.jpg",
    alt: "1999 Base Set Charizard Holo #4, graded PSA GEM-MT 10",
    cap: "Base Set Charizard · PSA 10",
  },
  {
    img: "/collectibles/jordan-fleer-1986-psa9.jpg",
    alt: "1986 Fleer Michael Jordan rookie #57, graded PSA 9",
    cap: "1986 Fleer Jordan · PSA 9",
  },
];

const ACCEPT = [
  "Graded by PSA, CGC, BGS or SGC",
  "Cards that actually sell — Pokémon, sports & top TCG",
  "Already vaulted & tokenized on a platform we support",
];

// Why a collector would borrow rather than sell. Each line is a real property
// of a permissionless, fixed-term, over-collateralised loan — no tax advice,
// no claims about what any other venue charges.
const WHY = [
  {
    t: "You keep the card",
    d: "Sell it and it's gone. Borrow against it and it comes back to you when you repay.",
  },
  {
    t: "You keep the upside",
    d: "If your card climbs while the loan is open, that gain is still yours — not the buyer's.",
  },
  {
    t: "No bank, no credit check",
    d: "Permissionless. No application, no income docs, no approval queue — your card is the whole story.",
  },
  {
    t: "No consignment wait",
    d: "No auction calendar and no months-long consignment cycle before you see money.",
  },
];

// The launch allowlist, mirrored from the design repo (doc 26). Types only —
// every individual cert is still re-checked against live sold data at loan
// time, and we quote no dollar values because real values come from the
// licensed feeds at onboarding, not from a hardcoded table.
const ALLOWLIST = [
  {
    tier: "Tier A",
    lead: true,
    blurb: "Blue-chip vintage — the deepest, most consistent sales records.",
    ltv: "50",
    grades: "PSA / CGC / BGS 9–10",
    term: "30–60 days",
    rate: "~10–12% APR",
    items: [
      { card: "Charizard #4", meta: "Base Set · 1999" },
      { card: "Blastoise #2", meta: "Base Set · 1999" },
      { card: "Venusaur #15", meta: "Base Set · 1999" },
      { card: "Lugia #9", meta: "Neo Genesis · 2000" },
      { card: "Michael Jordan #57", meta: "Fleer · 1986" },
    ],
  },
  {
    tier: "Tier B",
    lead: false,
    blurb: "Liquid, a notch thinner — same standard, wider safety margin.",
    ltv: "40",
    grades: "Grades 8–10",
    term: "30–90 days",
    rate: "~12–14% APR",
    items: [
      { card: "Base Set holo rares", meta: "Zapdos · Chansey · Mewtwo · Alakazam" },
      { card: "Jungle & Fossil holos", meta: "1st Edition · 1999" },
      { card: "Grade 8 of any Tier A card", meta: "Same cards, lower grade" },
      { card: "LeBron James #111", meta: "Topps Chrome · 2003-04" },
      { card: "Other iconic rookies", meta: "On proven liquidity" },
    ],
  },
];

// Platforms that already vault + tokenize graded cards. These are INDEPENDENT
// businesses. We link out and use each mark nominatively, to
// identify where a collector's card already lives. Marks are mirrored locally
// from each platform's own public site assets rather than hotlinked.
// Phygitals blocks automated requests, so we have no logo file for it yet and
// it renders the same tile with a monogram until we're given one.
const PLATFORMS = [
  { name: "Collector Crypt", href: "https://collectorcrypt.com", logo: "/collectibles/platforms/collector-crypt.svg" },
  { name: "Courtyard", href: "https://courtyard.io", logo: "/collectibles/platforms/courtyard.png" },
  { name: "Phygitals", href: "https://www.phygitals.com", logo: null },
  { name: "Beezie", href: "https://beezie.com", logo: "/collectibles/platforms/beezie.png" },
];

const EXCLUDED = [
  {
    t: "One-of-a-kind trophies",
    d: "Pikachu Illustrator and the like. No population means no comps — priceless isn't the same as sellable.",
  },
  { t: "Ungraded or raw", d: "No authentication anchor we can verify against a grader's records." },
  { t: "Below grade 8", d: "Sales get sparse and the spread gets wide — too thin to underwrite." },
  { t: "Modern hype & sealed", d: "Exposed to reprints and hype cycles. Staged for later, not launch." },
];

const SAFETY = [
  { t: "Real prices", d: "Valued on real sales, never listings." },
  { t: "No surprise sell-offs", d: "Fixed-term — your card is never dumped on a price dip." },
  { t: "Only liquid cards", d: "If it doesn't reliably sell, we don't lend on it." },
];

const APPROVAL = [
  {
    t: "Authenticated",
    d: "Graded by PSA, CGC, BGS or SGC — with a cert we verify against the grader's records, plus tamper and counterfeit checks.",
  },
  {
    t: "Proven to sell",
    d: "We confirm the exact card has actually sold — recently and repeatedly — across multiple marketplaces. No real sales record, no loan.",
  },
  {
    t: "Independently priced",
    d: "Its value is cross-checked against sold data from independent sources, so no single market can inflate it.",
  },
  {
    t: "Approved & sized",
    d: "Only cards that clear every check are approved — at a conservative LTV, with room to spare.",
  },
];

export default function CollectiblesPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-6 md:pt-24 md:pb-16">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_auto] md:gap-14">
            <Reveal>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-medium shadow-sm sm:text-xs">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-[var(--ink-faint)]">Collectibles · in design</span>
              </div>
              <h1 className="font-display text-[2.25rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
                Borrow against your cards.
                <br />
                <span className="italic">Without selling them.</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-lg">
                Get SOL against your graded trading cards — priced on what they really
                sell for. Repay when you&apos;re ready and keep the card.
              </p>
              <div className="mt-6">
                <a href="#how" className="btn-accent text-sm">
                  See how it works<span aria-hidden>↓</span>
                </a>
              </div>
            </Reveal>
            <Reveal delay={120}>
              {/* Three real slabs fanned like cards in a hand — Charizard
                  leads at full size and in front, the other two sit back and
                  tilt away. Percentage widths so the whole fan scales with
                  the container instead of breaking at small widths. */}
              <div className="mx-auto flex w-full max-w-[320px] items-center justify-center sm:max-w-[420px]">
                {HERO_FAN.map((s) => (
                  <figure key={s.src} className={s.wrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.src}
                      alt={s.alt}
                      className="block h-auto w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]"
                    />
                  </figure>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Why borrow instead of selling ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-16">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
            Why borrow instead of selling?
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:mt-10 md:grid-cols-4">
          {WHY.map((w, i) => (
            <Reveal key={w.t} delay={i * 70}>
              <div className="card h-full p-5 sm:p-6">
                <h3 className="font-display text-base font-medium tracking-[-0.01em] sm:text-lg">
                  {w.t}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                  {w.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-20">
          <Reveal>
            <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-[14px] text-[var(--ink-soft)] sm:text-base">
              Three steps. Your card stays safe in the vault the whole time.
            </p>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="card h-full p-6 sm:p-8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)]/15 font-display text-lg font-semibold text-[var(--accent-deep)]">
                    {s.n}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-medium tracking-[-0.02em] sm:text-xl">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Where cards are already vaulted ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-16">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
            Already vaulted? You&apos;re ready.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-[var(--ink-soft)] sm:text-base">
            If your card is vaulted and tokenized on one of these, it can back a loan —
            whichever one you use.
          </p>
        </Reveal>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {PLATFORMS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60} className="h-full">
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 text-center shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]/60 hover:shadow-[var(--shadow-md)] sm:p-6"
              >
                {p.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.logo}
                    alt={`${p.name} logo`}
                    className="h-10 w-10 rounded-xl object-contain sm:h-12 sm:w-12"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-strong)] font-display text-lg font-semibold text-[var(--ink-soft)] sm:h-12 sm:w-12"
                  >
                    {p.name[0]}
                  </span>
                )}
                <span className="text-[13px] font-semibold sm:text-sm">{p.name}</span>
                <span className="text-[11px] text-[var(--ink-faint)] transition group-hover:text-[var(--accent-deep)]">
                  Visit ↗
                </span>
              </a>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-xl text-center text-[12px] leading-relaxed text-[var(--ink-faint)] sm:text-[13px]">
          The platforms collectors already use to vault and tokenize graded cards.
        </p>
      </section>

      {/* ── What you can borrow against ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-20">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
            Approved collateral
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-[var(--ink-soft)] sm:text-base">
            Liquid, graded cards — the ones that actually sell. Pokémon, sports &amp; top TCG.
          </p>
        </Reveal>
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:gap-6">
          {SLABS.map((s, i) => (
            <Reveal key={s.cap} delay={i * 80} className="h-full">
              {/* The two slabs have different native aspect ratios, so the
                  image sits in a fixed-ratio box — otherwise the taller card
                  drags its caption out of line with its neighbour. */}
              <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-lg">
                <div className="flex aspect-[3/4] items-center justify-center p-3 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.img}
                    alt={s.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <figcaption className="mt-auto border-t border-[var(--hairline)] px-3 py-2.5 text-center text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)] sm:text-xs">
                  {s.cap}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2.5 sm:mt-8">
          {ACCEPT.map((a, i) => (
            <Reveal key={a} delay={i * 50}>
              <div className="flex items-center gap-2.5 text-[13px] text-[var(--ink-soft)] sm:text-sm">
                <span aria-hidden className="text-emerald-400">✓</span>
                <span>{a}</span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The launch allowlist as a pair of rating cards: a header band
            carrying the tier, its character and the max LTV as a display
            figure, then one ruled row per accepted card with its set and
            year. Both cards share every dimension so the pair reads level. */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 items-stretch gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2">
          {ALLOWLIST.map((t, i) => (
            <Reveal key={t.tier} delay={i * 80} className="h-full">
              <div
                className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] ${
                  t.lead
                    ? "border-[var(--accent)]/45"
                    : "border-[var(--hairline)]"
                }`}
              >
                {/* Header band */}
                <div
                  className={`flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5 ${
                    t.lead
                      ? "border-[var(--accent)]/25 bg-[var(--accent-dim)]/50"
                      : "border-[var(--hairline)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">
                        {t.tier}
                      </span>
                      {t.lead && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                          Top tier
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                      {t.blurb}
                    </p>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      {t.grades}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className="font-display tabular text-3xl font-medium leading-none tracking-[-0.03em] text-[var(--accent-deep)] sm:text-4xl">
                      {t.ltv}
                      <span className="text-xl sm:text-2xl">%</span>
                    </div>
                    <div className="mt-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      Max LTV
                    </div>
                  </div>
                </div>

                {/* Terms strip — the same three facts the memecoin and
                    tokenized-stock cards lead with: how much, how long,
                    what it costs. */}
                <div className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)] bg-[var(--surface)]/40">
                  <div className="px-5 py-3 sm:px-6">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      Term
                    </div>
                    <div className="mt-1 font-display text-base font-medium tracking-[-0.01em] sm:text-lg">
                      {t.term}
                    </div>
                  </div>
                  <div className="px-5 py-3 sm:px-6">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      Rate
                    </div>
                    <div className="mt-1 font-display text-base font-medium tracking-[-0.01em] sm:text-lg">
                      {t.rate}
                    </div>
                  </div>
                </div>

                {/* One ruled row per accepted card */}
                <ul className="flex flex-1 flex-col divide-y divide-[var(--hairline)]">
                  {t.items.map((it) => (
                    <li
                      key={it.card}
                      className="flex items-baseline justify-between gap-3 px-5 py-3 sm:px-6"
                    >
                      <span className="text-[13px] font-medium text-[var(--ink)] sm:text-sm">
                        {it.card}
                      </span>
                      <span className="flex-none text-right text-[11px] tracking-[0.02em] text-[var(--ink-faint)] sm:text-[12px]">
                        {it.meta}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-[var(--hairline)] px-5 py-3 text-[11px] leading-relaxed text-[var(--ink-faint)] sm:px-6 sm:text-[12px]">
                  Fixed rate, fixed term · no origination fee · no margin calls
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[12px] leading-relaxed text-[var(--ink-faint)] sm:text-[13px]">
          Terms are design targets while collectibles are in design — not a live
          offer. Renewals re-appraise the card rather than rolling over automatically.
        </p>

        <Reveal>
          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:mt-8 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Not accepted
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {EXCLUDED.map((e) => (
                <li key={e.t} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-[var(--hairline-strong)] text-[10px] text-[var(--ink-faint)]"
                  >
                    ✕
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[var(--ink)] sm:text-sm">
                      {e.t}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                      {e.d}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[12px] leading-relaxed text-[var(--ink-faint)] sm:text-[13px]">
          The launch list — it grows as more cards prove they sell. Every individual
          card is still checked against live sold data when the loan is made.
        </p>
      </section>

      {/* ── How a card gets approved ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-20">
          <Reveal>
            <div className="mx-auto max-w-lg text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                Vetted closely
              </div>
              <h2 className="mt-2 font-display text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
                How a card gets approved
              </h2>
              <p className="mt-3 text-[14px] text-[var(--ink-soft)] sm:text-base">
                We&apos;re picky on purpose. Every card clears the same four checks before
                it can back a loan — and we&apos;d rather decline than lend on something we
                can&apos;t value or exit.
              </p>
            </div>
          </Reveal>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
            {APPROVAL.map((a, i) => (
              <Reveal key={a.t} delay={i * 70}>
                <div className="card h-full p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-500">
                      ✓
                    </span>
                    <h3 className="font-display text-base font-medium tracking-[-0.01em] sm:text-lg">
                      {a.t}
                    </h3>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                    {a.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why it's safe ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-16">
        <div>
          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
            {SAFETY.map((s, i) => (
              <Reveal key={s.t} delay={i * 70}>
                <div className="text-center md:text-left">
                  <div className="font-display text-base font-medium tracking-[-0.02em] sm:text-lg">
                    {s.t}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── In design + CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-14 text-center sm:px-6 sm:py-20 md:py-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-3 py-1.5 text-[11px] font-medium sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-[var(--bg-elevated)]/70">In design — building it in the open</span>
          </div>
          <h2 className="font-display mx-auto max-w-2xl text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-[var(--bg-elevated)] sm:text-4xl md:text-5xl">
            Your cards stay in the vault.
            <br />
            <span className="italic text-[var(--accent)]">The SOL is borrowed against them.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[var(--bg-elevated)]/70 sm:text-base">
            Not live yet — follow along as it ships.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-base"
            >
              Follow on Telegram<span aria-hidden>→</span>
            </a>
            <a
              href={DESIGN_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10"
            >
              See the full design
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
