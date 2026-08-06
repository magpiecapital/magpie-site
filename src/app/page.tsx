import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CountUp } from "@/components/CountUp";
import { LiveProtocolTicker } from "@/components/LiveProtocolTicker";
import { getTokenStats } from "@/lib/db";
import { TELEGRAM_URL } from "@/lib/telegram-links";

export const revalidate = 60;

const X_URL = "https://x.com/MagpieLoans";

/* ─── Data ─── */

// The three collateral classes — the "pick your collateral" chooser. Memecoins
// and tokenized stocks are LIVE (borrow now); collectibles is IN DESIGN.
const CHOOSER = [
  {
    key: "memecoins",
    glyph: "✦",
    status: "Live",
    title: "Memecoins",
    desc: "Borrow SOL against the memecoins you already hold — every token screened for liquidity and capped for safety.",
    examples: "WIF · BONK · POPCAT · Fartcoin",
    href: "/marketplace",
    cta: "Borrow now",
  },
  {
    key: "stocks",
    glyph: "◈",
    status: "Live",
    title: "Tokenized stocks",
    desc: "Borrow against real equities on Solana — without selling. No margin calls, no taxable event, upside intact.",
    examples: "xTSLA · xNVDA · xAAPL · xSPY",
    href: "/marketplace",
    cta: "Borrow now",
  },
  {
    key: "collectibles",
    glyph: "◆",
    status: "In design",
    title: "Collectibles",
    desc: "Borrow against graded trading cards — priced on real sales, fixed-term, and you keep the card.",
    examples: "Graded cards · Pokémon · sports",
    href: "/collectibles",
    cta: "See how it works",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Pick your collateral",
    d: "Choose memecoins, tokenized stocks, or collectibles — connect your wallet on the dashboard, or use the Telegram bot.",
  },
  {
    n: "02",
    t: "Get an instant quote",
    d: "Live pricing shows your SOL payout and terms before you sign. No signup, no seed phrase.",
  },
  {
    n: "03",
    t: "Borrow & repay",
    d: "SOL hits your wallet in seconds. Repay anytime to reclaim your collateral — and build on-chain credit with every repay.",
  },
];

const EARN = [
  {
    chip: "Supply liquidity",
    title: "Deposit SOL, earn loan fees",
    desc: "Fund loans and keep the lion's share of every fee they pay. Withdraw anytime.",
    href: "/earn",
    cta: "Open the LP",
  },
  {
    chip: "Hold $MAGPIE",
    title: "Earn 70% of every fee",
    desc: "Hold the token and receive 70% of all loan fees, distributed automatically to holders.",
    href: "/holders",
    cta: "See holder rewards",
  },
  {
    chip: "Run a keeper",
    title: "Earn liquidation bounties",
    desc: "Liquidations are permissionless — any wallet can execute an overdue loan and earn a bounty.",
    href: "/credit",
    cta: "How it works",
  },
];

const FAQ = [
  { q: "What can I borrow against?", a: "" }, // filled dynamically
  {
    q: "What is LTV?",
    a: "Loan-to-Value — the percentage of your collateral's value you receive as SOL. $1,000 of collateral at 30% LTV = $300 in SOL. Lower LTV = more safety margin.",
  },
  {
    q: "What happens if the price drops?",
    a: "Nothing automatic — a price drop does NOT liquidate you. Magpie loans are fixed-term: keep your collateral through any volatility as long as you repay before the term ends. No margin calls, no health-factor liquidation. Repay, partial-repay, or extend anytime.",
  },
  {
    q: "Is it custodial?",
    a: "No. Collateral sits in on-chain vaults governed by the Anchor program, not anyone's wallet. The contract is publicly auditable and deterministic.",
  },
  {
    q: "How do I earn yield?",
    a: "Deposit SOL into the lending pool on the Earn page and receive pool shares. As borrowers pay fees, the pool grows and your shares are worth more. Withdraw anytime — no lockups.",
  },
  {
    q: "Are collectibles live yet?",
    a: "Not yet — collectibles are the third collateral class, in design. Memecoins and tokenized stocks are live today. The full collectibles design is public at magpie.capital/collectibles.",
  },
];

/* ─── Page ─── */

export default async function Home() {
  const { count: TOKEN_COUNT, memeCount, stockCount } = await getTokenStats();
  const faqTokenAnswer = `Memecoins and tokenized stocks today — ${TOKEN_COUNT} approved tokens (${memeCount} memecoins like WIF, BONK and Fartcoin; ${stockCount} tokenized stocks like xTSLA, xNVDA and xAAPL). Collectibles (graded cards) are in design. See the Approved Tokens page for the full list.`;

  return (
    <div className="min-h-screen">
      <Header />

      {/* ══════════ HERO ══════════ */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-14 sm:px-6 md:pt-24 md:pb-24">
          <h1 className="fade-up fade-up-1 font-display max-w-5xl text-balance [text-wrap:balance] text-[clamp(2.25rem,8vw,7rem)] leading-[0.95] tracking-[-0.04em] font-medium sm:leading-[0.92]">
            Liquidity without{" "}
            <br className="hidden sm:block" />
            <span className="italic">selling your bag.</span>
          </h1>

          <p className="fade-up fade-up-2 mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] sm:mt-7 sm:text-xl">
            Borrow SOL against your memecoins, tokenized stocks, and collectibles —
            in seconds, without selling. Keep your upside; get liquidity now.
          </p>

          <div className="fade-up fade-up-3 mt-8 flex flex-wrap items-center gap-3 sm:mt-9 sm:gap-4">
            <Link href="/marketplace" className="btn-accent shimmer text-sm sm:text-base">
              Start borrowing
              <span aria-hidden>→</span>
            </Link>
            <Link href="/earn" className="btn-ghost text-sm sm:text-base">
              Earn yield
            </Link>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm sm:text-base"
            >
              Use the Telegram bot →
            </a>
          </div>

          {/* Value-prop stat strip */}
          <div className="fade-up fade-up-4 mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] shadow-sm sm:grid-cols-4 md:mt-14">
            {[
              { v: "<10s", l: "SOL in your wallet" },
              { v: "1.5–3%", l: "Flat fee · no surprises" },
              { v: null, l: "Tokens you can borrow against" },
              { v: "100%", l: "Non-custodial & on-chain" },
            ].map((s, i) => (
              <div key={i} className="bg-[var(--bg-elevated)] px-4 py-4 text-center md:px-6 md:py-5">
                <div className="font-display tabular text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">
                  {s.v === null ? <CountUp value={TOKEN_COUNT} /> : s.v}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          {/* Live protocol ticker — auto-loads; renders nothing if unavailable. */}
          <LiveProtocolTicker />

          <div className="pointer-events-none absolute right-8 top-32 hidden opacity-90 lg:block">
            <div className="hop">
              <Mark size={240} variant="static" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PICK YOUR COLLATERAL ══════════ */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
          <Reveal>
            <div className="chip mb-4">Pick your collateral</div>
            <h2 className="font-display max-w-3xl text-3xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-4xl md:text-5xl">
              What do you want to borrow against?
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
              Three collateral classes, one protocol. Pick what you hold and get SOL —
              non-custodial, on Solana.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 md:mt-10">
            {CHOOSER.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="group flex flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:shadow-md md:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl text-[var(--accent-deep)]" aria-hidden>{c.glyph}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                      c.status === "Live"
                        ? "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                        : "border border-[var(--hairline)] text-[var(--ink-faint)]"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === "Live" ? "bg-green-500" : "bg-[var(--ink-faint)]"}`} />
                    {c.status}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-medium tracking-[-0.01em]">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{c.desc}</p>
                <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">{c.examples}</div>
                <div className="mt-auto pt-6 text-sm font-semibold text-[var(--accent-deep)]">
                  {c.cta}{" "}
                  <span className="inline-block transition group-hover:translate-x-0.5" aria-hidden>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ COLLECTIBLES SPOTLIGHT ══════════ */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        <Reveal>
          <div className="overflow-hidden rounded-[2rem] border border-[var(--hairline)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg-elevated)] p-6 sm:p-10 md:p-14">
            <div className="grid items-center gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
              <div className="mx-auto w-full max-w-[260px] md:justify-self-start">
                <figure className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/collectibles/charizard-base-set-psa10.jpg"
                    alt="1999 Base Set Charizard Holo #4, graded PSA GEM-MT 10"
                    width={614}
                    height={1000}
                    className="block h-auto w-full"
                  />
                </figure>
              </div>
              <div>
                <div className="chip mb-4">New collateral class · in design</div>
                <h2 className="font-display text-3xl font-medium leading-[1.04] tracking-[-0.02em] sm:text-4xl md:text-5xl">
                  Your collectibles,
                  <br />
                  <span className="italic">finally liquid.</span>
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
                  Borrow SOL against your graded trading cards — Pokémon, sports and top
                  TCG — without selling them. Priced on what they actually sold for, and
                  only the proven-liquid ones.
                </p>
                <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ["Real sold-comp pricing", "Valued on real sales across marketplaces — never listings."],
                    ["Only proven-liquid cards", "We vet each one closely. If it doesn't reliably sell, we don't lend."],
                    ["Never force-liquidated", "Fixed-term — your card is never dumped on a price dip."],
                    ["Every platform, one place", "Cards vaulted on Collector Crypt, Courtyard, Phygitals & more."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-snug">
                      <span aria-hidden className="mt-0.5 flex-none text-emerald-500">✓</span>
                      <span>
                        <span className="font-semibold text-[var(--ink)]">{t}.</span>{" "}
                        <span className="text-[var(--ink-soft)]">{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/collectibles" className="btn-accent">
                    See how it works <span aria-hidden>→</span>
                  </Link>
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                  >
                    Explore all collateral
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
        <Reveal>
          <div className="chip mb-4">How it works</div>
          <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.02em] sm:text-4xl md:text-5xl">
            Borrow in three steps.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:gap-5 md:mt-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="card h-full p-6 sm:p-7">
                <div className="font-mono text-sm text-[var(--accent-deep)]">{s.n}</div>
                <h3 className="mt-3 font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ EARN ══════════ */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
          <Reveal>
            <div className="chip mb-4">Earn</div>
            <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.02em] sm:text-4xl md:text-5xl">
              Every loan pays. Pick your side.
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:gap-5 md:mt-10 md:grid-cols-3">
            {EARN.map((e, i) => (
              <Reveal key={e.chip} delay={i * 80}>
                <Link
                  href={e.href}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface)]"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">{e.chip}</div>
                  <div className="mt-3 font-display text-xl font-medium tracking-tight sm:text-2xl">{e.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{e.desc}</p>
                  <div className="mt-auto pt-5 text-sm font-semibold text-[var(--accent-deep)]">{e.cta} →</div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-24">
        <Reveal>
          <div className="chip mb-4">Questions</div>
          <h2 className="font-display max-w-3xl text-3xl font-medium tracking-[-0.02em] sm:text-4xl md:text-5xl">
            What you&apos;ll want to know.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-x-16 gap-y-7 sm:mt-12 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={(i % 2) * 80}>
              <div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-[var(--accent-deep)]">{String(i + 1).padStart(2, "0")}</span>
                  <div className="text-base font-semibold tracking-tight sm:text-lg">{item.q}</div>
                </div>
                <div className="mt-2 pl-9 text-sm leading-relaxed text-[var(--ink-soft)]">
                  {item.q === "What can I borrow against?" ? faqTokenAnswer : item.a}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ CLOSING CTA ══════════ */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:px-6 md:py-28">
          <Mark size={64} className="mx-auto mb-8 hop" />
          <h2 className="font-display mx-auto max-w-4xl text-4xl font-medium tracking-[-0.04em] text-[var(--bg-elevated)] sm:text-6xl md:text-7xl">
            Your bags.
            <br />
            <span className="italic text-[var(--accent)]">Your liquidity.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-[var(--bg-elevated)]/70 sm:text-lg">
            Borrow SOL, earn yield, build on-chain credit — all permissionless, all on Solana.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/marketplace" className="btn-accent text-base sm:text-lg">
              Start borrowing
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/earn"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10"
            >
              Earn yield
            </Link>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10"
            >
              Follow on 𝕏
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
