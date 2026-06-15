/**
 * $MAGPIE tokenomics page.
 *
 * Standalone supply + allocation breakdown that CoinMarketCap /
 * CoinGecko reviewers (and any potential investor) can audit. Lives
 * separately from /magpie so the token landing page stays focused
 * on contract data while this page tells the economic story.
 *
 * Live numbers from the same getMagpieSupplyBreakdown helper the
 * supply endpoints serve — keeps human-reviewed and machine-polled
 * data identical.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "$MAGPIE Tokenomics | Magpie Capital",
  description:
    "$MAGPIE supply, allocation, and value-accrual mechanics. Fair-launched on pump.fun — no team allocation, no presale, no vesting. 70% of every protocol fee accrues to holders (per MGP-001).",
};

async function safeBreakdown() {
  try { return await getMagpieSupplyBreakdown(); } catch { return null; }
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export default async function TokenomicsPage() {
  const supply = await safeBreakdown();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight">$MAGPIE Tokenomics</h1>
          <p className="mt-3 text-base text-[var(--ink-soft)] leading-relaxed">
            Fair-launched on pump.fun. No team allocation. No presale. No
            vesting cliffs. 100% of supply hit the bonding curve at launch
            and is now in holder wallets or the lender operational wallet.
          </p>
        </div>

        {/* Supply snapshot */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Live supply
          </div>
          {supply ? (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Circulating</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{fmt(supply.circulating_supply)}</dd>
                <dd className="text-[10px] text-[var(--ink-faint)] tabular-nums">
                  {supply.circulating_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Total supply</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{fmt(supply.total_supply)}</dd>
                <dd className="text-[10px] text-[var(--ink-faint)] tabular-nums">
                  {supply.total_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Max supply</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{fmt(supply.total_supply)}</dd>
                <dd className="text-[10px] text-[var(--ink-faint)]">no future mints (Token-2022)</dd>
              </div>
            </dl>
          ) : (
            <div className="text-sm text-[var(--ink-soft)]">Supply unavailable right now — RPC fetch failed.</div>
          )}
          <div className="mt-4 pt-4 border-t border-[var(--hairline)] text-xs text-[var(--ink-soft)]">
            Live numbers refresh every 60s. Machine-readable feeds at{" "}
            <Link href="/api/v1/supply/circulating" className="underline text-[var(--accent-deep)]">
              /api/v1/supply/circulating
            </Link>
            {" · "}
            <Link href="/api/v1/supply" className="underline text-[var(--accent-deep)]">
              /api/v1/supply
            </Link>
            .
          </div>
        </section>

        {/* Allocation */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Allocation at launch
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-baseline justify-between gap-3">
              <span><strong className="text-[var(--ink)]">Bonding curve (pump.fun)</strong> — open to the public from t=0</span>
              <span className="tabular-nums font-semibold">100%</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 text-[var(--ink-soft)]">
              <span>Team allocation</span>
              <span className="tabular-nums">0%</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 text-[var(--ink-soft)]">
              <span>Private sale / presale</span>
              <span className="tabular-nums">0%</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 text-[var(--ink-soft)]">
              <span>Treasury reserve</span>
              <span className="tabular-nums">0%</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 text-[var(--ink-soft)]">
              <span>Vesting / cliffs / lockups</span>
              <span className="tabular-nums">none</span>
            </li>
          </ul>
          <p className="mt-4 pt-4 border-t border-[var(--hairline)] text-xs text-[var(--ink-soft)] leading-relaxed">
            Pump.fun&apos;s bonding curve mechanism means every $MAGPIE in
            existence was bought on the open market by a real wallet
            paying SOL. The post-graduation distribution reflects organic
            holder behavior, not any pre-allocation.
          </p>
        </section>

        {/* Value accrual */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Value accrual to holders
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-semibold text-[var(--ink)]">70% of every loan fee → $MAGPIE holders</div>
              <p className="mt-1 text-[var(--ink-soft)] leading-relaxed">
                Every borrow, extend, and repay on the protocol pays a
                small fee. Per MGP-001 (ratified 2026-06-13), 70% of
                those fees accrue to a pool that gets distributed
                pro-rata as SOL to every eligible $MAGPIE wallet.
                Snapshots fire on a randomized 5–10 day cadence
                — intentionally unpredictable to discourage timing
                attempts.
              </p>
            </div>
            <div>
              <div className="font-semibold text-[var(--ink)]">No claim required</div>
              <p className="mt-1 text-[var(--ink-soft)] leading-relaxed">
                Distributions land in holder wallets automatically as
                native SOL. No claim transaction, no gas paid by the
                holder, no expiration.
              </p>
            </div>
            <div>
              <div className="font-semibold text-[var(--ink)]">Collateralized $MAGPIE still earns</div>
              <p className="mt-1 text-[var(--ink-soft)] leading-relaxed">
                $MAGPIE locked as loan collateral counts in the snapshot
                — the borrower retains the holder allocation. Active
                protocol users aren&apos;t punished for using their
                $MAGPIE productively.
              </p>
            </div>
          </div>
        </section>

        {/* Methodology — for reviewers */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Circulating-supply methodology
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-3">
            Circulating supply = on-chain total supply minus balances at:
          </p>
          <ul className="text-sm text-[var(--ink-soft)] space-y-1 list-disc list-inside mb-3">
            <li>The System / burn address (<code className="text-xs">1111…1111</code>)</li>
            <li>The pump.fun bonding-curve address — would hold pre-graduation supply</li>
          </ul>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            The lender wallet is <strong className="text-[var(--ink)]">NOT</strong> excluded — those holdings are
            operational (used to fund loans), not treasury. Tokens
            currently locked as loan collateral <strong className="text-[var(--ink)]">ARE</strong> counted as
            circulating — borrowers retain economic ownership and can
            repay to reclaim.
          </p>
        </section>

        {/* Verify */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Verify
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <a href={`https://solscan.io/token/${MAGPIE_MINT_STR}#holders`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">Solscan holders ↗</a>
            <a href={`https://dexscreener.com/solana/${MAGPIE_MINT_STR}`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">DexScreener ↗</a>
            <a href={`https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-deep)]">Birdeye ↗</a>
            <Link href="/magpie" className="underline text-[var(--accent-deep)]">Contract info →</Link>
            <Link href="/stats" className="underline text-[var(--accent-deep)]">Protocol stats →</Link>
            <Link href="/security" className="underline text-[var(--accent-deep)]">Security →</Link>
          </div>
        </section>

        <div className="text-xs text-[var(--ink-faint)] text-center">
          <Link href="/whitepaper" className="underline">Whitepaper</Link>
          <span className="mx-2">·</span>
          <Link href="/docs" className="underline">Docs</Link>
          <span className="mx-2">·</span>
          <Link href="/changelog" className="underline">Changelog</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
