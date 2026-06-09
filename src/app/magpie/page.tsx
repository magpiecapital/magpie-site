/**
 * Public $MAGPIE token info page.
 *
 * The single URL we can hand to listing reviewers (CoinMarketCap,
 * CoinGecko, exchanges, partners) that consolidates everything they'd
 * normally have to gather by hand: mint, supply numbers, explorer
 * links, contract details, fundamentals.
 *
 * Pulls live numbers via the same supply endpoints CMC / CoinGecko
 * actually consume, so what reviewers see here matches what they
 * get from /api/v1/supply.
 */
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "$MAGPIE Token | Magpie Capital",
  description:
    "Official $MAGPIE token info. Contract address, supply breakdown, explorer links, and listing data for CoinMarketCap, CoinGecko, and exchange reviewers.",
  openGraph: {
    title: "$MAGPIE — Magpie Capital",
    description:
      "Permissionless lending protocol on Solana. $MAGPIE token info, supply, and explorer links.",
  },
};

async function safeBreakdown() {
  try {
    return await getMagpieSupplyBreakdown();
  } catch {
    return null;
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(3)}k`;
  return n.toFixed(0);
}

export default async function MagpiePage() {
  const supply = await safeBreakdown();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://magpie.capital";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight">$MAGPIE</h1>
          <div className="mt-1 text-sm text-[var(--ink-soft)]">Magpie Capital · Solana · Token-2022</div>
          <p className="mt-4 text-base text-[var(--ink-soft)] max-w-prose">
            Permissionless lending protocol on Solana. Borrow SOL against memecoin
            and tokenized-stock collateral, supply liquidity to earn yield, and
            build an on-chain credit score. $MAGPIE holders receive 10% of every
            loan fee as SOL distributions.
          </p>
        </div>

        {/* Contract */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Contract
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Network</dt>
              <dd className="font-medium">Solana mainnet</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Token program</dt>
              <dd className="font-medium">Token-2022</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Decimals</dt>
              <dd className="font-medium">6</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Launch</dt>
              <dd className="font-medium">April 17, 2026</dd>
            </div>
          </dl>
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Mint address</div>
            <div className="mt-1 font-mono text-xs break-all bg-[var(--bg)] border border-[var(--hairline)] rounded-md px-3 py-2">
              {MAGPIE_MINT_STR}
            </div>
          </div>
        </section>

        {/* Supply */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Supply (live)
            </div>
            {supply && (
              <div className="text-[10px] text-[var(--ink-faint)]">
                as of {new Date(supply.fetched_at).toLocaleTimeString()}
              </div>
            )}
          </div>
          {supply ? (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Circulating</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">{fmt(supply.circulating_supply)}</dd>
                  <dd className="text-[10px] text-[var(--ink-faint)] tabular-nums">{supply.circulating_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Total</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">{fmt(supply.total_supply)}</dd>
                  <dd className="text-[10px] text-[var(--ink-faint)] tabular-nums">{supply.total_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Non-circulating</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">{fmt(supply.non_circulating)}</dd>
                  <dd className="text-[10px] text-[var(--ink-faint)] tabular-nums">{supply.non_circulating.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                </div>
              </dl>
              {supply.non_circulating_components.some((c) => Number(c.balance_raw) > 0) && (
                <div className="mt-4 pt-4 border-t border-[var(--hairline)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)] mb-2">
                    Non-circulating breakdown
                  </div>
                  <ul className="text-xs space-y-1">
                    {supply.non_circulating_components
                      .filter((c) => Number(c.balance_raw) > 0)
                      .map((c) => (
                        <li key={c.wallet} className="flex items-baseline justify-between gap-3">
                          <span className="text-[var(--ink-soft)]">{c.label}</span>
                          <span className="tabular-nums">{fmt(c.balance)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-[var(--ink-soft)]">Supply unavailable right now — RPC fetch failed. Retry shortly.</div>
          )}
        </section>

        {/* Listing-data endpoints */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Listing-data endpoints
          </div>
          <p className="text-xs text-[var(--ink-soft)] mb-3">
            For listing aggregators (CoinMarketCap, CoinGecko, exchange reviewers).
            Plain-text endpoints return a single number; JSON endpoints return full structured data.
          </p>
          <ul className="text-xs space-y-2 font-mono">
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/supply/circulating</code> <span className="text-[var(--ink-faint)]">— circulating supply (plain text)</span></li>
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/supply/total</code> <span className="text-[var(--ink-faint)]">— total supply (plain text)</span></li>
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/supply</code> <span className="text-[var(--ink-faint)]">— full breakdown (JSON)</span></li>
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/info</code> <span className="text-[var(--ink-faint)]">— project metadata (JSON)</span></li>
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/stats</code> <span className="text-[var(--ink-faint)]">— protocol stats (JSON)</span></li>
            <li><span className="text-[var(--ink-faint)]">GET</span> <code className="text-[var(--accent-deep)]">/api/v1/health</code> <span className="text-[var(--ink-faint)]">— protocol health (JSON)</span></li>
          </ul>
        </section>

        {/* External verification */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Verify externally
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <a href={`https://solscan.io/token/${MAGPIE_MINT_STR}`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">Solscan ↗</a>
            <a href={`https://dexscreener.com/solana/${MAGPIE_MINT_STR}`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">DexScreener ↗</a>
            <a href={`https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">Birdeye ↗</a>
            <a href={`${base}/whitepaper`} className="underline text-[var(--accent-deep)]">Whitepaper</a>
            <a href={`${base}/security`} className="underline text-[var(--accent-deep)]">Security</a>
            <a href={`${base}/stats`} className="underline text-[var(--accent-deep)]">Protocol stats</a>
          </div>
        </section>

        {/* Holder rewards */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Holder economics
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            <strong className="text-[var(--ink)]">10% of every loan fee</strong> on the
            protocol accrues to a $MAGPIE holder reward pool, distributed pro-rata
            as SOL to every eligible $MAGPIE wallet on a randomized 5–10 day
            cadence. No claim required — SOL lands directly in holder wallets.
          </p>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            $MAGPIE-collateralized loans count: tokens locked as loan collateral
            still earn their holder a share of the distribution. Holders are
            never punished for actively using the protocol.
          </p>
        </section>

        <div className="text-xs text-[var(--ink-faint)] text-center mt-12">
          Numbers refresh every 60s.{" "}
          <a href={`${base}/api/v1/supply`} className="underline">View raw supply JSON ↗</a>
          <span className="mx-2">·</span>
          <a href="/tokenomics" className="underline">Tokenomics →</a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
