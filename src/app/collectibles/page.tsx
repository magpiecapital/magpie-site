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
              <figure className="mx-auto w-full max-w-[230px] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-xl sm:max-w-[290px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/collectibles/charizard-base-set-psa10.jpg"
                  alt="1999 Base Set Charizard Holo #4, graded PSA GEM-MT 10"
                  width={614}
                  height={1000}
                  className="block h-auto w-full"
                />
              </figure>
            </Reveal>
          </div>
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

      {/* ── What you can borrow against ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-20">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl md:text-4xl">
            What you can borrow against
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-[var(--ink-soft)] sm:text-base">
            Liquid, graded cards — the ones that actually sell. Pokémon, sports &amp; top TCG.
          </p>
        </Reveal>
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:gap-6">
          {SLABS.map((s, i) => (
            <Reveal key={s.cap} delay={i * 80}>
              <figure className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.alt} className="block h-auto w-full" />
                <figcaption className="border-t border-[var(--hairline)] px-3 py-2.5 text-center text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)] sm:text-xs">
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
