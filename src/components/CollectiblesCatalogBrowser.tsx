"use client";

/**
 * Marketplace-style catalog browser: search + category/tier filters over an
 * image grid, every card linking to its own asset page. Pure client-side
 * filtering over the static catalog — no network, instant.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CATALOG,
  CATEGORY_LABELS,
  type CatalogCategoryKey,
} from "@/lib/collectibles-catalog";

const CATEGORY_ORDER: CatalogCategoryKey[] = ["pokemon", "sports", "onepiece", "yugioh"];

const PIPELINE = [
  { name: "Magic: The Gathering", note: "Watchlist — mapping the liquid mid-band; trophy pieces stay excluded." },
  { name: "Disney Lorcana", note: "Watchlist — Enchanted rares are building a graded sales record." },
  { name: "Comics — CGC keys", note: "Coming soon — next in the design queue once a vaulting partner supports them." },
];

export function CollectiblesCatalogBrowser() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatalogCategoryKey | "all">("all");
  const [tier, setTier] = useState<"all" | "A" | "B">("all");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (tier !== "all" && i.tier !== tier) return false;
      if (needle && !`${i.name} ${i.meta} ${CATEGORY_LABELS[i.category]}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [q, cat, tier]);

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
      active
        ? "border-[var(--accent-deep)] bg-[var(--accent)]/15 text-[var(--accent-deep)]"
        : "border-[var(--hairline-strong)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
    }`;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 sm:p-5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalog — Charizard, Jordan, Shanks…"
          aria-label="Search the catalog"
          className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-deep)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={pill(cat === "all")} onClick={() => setCat("all")}>
            All categories
          </button>
          {CATEGORY_ORDER.map((k) => (
            <button key={k} type="button" className={pill(cat === k)} onClick={() => setCat(k)}>
              {CATEGORY_LABELS[k]}
            </button>
          ))}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--hairline-strong)] sm:block" />
          {(["all", "A", "B"] as const).map((t) => (
            <button key={t} type="button" className={pill(tier === t)} onClick={() => setTier(t)}>
              {t === "all" ? "All tiers" : `Tier ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="mt-4 text-[12px] text-[var(--ink-faint)]">
        {items.length} of {CATALOG.length} approved{" "}
        {items.length === 1 ? "asset" : "assets"}
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((i) => (
            <Link
              key={i.slug}
              href={`/collectibles/${i.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]/60 hover:shadow-[var(--shadow-md)]"
            >
              <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-[var(--surface)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.thumb}
                  alt={`${i.name} — ${i.meta}`}
                  loading="lazy"
                  className="h-full w-auto max-w-full rounded-md object-contain transition group-hover:scale-[1.03]"
                />
                <span
                  className={`absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    i.tier === "A"
                      ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "bg-[var(--ink)]/80 text-[var(--bg-elevated)]"
                  }`}
                >
                  {i.tier}
                </span>
              </div>
              <div className="flex flex-1 flex-col px-3 py-2.5">
                <div className="truncate text-[13px] font-semibold text-[var(--ink)] sm:text-sm">
                  {i.name}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
                  {i.meta}
                </div>
                <div className="mt-auto pt-2 text-[11px] font-medium text-[var(--accent-deep)] opacity-0 transition group-hover:opacity-100">
                  View asset →
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--ink-soft)]">
          Nothing matches that filter. If you hold it and it sells, submit it below —
          that&apos;s how the list grows.
        </div>
      )}

      {/* Pipeline categories */}
      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {PIPELINE.map((p) => (
          <div
            key={p.name}
            className="rounded-xl border border-dashed border-[var(--hairline-strong)] px-4 py-3"
          >
            <div className="text-[13px] font-semibold text-[var(--ink-soft)]">{p.name}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-faint)]">{p.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
