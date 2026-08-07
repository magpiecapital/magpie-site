"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The "what can I borrow against?" chooser — the first thing a visitor should
 * understand about Magpie: three collateral classes, one protocol.
 *
 * Every class shows REAL collateral imagery so the answer is visual, not just
 * a ticker list. Image sources, deliberately chosen for rights safety:
 *   - Memecoins ...... DexScreener token CDN (the same source /marketplace and
 *                      the token marquee already use for coin logos).
 *   - Tokenized stocks each xStock's OFFICIAL token logo as published by the
 *                      issuer (Backed) at xstocks-metadata.backed.fi, mirrored
 *                      into /public/tokens so we don't hotlink a third party.
 *                      These are the identity images of the very tokens we
 *                      accept as collateral — we render the asset's own logo,
 *                      we don't redraw a company's brand assets ourselves.
 *   - Collectibles ... photographs of slabs the operator personally owns
 *                      (copyright-cleared). We never reproduce Pokémon art,
 *                      grader marks, or marketplace product photos.
 *
 * Structure is IDENTICAL across all three cards — same art band height, same
 * body padding, same bottom-aligned CTA — so the row stays uniform at every
 * breakpoint and no column reads as an afterthought.
 */

type Status = "Live" | "In design";

const MEMECOINS = [
  { symbol: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "POPCAT", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  { symbol: "PENGU", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" },
  { symbol: "FARTCOIN", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" },
];

const STOCKS = [
  { symbol: "xTSLA", src: "/tokens/xTSLA.png" },
  { symbol: "xAAPL", src: "/tokens/xAAPL.png" },
  { symbol: "xNVDA", src: "/tokens/xNVDA.png" },
  { symbol: "xMSTR", src: "/tokens/xMSTR.png" },
  { symbol: "xCOIN", src: "/tokens/xCOIN.png" },
];

const SLABS = [
  {
    src: "/collectibles/jordan-fleer-1986-psa9.jpg",
    alt: "1986 Fleer Michael Jordan rookie card, PSA 9 graded slab",
    className: "-rotate-[9deg] translate-x-3",
  },
  {
    src: "/collectibles/charizard-base-set-psa10.jpg",
    alt: "1999 Base Set Charizard, PSA 10 Gem Mint graded slab",
    className: "rotate-[7deg] -translate-x-3 z-10",
  },
];

/** One round token logo, degrading to a lettered disc if the CDN 404s. */
function Coin({ symbol, src }: { symbol: string; src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bg-elevated)] bg-[var(--accent-dim)] text-xs font-bold text-[var(--accent-deep)] shadow-sm sm:h-12 sm:w-12"
        title={symbol}
      >
        {symbol[0]}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={symbol}
      title={symbol}
      loading="lazy"
      onError={() => setFailed(true)}
      /* The outer ring matters: several token logos (Fartcoin, some xStocks)
         are near-black, and without a defined edge they read as a hole in the
         art band rather than a coin. */
      className="h-11 w-11 shrink-0 rounded-full border-2 border-[var(--bg-elevated)] bg-[var(--surface-strong)] object-cover shadow-sm ring-1 ring-[var(--hairline-strong)] transition duration-300 group-hover:-translate-y-0.5 sm:h-12 sm:w-12"
    />
  );
}

/** Overlapping cluster of coins/tiles — the shared art treatment for tokens. */
function CoinCluster({ items }: { items: { symbol: string; src: string }[] }) {
  return (
    <div className="flex items-center pl-2">
      {items.map((t, i) => (
        <div
          key={t.symbol}
          className="-ml-2 first:ml-0"
          style={{ zIndex: items.length - i }}
        >
          <Coin symbol={t.symbol} src={t.src} />
        </div>
      ))}
    </div>
  );
}

/** The two real graded slabs, fanned like cards in a hand. */
function SlabFan() {
  return (
    <div className="flex items-center justify-center">
      {SLABS.map((s) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={s.src}
          src={s.src}
          alt={s.alt}
          loading="lazy"
          className={`h-24 w-auto rounded-md border border-[var(--hairline)] object-contain shadow-[var(--shadow-md)] transition duration-300 group-hover:-translate-y-0.5 sm:h-28 ${s.className}`}
        />
      ))}
    </div>
  );
}

const CLASSES: {
  key: string;
  status: Status;
  title: string;
  desc: string;
  tickers: string;
  href: string;
  cta: string;
  art: React.ReactNode;
}[] = [
  {
    key: "memecoins",
    status: "Live",
    title: "Memecoins",
    desc: "Borrow SOL against the coins you already hold. Every token screened for real liquidity and capped for safety.",
    tickers: "WIF · BONK · POPCAT · PENGU · FARTCOIN",
    href: "/marketplace",
    cta: "Borrow now",
    art: (
      <CoinCluster
        items={MEMECOINS.map((m) => ({
          symbol: m.symbol,
          src: `https://dd.dexscreener.com/ds-data/tokens/solana/${m.mint}.png`,
        }))}
      />
    ),
  },
  {
    key: "stocks",
    status: "Live",
    title: "Tokenized stocks",
    desc: "Borrow against real equities on Solana — without selling. No margin calls, no taxable event, upside intact.",
    tickers: "xTSLA · xAAPL · xNVDA · xMSTR · xCOIN",
    href: "/marketplace",
    cta: "Borrow now",
    art: <CoinCluster items={STOCKS} />,
  },
  {
    key: "collectibles",
    status: "In design",
    title: "Collectibles",
    desc: "Borrow against graded trading cards — priced on what they actually sell for. Fixed-term, and you keep the card.",
    tickers: "Graded cards · Pokémon · Sports",
    href: "/collectibles",
    cta: "See how it works",
    art: <SlabFan />,
  },
];

export function CollateralChooser() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {CLASSES.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]/60 hover:shadow-[var(--shadow-md)]"
        >
          {/* Art band — fixed height on every card so the row stays level. */}
          <div className="relative flex h-36 shrink-0 items-center justify-center overflow-hidden border-b border-[var(--hairline)] bg-gradient-to-br from-[var(--surface)] via-[var(--bg-elevated)] to-[var(--surface)] sm:h-40">
            {c.art}
            <span
              className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                c.status === "Live"
                  ? "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                  : "border border-[var(--hairline-strong)] bg-[var(--bg-elevated)]/80 text-[var(--ink-faint)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  c.status === "Live" ? "bg-green-500" : "bg-[var(--ink-faint)]"
                }`}
              />
              {c.status}
            </span>
          </div>

          {/* Body — identical padding + bottom-aligned CTA on all three. */}
          <div className="flex flex-1 flex-col p-6 md:p-7">
            <h3 className="font-display text-xl font-medium tracking-[-0.01em]">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{c.desc}</p>
            <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              {c.tickers}
            </div>
            <div className="mt-auto pt-6 text-sm font-semibold text-[var(--accent-deep)]">
              {c.cta}{" "}
              <span className="inline-block transition group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
