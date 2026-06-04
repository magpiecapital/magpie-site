import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Params {
  symbol: string;
  amount: string;
}

interface SearchParams {
  ref?: string;
  ltv?: string;
  days?: string;
}

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { symbol, amount } = await params;
  const cleanSymbol = decodeURIComponent(symbol).toUpperCase();
  return {
    title: `${amount} SOL borrowed against $${cleanSymbol} | Magpie`,
    description: `Borrowed ${amount} SOL against $${cleanSymbol} on Magpie Capital without selling. Borrow your bags. Don't sell.`,
    openGraph: {
      title: `${amount} SOL unlocked from $${cleanSymbol}`,
      description: `Borrowed against my $${cleanSymbol} bag on @MagpieLoans — kept every token.`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${amount} SOL against $${cleanSymbol}`,
      description: `Borrowed without selling on Magpie Capital.`,
    },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { symbol, amount } = await params;
  const search = await searchParams;
  const cleanSymbol = decodeURIComponent(symbol).toUpperCase();
  const cleanAmount = decodeURIComponent(amount);
  const ref = search.ref ? `?start=${encodeURIComponent(search.ref)}` : "";

  return (
    <div className="min-h-screen">
      <Header />

      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 md:pt-28 md:pb-20 text-center">
          <div className="chip mb-6">Just borrowed</div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            <span className="tabular">{cleanAmount}</span> SOL
            <br />
            <span className="text-[var(--ink-soft)]">unlocked from</span>{" "}
            <span className="italic">${cleanSymbol}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Borrowed against an existing $<span className="font-semibold">{cleanSymbol}</span>{" "}
            bag on Magpie Capital. The bag stayed put. The SOL is in the wallet now.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a
              href={`${TELEGRAM_URL}${ref}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-base"
            >
              Try it yourself
              <span aria-hidden>→</span>
            </a>
            <Link href="/calculate" className="btn-ghost text-base">
              See what your bag is worth
            </Link>
          </div>

          {search.ltv && search.days && (
            <div className="mt-10 inline-flex items-center gap-4 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] px-5 py-3 text-sm text-[var(--ink-soft)]">
              <span><span className="font-semibold text-[var(--ink)]">{search.ltv}%</span> LTV</span>
              <span className="text-[var(--hairline)]">·</span>
              <span><span className="font-semibold text-[var(--ink)]">{search.days}d</span> term</span>
            </div>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <div className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">
            How does Magpie work?
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed">
            Lock your tokens as collateral, get SOL instantly. Repay any time before the deadline
            to reclaim your tokens. Zero liquidations by design — short terms, low LTV, smart
            health monitoring. All on-chain, all non-custodial, all in Telegram.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs">
            <Link href="/stats" className="underline-offset-4 hover:underline">View live stats</Link>
            <span className="text-[var(--ink-faint)]">·</span>
            <Link href="/tokens" className="underline-offset-4 hover:underline">Supported tokens</Link>
            <span className="text-[var(--ink-faint)]">·</span>
            <Link href="/docs" className="underline-offset-4 hover:underline">Read the docs</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
