/**
 * The tokenize-to-borrow funnel. A collector whose card cleared the vetting
 * gate but isn't vaulted yet lands here: which platform to use, what the
 * process looks like, and the promise that the loan is waiting on the other
 * side. This page is also the partner story in product form — Magpie routes
 * borrower demand INTO the vaulting platforms, so everyone wins: the
 * collector gets liquidity, the platform gets a new vaulted asset, we write
 * the loan.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import {
  FULL_CATALOG,
  TIER_LTV,
  borrowEstimate,
  fmtUsd,
} from "@/lib/collectibles-catalog";

export const metadata: Metadata = {
  title: "Tokenize your collectible, then borrow against it | Magpie",
  description:
    "Card approved but not tokenized yet? We walk you to the right vaulting platform — Collector Crypt, Phygitals and more — and the loan is waiting when you're done. Everyone wins.",
  alternates: { canonical: "https://www.magpie.capital/collectibles/tokenize" },
};

const STEPS = [
  {
    n: "1",
    t: "Get the card approved",
    d: "Run it through the vetting gate. It checks the grader, the grade, the exclusions and where the card stands on the launch list — and tells you exactly what's next.",
    href: "/collectibles#submit",
    cta: "Check your card",
  },
  {
    n: "2",
    t: "Vault & tokenize it",
    d: "Ship the slab to a vaulting platform below. They authenticate it, hold it insured, and issue the on-chain token that represents it. You still own the card — the token IS the card, and you can redeem the physical per the platform's process.",
    href: null,
    cta: null,
  },
  {
    n: "3",
    t: "Come back and borrow",
    d: "Once the token is in your wallet, it can back a fixed-term SOL loan — priced on real sold comps, no margin calls, card returned when you repay.",
    href: "/collectibles",
    cta: "See the terms",
  },
];

const PLATFORMS = [
  {
    name: "Collector Crypt",
    href: "https://collectorcrypt.com",
    chain: "Solana",
    lead: true,
    points: [
      "Graded cards vaulted and issued as Solana NFTs",
      "Marketplace + instant-sale rail on the tokenized side",
      "Redeem the physical card whenever you want it back",
    ],
  },
  {
    name: "Phygitals",
    href: "https://www.phygitals.com",
    chain: "Solana",
    lead: true,
    points: [
      "Custody through established graders and vaulting partners",
      "Solana-native tokens for vaulted cards",
      "Marketplace access on the tokenized side",
    ],
  },
  {
    name: "Courtyard",
    href: "https://courtyard.io",
    chain: "Polygon",
    lead: false,
    points: [
      "Brinks-custodied vaulting, tokens on Polygon",
      "On our watchlist — cross-chain support is being evaluated",
    ],
  },
];

// A collector who arrives from a specific card's "vault it to unlock this"
// link carries context we should honor: which card, and their grade. We
// recompute the figure SERVER-SIDE from the authoritative catalog (never a
// URL-supplied dollar amount) so the banner can never be spoofed via the link.
export default async function TokenizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const cardSlug = typeof sp.card === "string" ? sp.card : undefined;
  const grade = typeof sp.g === "string" ? sp.g : "";
  const item = cardSlug ? FULL_CATALOG.find((i) => i.slug === cardSlug) : undefined;
  const est = item ? borrowEstimate(item.comps, item.tier, grade) : null;
  const single = est ? est.borrowLow === est.borrowHigh : false;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
        {item && (
          <Reveal>
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-dim)]/40 p-5 text-center sm:mb-10 sm:p-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                One step away
              </div>
              <p className="mt-2 font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">
                You&apos;re one step from borrowing against your {item.name}.
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                {est ? (
                  <>
                    Vault it below and the loan is waiting —{" "}
                    <span className="font-semibold text-[var(--accent-deep)]">
                      {single ? `~${fmtUsd(est.borrowHigh)}` : `up to ~${fmtUsd(est.borrowHigh)}`}
                    </span>{" "}
                    at Tier {item.tier} ({est.ltvPct}% LTV{est.gradeLabel ? `, ${est.gradeLabel}` : ""}).
                    An estimate from real sold comps, not an offer — your exact card is comped live at loan time.
                  </>
                ) : (
                  <>
                    Vault it below and the loan is waiting — up to{" "}
                    <span className="font-semibold text-[var(--accent-deep)]">
                      {Math.round(TIER_LTV[item.tier] * 100)}% of its verified value
                    </span>
                    , priced on real sold comps at loan time. Not an offer.
                  </>
                )}{" "}
                <Link href={`/collectibles/${item.slug}`} className="font-semibold text-[var(--accent-deep)] underline-offset-4 hover:underline">
                  See its value breakdown →
                </Link>
              </p>
            </div>
          </Reveal>
        )}
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
              Tokenize to borrow
            </div>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] sm:text-5xl">
              Not tokenized yet?
              <br />
              <span className="italic">We&apos;ll walk you there.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-base">
              If your card clears our checks but isn&apos;t vaulted yet, that&apos;s not a
              dead end — it&apos;s one step. Vault it with one of the platforms below,
              and the loan is waiting on the other side. You get liquidity, the
              platform vaults a new asset, we write the loan.{" "}
              <span className="font-semibold text-[var(--ink)]">Everyone wins.</span>
            </p>
          </div>
        </Reveal>

        {/* The path */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 sm:gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} className="h-full">
              <div className="card flex h-full flex-col p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)]/15 font-display text-lg font-semibold text-[var(--accent-deep)]">
                  {s.n}
                </div>
                <h2 className="mt-4 font-display text-lg font-medium tracking-[-0.02em]">
                  {s.t}
                </h2>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm">
                  {s.d}
                </p>
                {s.href && s.cta && (
                  <Link
                    href={s.href}
                    className="mt-4 text-[13px] font-semibold text-[var(--accent-deep)] underline-offset-4 hover:underline"
                  >
                    {s.cta} →
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        {/* Platforms */}
        <section className="mt-12 sm:mt-16">
          <Reveal>
            <h2 className="font-display text-center text-2xl font-medium tracking-[-0.02em] sm:text-3xl">
              Pick your vaulting platform
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-[var(--ink-soft)] sm:text-base">
              Each authenticates, insures and vaults your card, then issues the
              token that backs your loan. Fees and process are theirs — check
              their sites.
            </p>
          </Reveal>
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 items-stretch gap-4 sm:grid-cols-3 sm:gap-5">
            {PLATFORMS.map((p, i) => (
              <Reveal key={p.name} delay={i * 70} className="h-full">
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex h-full flex-col rounded-2xl border bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${
                    p.lead ? "border-[var(--accent)]/45" : "border-[var(--hairline)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-medium tracking-[-0.01em]">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                      {p.chain}
                    </span>
                  </div>
                  <ul className="mt-3 flex-1 space-y-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                        <span aria-hidden className="mt-0.5 text-emerald-400">✓</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-4 text-[12px] font-semibold text-[var(--accent-deep)] opacity-80 transition group-hover:opacity-100">
                    Start there ↗
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[12px] leading-relaxed text-[var(--ink-faint)] sm:text-[13px]">
            Independent businesses — vaulting fees, timelines and redemption terms
            are set by each platform.
          </p>
        </section>

        {/* Why this matters */}
        <Reveal>
          <section className="mx-auto mt-12 max-w-3xl rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6 text-center sm:mt-16 sm:p-8">
            <h2 className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl">
              Why we built this path
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--ink-soft)] sm:text-[15px]">
              More real-world assets on-chain — that&apos;s the goal. Every card
              tokenized for a loan grows the vaults, deepens the market, and pulls
              the next collector in. We&apos;d rather be the reason assets get
              tokenized than just another place they end up.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/collectibles#submit" className="btn-accent text-sm">
                Check your card first
              </Link>
              <Link href="/collectibles" className="btn-ghost text-sm">
                Browse the catalog
              </Link>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
