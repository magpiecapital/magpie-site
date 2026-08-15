/**
 * Programmatic SEO landing page: /borrow/[symbol] — one page per
 * approved collateral token, targeting the high-intent query
 * "borrow against <token>". Everything on the page is computed from
 * the live catalog and tier config at render time (never hardcoded):
 * unlisted or disabled symbols 404, so a page can never advertise a
 * token the protocol doesn't currently accept.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getLoanTiers, type LoanTier, type LoanTierCategory } from "@/lib/db";

export const revalidate = 3600;

// Valid symbols are enumerated at build time and everything else 404s at
// the routing layer. notFound() thrown during render can't set the
// status on this Next version — the shell has already streamed with a
// 200, which is a soft-404 for crawlers. New listings get their page on
// the next deploy (site deploys are frequent; the catalog-driven
// sitemap and page content still revalidate hourly).
export const dynamicParams = false;

const SITE_URL = "https://www.magpie.capital";

interface CatalogToken {
  mint: string;
  symbol: string;
  name: string;
  category: string | null;
  image: string | null;
}

async function fetchCatalog(): Promise<CatalogToken[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/v1/tokens?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { tokens?: CatalogToken[] };
    return d.tokens ?? [];
  } catch {
    return [];
  }
}

async function resolveToken(symbol: string): Promise<CatalogToken | null> {
  const tokens = await fetchCatalog();
  const matches = tokens.filter(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
  // Symbols are protocol-unique by policy; if a collision ever slips
  // through, prefer nothing rather than guessing which token the
  // visitor means.
  return matches.length === 1 ? matches[0] : null;
}

export async function generateStaticParams(): Promise<Array<{ symbol: string }>> {
  const tokens = await fetchCatalog();
  const counts = new Map<string, number>();
  for (const t of tokens) {
    const s = t.symbol.toLowerCase();
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return tokens
    .map((t) => t.symbol.toLowerCase())
    .filter((s) => /^[a-z0-9$._-]{1,20}$/.test(s) && counts.get(s) === 1)
    .map((symbol) => ({ symbol }));
}

interface Scorecard {
  tier?: { label: string; capSol: number | null; remainingSol: number | null; activeLoans: number };
  risk_metrics?: { liquidity_usd: number; market_cap_usd: number; holder_count: number };
  lifetime?: { borrowed_sol: number; loan_count: number; repaid: number } | null;
}

async function fetchScorecard(mint: string): Promise<Scorecard | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/v1/tokens/${mint}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Scorecard;
  } catch {
    return null;
  }
}

function tierCategory(category: string | null): LoanTierCategory {
  if (category === "stock" || category === "etf" || category === "metal") return category;
  return "memecoin";
}

function categoryNoun(category: string | null): string {
  switch (category) {
    case "stock": return "tokenized stock";
    case "etf": return "tokenized ETF";
    case "metal": return "tokenized precious metal";
    default: return "memecoin";
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ symbol: string }> },
): Promise<Metadata> {
  const { symbol } = await params;
  const token = await resolveToken(symbol);
  // notFound() here (not just in the page) so unsupported symbols get a
  // real 404 status — thrown from the page alone, the response can
  // already be streaming with a 200.
  if (!token) notFound();
  const tiers = await getLoanTiers(tierCategory(token.category));
  const maxLtv = Math.max(...tiers.map((t) => t.ltv_pct));
  const title = `Borrow SOL against $${token.symbol} — instant ${categoryNoun(token.category)} loan | Magpie`;
  const description = `Get an instant SOL loan against ${token.name} ($${token.symbol}) on Solana. Up to ${maxLtv}% LTV, fixed terms, no margin calls — and V4 exit orders let your collateral take profit while the loan stays active.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/borrow/${token.symbol.toLowerCase()}` },
    openGraph: { title, description, url: `${SITE_URL}/borrow/${token.symbol.toLowerCase()}` },
  };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function faqJsonLd(token: CatalogToken, tiers: LoanTier[]): string {
  const maxLtv = Math.max(...tiers.map((t) => t.ltv_pct));
  const terms = tiers
    .map((t) => `${t.label}: ${t.ltv_pct}% LTV for ${t.duration_days} days at a ${(t.fee_bps / 100).toFixed(1)}% flat fee`)
    .join("; ");
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Can I borrow against $${token.symbol} (${token.name})?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Magpie Capital accepts ${token.name} ($${token.symbol}) as loan collateral on Solana. Loans are SOL-denominated with fixed terms and no margin calls. Current terms — ${terms}.`,
        },
      },
      {
        "@type": "Question",
        name: `How much SOL can I get for my $${token.symbol}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Up to ${maxLtv}% of your $${token.symbol} position's attested value, depending on the loan tier you choose. Every borrow is valued against a cross-sourced on-chain price attestation at execution time.`,
        },
      },
      {
        "@type": "Question",
        name: `What happens if $${token.symbol} pumps while I have a loan?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `On Magpie's V4 pools you can arm take-profit ladders and stop-losses on the collateral itself. If $${token.symbol} hits one of your targets, that slice sells inside the on-chain vault automatically and the loan stays active — you never miss the move while borrowed against.`,
        },
      },
      {
        "@type": "Question",
        name: `Can my $${token.symbol} loan get margin called?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Magpie loans are fixed-term: a price dip cannot trigger liquidation before your term ends. Repay any time and your collateral returns in the same transaction.",
        },
      },
    ],
  });
}

export default async function BorrowTokenPage(
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const token = await resolveToken(symbol);
  if (!token) notFound();
  const [tiers, card] = await Promise.all([
    getLoanTiers(tierCategory(token.category)),
    fetchScorecard(token.mint),
  ]);
  const maxLtv = Math.max(...tiers.map((t) => t.ltv_pct));
  const rm = card?.risk_metrics;
  const lifetime = card?.lifetime;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd(token, tiers) }}
      />
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            {token.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={token.image} alt={token.symbol} className="h-10 w-10 rounded-full" />
            )}
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Approved collateral · {categoryNoun(token.category)}
            </div>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Borrow SOL against ${token.symbol}
          </h1>
          <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
            {token.name} is approved collateral on Magpie Capital. Get up to{" "}
            <strong className="text-[var(--ink)]">{maxLtv}% of its value in SOL</strong> on a
            fixed term — no margin calls, no credit checks, funds in under a minute. Keep the
            upside: arm exit orders on your collateral and it can still take profit while the
            loan is active.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-[var(--accent-deep)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Borrow on the dashboard
            </Link>
            <a
              href="https://t.me/magpie_capital_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-[var(--hairline-strong)] px-5 py-2.5 text-sm font-semibold"
            >
              Borrow via Telegram
            </a>
          </div>
        </div>

        {/* Terms — computed from live tier config */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Current ${token.symbol} loan terms
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
                  <th className="pb-2 pr-4 font-medium">Tier</th>
                  <th className="pb-2 pr-4 font-medium">LTV</th>
                  <th className="pb-2 pr-4 font-medium">Term</th>
                  <th className="pb-2 font-medium">Flat fee</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.option} className="border-t border-[var(--hairline)]">
                    <td className="py-2.5 pr-4 font-semibold">{t.label}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{t.ltv_pct}%</td>
                    <td className="py-2.5 pr-4 tabular-nums">{t.duration_days} days</td>
                    <td className="py-2.5 tabular-nums">{(t.fee_bps / 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-[var(--ink-soft)]">
            Fixed terms — a ${token.symbol} price dip cannot liquidate you before term. Repay
            any time; collateral returns in the same transaction.
          </div>
        </section>

        {/* The V4 differentiator */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-2">
            Don&apos;t miss the candle
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
            A normal loan locks your ${token.symbol} away — the market spikes and you just
            watch. Magpie&apos;s V4 pools let you arm{" "}
            <strong className="text-[var(--ink)]">take-profit ladders and stop-losses on the
            collateral itself</strong>. Targets hit → slices sell inside the on-chain vault →
            the loan stays active. It&apos;s the only Solana lending protocol where your
            collateral can still sell itself.
          </p>
        </section>

        {/* Live token standing — computed */}
        {rm && (
          <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
              ${token.symbol} on Magpie right now
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Liquidity</dt>
                <dd className="font-medium tabular-nums">{formatUsd(rm.liquidity_usd)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Market cap</dt>
                <dd className="font-medium tabular-nums">{formatUsd(rm.market_cap_usd)}</dd>
              </div>
              {lifetime && lifetime.loan_count > 0 && (
                <>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Loans taken</dt>
                    <dd className="font-medium tabular-nums">{lifetime.loan_count.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">SOL borrowed</dt>
                    <dd className="font-medium tabular-nums">{lifetime.borrowed_sol.toFixed(1)}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="mt-3 text-xs">
              <Link href={`/tokens/${token.mint}`} className="underline text-[var(--accent-deep)]">
                Full ${token.symbol} risk scorecard — see exactly how the protocol classifies it →
              </Link>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            How it works
          </div>
          <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
            <li className="flex gap-3">
              <span className="font-display font-bold text-[var(--accent-deep)]">1</span>
              <span>Connect a wallet on the <Link href="/dashboard" className="underline">dashboard</Link> (or open the <a href="https://t.me/magpie_capital_bot" target="_blank" rel="noopener noreferrer" className="underline">Telegram bot</a>) and pick ${token.symbol} as collateral.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-[var(--accent-deep)]">2</span>
              <span>Choose a tier — your ${token.symbol} is valued against a cross-sourced on-chain price attestation and SOL lands in your wallet.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-[var(--accent-deep)]">3</span>
              <span>Optionally arm take-profit / stop-loss orders on the collateral. Repay any time — collateral back in the same transaction, and on-time repayment builds your on-chain credit score.</span>
            </li>
          </ol>
        </section>

        <div className="text-xs text-[var(--ink-faint)] text-center">
          <Link href="/tokens" className="underline">All approved tokens</Link>
          <span className="mx-2">·</span>
          <Link href="/calculate" className="underline">Loan calculator</Link>
          <span className="mx-2">·</span>
          <Link href="/stats" className="underline">Live protocol stats</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
