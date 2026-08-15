/**
 * Proprietary per-asset page for each approved collectible: image, full
 * description, live sale-comp links, loan terms by tier, and where the
 * category is vaulted & tokenized. Statically generated from the catalog —
 * unknown slugs 404 at the routing layer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  CATALOG,
  CATEGORY_LABELS,
  CATEGORY_PLATFORMS,
  ebaySoldUrl,
  getCatalogItem,
  priceChartingUrl,
} from "@/lib/collectibles-catalog";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return CATALOG.map((i) => ({ slug: i.slug }));
}

const TIER_TERMS = {
  A: { ltv: "50%", term: "30–60 days", rate: "~10–12% APR", grades: "PSA / CGC / BGS 9–10" },
  B: { ltv: "40%", term: "30–90 days", rate: "~12–14% APR", grades: "Grades 8–10 · authenticated autos" },
} as const;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const item = getCatalogItem(slug);
  if (!item) return { title: "Collectible | Magpie" };
  const title = `${item.name} — borrow against it | Magpie`;
  const description = `${item.name} (${item.meta}) is approved Tier ${item.tier} collateral on Magpie: up to ${TIER_TERMS[item.tier].ltv} LTV, ${TIER_TERMS[item.tier].term}, no margin calls. Priced on real sold comps.`;
  return {
    title,
    description,
    alternates: { canonical: `https://www.magpie.capital/collectibles/${item.slug}` },
    openGraph: { title, description },
  };
}

export default async function CollectibleAssetPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const item = getCatalogItem(slug)!;
  const terms = TIER_TERMS[item.tier];
  const platforms = CATEGORY_PLATFORMS[item.category];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        {/* Breadcrumb */}
        <nav className="mb-6 text-[12px] text-[var(--ink-faint)]">
          <Link href="/collectibles" className="underline-offset-4 hover:underline">
            Collectibles
          </Link>
          <span className="mx-2">/</span>
          <span>{CATEGORY_LABELS[item.category]}</span>
          <span className="mx-2">/</span>
          <span>{item.sub}</span>
          <span className="mx-2">/</span>
          <span className="text-[var(--ink-soft)]">{item.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-[minmax(0,380px)_1fr] md:gap-12">
          {/* Image */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={`${item.name} — ${item.meta}`}
                className="mx-auto block h-auto w-full max-w-[340px] rounded-lg"
              />
            </div>
            {item.placeholderImage && (
              <p className="mt-2 text-center text-[11px] text-[var(--ink-faint)]">
                Representative placeholder — the exact card is verified from the
                slab and grader records, not this image.
              </p>
            )}
          </div>

          {/* Facts */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  item.tier === "A"
                    ? "bg-[var(--accent)]/18 text-[var(--accent-deep)]"
                    : "bg-[var(--surface-strong)] text-[var(--ink-soft)]"
                }`}
              >
                Tier {item.tier}
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
              {item.name}
            </h1>
            <div className="mt-1 text-sm text-[var(--ink-soft)]">{item.meta}</div>

            {/* Terms */}
            <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
              {[
                ["Max LTV", terms.ltv],
                ["Term", terms.term],
                ["Rate", terms.rate],
              ].map(([k, v]) => (
                <div key={k} className="border-r border-[var(--hairline)] px-4 py-3 last:border-r-0">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">{k}</div>
                  <div className="mt-1 font-display text-base font-medium tracking-[-0.01em] sm:text-lg">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-[var(--ink-faint)]">
              {terms.grades} · fixed term, no margin calls · design targets while
              collectibles are in design — not a live offer.
            </div>

            {/* Description */}
            <div className="mt-6 space-y-3">
              {item.description.map((p) => (
                <p key={p.slice(0, 32)} className="text-[14px] leading-relaxed text-[var(--ink-soft)] sm:text-[15px]">
                  {p}
                </p>
              ))}
            </div>

            {/* Live sale comps */}
            <section className="mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Sale comps — live, never cached
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                We never quote a stored price. These links open today&apos;s realized
                sold data — the same class of sources our comp engine uses (eBay
                sold listings, Goldin, Fanatics Collect, PriceCharting), keyed to the
                exact set, variant and grade at loan time.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  href={ebaySoldUrl(item.compQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-[var(--hairline-strong)] px-3 py-2 font-medium underline-offset-4 hover:underline"
                >
                  eBay sold listings ↗
                </a>
                <a
                  href={priceChartingUrl(item.compQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-[var(--hairline-strong)] px-3 py-2 font-medium underline-offset-4 hover:underline"
                >
                  PriceCharting ↗
                </a>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-faint)]">
                {item.compNote}
              </p>
            </section>

            {/* Tokenization */}
            <section className="mt-4 rounded-2xl border border-[var(--hairline)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Vaulted &amp; tokenized on
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                To back a loan, the physical card sits insured in a partner vault and
                is represented on-chain. These platforms vault and tokenize{" "}
                {CATEGORY_LABELS[item.category]} today:
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {platforms.map((p) => (
                  <a
                    key={p.name}
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-3 py-2 font-medium underline-offset-4 hover:underline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.logo}
                      alt=""
                      aria-hidden
                      className="h-5 w-5 rounded-[5px] object-contain"
                    />
                    {p.name} ↗
                  </a>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-[var(--ink-faint)]">
                Hold this card but it isn&apos;t tokenized yet?{" "}
                <Link href="/collectibles/tokenize" className="text-[var(--accent-deep)] underline-offset-4 hover:underline">
                  Follow the guided path →
                </Link>
              </p>
            </section>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/collectibles#submit" className="btn-accent text-sm">
                Check your card
              </Link>
              <Link href="/collectibles" className="btn-ghost text-sm">
                Browse the catalog
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
