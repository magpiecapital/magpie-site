"use client";

/**
 * Marketplace-style catalog browser.
 *
 * Organization rules (operator mandate 2026-08-15):
 *  - NEVER commingle categories: results render one SECTION per category
 *    (and per sport inside sports) with a header — a Yu-Gi-Oh card can
 *    never sit beside a Topps Chrome rookie in the same row.
 *  - Drill-down is hierarchical: Category → Brand (sub) → Sport → Player,
 *    each level cascading from the one above it.
 *  - Sort controls: featured, est. value high→low / low→high, A–Z.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FULL_CATALOG,
  CATEGORY_LABELS,
  compsAreFresh,
  fmtUsd,
  TIER_LTV,
  type CatalogCategoryKey,
  type CatalogItem,
} from "@/lib/collectibles-catalog";

const CATEGORY_ORDER: CatalogCategoryKey[] = ["pokemon", "sports", "onepiece", "yugioh"];
const SPORT_ORDER = ["Basketball", "Football", "Baseball", "Hockey", "Soccer", "Multi-sport"];

const PIPELINE = [
  { name: "Magic: The Gathering", note: "Watchlist — mapping the liquid mid-band; trophy pieces stay excluded." },
  { name: "Disney Lorcana", note: "Watchlist — Enchanted rares are building a graded sales record." },
  { name: "Comics — CGC keys", note: "Coming soon — next in the design queue once a vaulting partner supports them." },
];

type SortKey = "featured" | "value-desc" | "value-asc" | "name";

/** Max fresh band value — what the value sorts key on. */
function itemValue(i: CatalogItem): number {
  if (!i.comps || !compsAreFresh(i.comps)) return 0;
  return Math.max(...i.comps.bands.map((b) => b.high));
}

/** Compact "Est. $X – $Y · borrow to ~$Z" line for a tile; null when stale/varies. */
function tileEstimate(i: CatalogItem): { value: string; borrow: string } | null {
  if (!i.comps || !compsAreFresh(i.comps)) return null;
  const low = Math.min(...i.comps.bands.map((b) => b.low));
  const high = Math.max(...i.comps.bands.map((b) => b.high));
  return {
    value: low === high ? fmtUsd(low) : `${fmtUsd(low)} – ${fmtUsd(high)}`,
    borrow: `~${fmtUsd(high * TIER_LTV[i.tier])}`,
  };
}

function Tile({ i }: { i: CatalogItem }) {
  const est = tileEstimate(i);
  return (
    <Link
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
          {i.sport ? `${i.sport} · ` : ""}{i.meta}
        </div>
        {est ? (
          <div className="mt-1.5 truncate text-[11px] tabular-nums">
            <span className="font-semibold text-[var(--ink)]">Est. {est.value}</span>
            <span className="text-[var(--ink-faint)]"> · borrow to </span>
            <span className="font-semibold text-[var(--accent-deep)]">{est.borrow}</span>
          </div>
        ) : (
          <div className="mt-1.5 truncate text-[11px] text-[var(--ink-faint)]">
            Comped per item at loan time
          </div>
        )}
        <div className="mt-auto pt-2 text-[11px] font-medium text-[var(--accent-deep)] opacity-0 transition group-hover:opacity-100">
          View asset →
        </div>
      </div>
    </Link>
  );
}

export function CollectiblesCatalogBrowser() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatalogCategoryKey | "all">("all");
  const [sub, setSub] = useState<string | "all">("all");
  const [sport, setSport] = useState<string | "all">("all");
  const [player, setPlayer] = useState<string | "all">("all");
  const [tier, setTier] = useState<"all" | "A" | "B">("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const pickCat = (k: CatalogCategoryKey | "all") => {
    setCat(k); setSub("all"); setSport("all"); setPlayer("all");
  };
  const pickSub = (s: string | "all") => { setSub(s); setSport("all"); setPlayer("all"); };
  const pickSport = (s: string | "all") => { setSport(s); setPlayer("all"); };

  // Cascading facet options — each level derives from the levels above it.
  const subs = useMemo(
    () => (cat === "all" ? [] : [...new Set(FULL_CATALOG.filter((i) => i.category === cat).map((i) => i.sub))].sort()),
    [cat],
  );
  const sports = useMemo(() => {
    if (cat !== "sports") return [];
    const pool = FULL_CATALOG.filter((i) => i.category === "sports" && (sub === "all" || i.sub === sub));
    const present = new Set(pool.map((i) => i.sport).filter(Boolean) as string[]);
    return SPORT_ORDER.filter((s) => present.has(s));
  }, [cat, sub]);
  const players = useMemo(() => {
    if (cat !== "sports") return [];
    const pool = FULL_CATALOG.filter(
      (i) => i.category === "sports" && (sub === "all" || i.sub === sub) && (sport === "all" || i.sport === sport),
    );
    return [...new Set(pool.map((i) => i.player).filter((p): p is string => !!p && p !== "Multiple"))].sort();
  }, [cat, sub, sport]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = FULL_CATALOG.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (sub !== "all" && i.sub !== sub) return false;
      if (sport !== "all" && i.sport !== sport) return false;
      if (player !== "all" && i.player !== player) return false;
      if (tier !== "all" && i.tier !== tier) return false;
      if (
        needle &&
        !`${i.name} ${i.meta} ${i.sub} ${i.sport ?? ""} ${i.player ?? ""} ${CATEGORY_LABELS[i.category]}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
    if (sort === "value-desc") return [...filtered].sort((a, b) => itemValue(b) - itemValue(a));
    if (sort === "value-asc") {
      return [...filtered].sort((a, b) => {
        const av = itemValue(a) || Number.MAX_SAFE_INTEGER;
        const bv = itemValue(b) || Number.MAX_SAFE_INTEGER;
        return av - bv;
      });
    }
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [q, cat, sub, sport, player, tier, sort]);

  // NEVER commingle: results render as one section per category, and per
  // sport inside the sports category.
  const grouped = useMemo(() => {
    const bySection = new Map<string, CatalogItem[]>();
    for (const i of items) {
      const key =
        i.category === "sports" && i.sport
          ? `${CATEGORY_LABELS[i.category]} — ${i.sport}`
          : CATEGORY_LABELS[i.category];
      const arr = bySection.get(key);
      if (arr) arr.push(i);
      else bySection.set(key, [i]);
    }
    const orderOf = (k: string) => {
      const catIdx = CATEGORY_ORDER.findIndex((c) => k.startsWith(CATEGORY_LABELS[c]));
      const sportIdx = SPORT_ORDER.findIndex((s) => k.endsWith(s));
      return catIdx * 100 + (sportIdx === -1 ? 0 : sportIdx);
    };
    return [...bySection.entries()].sort((a, b) => orderOf(a[0]) - orderOf(b[0]));
  }, [items]);

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
      active
        ? "border-[var(--accent-deep)] bg-[var(--accent)]/15 text-[var(--accent-deep)]"
        : "border-[var(--hairline-strong)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
    }`;
  const smallPill = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
      active
        ? "border-[var(--accent-deep)] bg-[var(--accent)]/15 text-[var(--accent-deep)]"
        : "border-[var(--hairline-strong)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
    }`;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the catalog — Charizard, Jordan, Shanks…"
            aria-label="Search the catalog"
            className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-deep)]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort"
            className="rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-deep)] sm:w-56"
          >
            <option value="featured">Sort: Featured</option>
            <option value="value-desc">Est. value — high to low</option>
            <option value="value-asc">Est. value — low to high</option>
            <option value="name">Name — A to Z</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={pill(cat === "all")} onClick={() => pickCat("all")}>
            All categories
          </button>
          {CATEGORY_ORDER.map((k) => (
            <button key={k} type="button" className={pill(cat === k)} onClick={() => pickCat(k)}>
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
        {subs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Brand / set
            </span>
            <button type="button" className={smallPill(sub === "all")} onClick={() => pickSub("all")}>
              All
            </button>
            {subs.map((s) => (
              <button key={s} type="button" className={smallPill(sub === s)} onClick={() => pickSub(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {sports.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Sport
            </span>
            <button type="button" className={smallPill(sport === "all")} onClick={() => pickSport("all")}>
              All
            </button>
            {sports.map((s) => (
              <button key={s} type="button" className={smallPill(sport === s)} onClick={() => pickSport(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {players.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Player
            </span>
            <button type="button" className={smallPill(player === "all")} onClick={() => setPlayer("all")}>
              All
            </button>
            {players.map((p) => (
              <button key={p} type="button" className={smallPill(player === p)} onClick={() => setPlayer(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      <div className="mt-4 text-[12px] text-[var(--ink-faint)]">
        {items.length} of {FULL_CATALOG.length} approved {items.length === 1 ? "asset" : "assets"}
      </div>

      {/* Sections — one per category (and per sport within sports). */}
      {items.length > 0 ? (
        grouped.map(([section, sectionItems]) => (
          <div key={section} className="mt-5">
            <div className="flex items-baseline gap-2 border-b border-[var(--hairline)] pb-2">
              <h4 className="font-display text-base font-medium tracking-[-0.01em] sm:text-lg">
                {section}
              </h4>
              <span className="text-[11px] text-[var(--ink-faint)]">{sectionItems.length}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {sectionItems.map((i) => (
                <Tile key={i.slug} i={i} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="mt-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--ink-soft)]">
          Nothing matches that filter. If you hold it and it sells, submit it below —
          that&apos;s how the list grows.
        </div>
      )}

      {/* Pipeline categories */}
      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {PIPELINE.map((p) => (
          <div key={p.name} className="rounded-xl border border-dashed border-[var(--hairline-strong)] px-4 py-3">
            <div className="text-[13px] font-semibold text-[var(--ink-soft)]">{p.name}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-faint)]">{p.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
