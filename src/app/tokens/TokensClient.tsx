"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TOKEN_REGISTRY, type TokenCategory } from "@/lib/token-registry";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const REGISTRY = TOKEN_REGISTRY;

/* ─── Types ─── */
type SortKey = "rank" | "price" | "change1h" | "change24h" | "volume" | "mcap";
type SortDir = "asc" | "desc";
type CategoryFilter = "all" | TokenCategory;

interface TokenData {
  symbol: string;
  name: string;
  mint: string;
  category: TokenCategory;
  /** Local image from registry (e.g. "/tokens/xTSLA.svg") */
  registryImage: string | null;
  price: number | null;
  change1h: number | null;
  change6h: number | null;
  change24h: number | null;
  volume24h: number | null;
  mcap: number | null;
  liquidity: number | null;
  imageUrl: string | null;
}

/* ─── Helpers ─── */
function fmtUsd(n: number | null): string {
  if (n == null) return "\u2014";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return "\u2014";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(n: number | null): string {
  if (n == null) return "text-[var(--ink-soft)]";
  return n >= 0 ? "text-emerald-500" : "text-[var(--bad)]";
}

/* ─── DexScreener fetch ─── */
async function fetchMarketData(
  mints: string[],
): Promise<Map<string, Omit<TokenData, "symbol" | "name" | "mint" | "category" | "registryImage">>> {
  const map = new Map<string, Omit<TokenData, "symbol" | "name" | "mint" | "category" | "registryImage">>();
  const BATCH = 30;

  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += BATCH)
    batches.push(mints.slice(i, i + BATCH));

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch(
          `https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`,
        );
        if (!res.ok) return;
        const pairs: Record<string, unknown>[] = await res.json();
        if (!Array.isArray(pairs)) return;

        for (const p of pairs) {
          const addr = (p as { baseToken?: { address?: string } }).baseToken
            ?.address;
          if (!addr) continue;
          const liq =
            ((p as { liquidity?: { usd?: number } }).liquidity?.usd) ?? 0;
          const existing = map.get(addr);
          if (existing && (existing.liquidity ?? 0) >= liq) continue;

          const pr = p as {
            priceUsd?: string;
            priceChange?: { h1?: number; h6?: number; h24?: number };
            volume?: { h24?: number };
            marketCap?: number;
            fdv?: number;
            info?: { imageUrl?: string };
          };

          map.set(addr, {
            price: pr.priceUsd ? parseFloat(pr.priceUsd) : null,
            change1h: pr.priceChange?.h1 ?? null,
            change6h: pr.priceChange?.h6 ?? null,
            change24h: pr.priceChange?.h24 ?? null,
            volume24h: pr.volume?.h24 ?? null,
            mcap: pr.marketCap ?? pr.fdv ?? null,
            liquidity: liq,
            imageUrl: pr.info?.imageUrl ?? null,
          });
        }
      } catch {
        /* ignore batch error */
      }
    }),
  );

  return map;
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
export default function TokensClient() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("mcap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* Fetch token list from API (fallback to hardcoded registry), then market data */
  const loadTokens = useCallback(async (bustCache = false) => {
    // Fetch from our own API route (queries DB, falls back to registry)
    let registry: { symbol: string; name: string; mint: string; category: TokenCategory; image?: string | null }[] = REGISTRY;
    try {
      const url = bustCache ? "/api/v1/tokens?fresh" : "/api/v1/tokens";
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.tokens?.length > 0) {
          registry = data.tokens.map((t: { symbol: string; name: string; mint: string; category?: string; image?: string | null }) => ({
            symbol: t.symbol,
            name: t.name,
            mint: t.mint,
            category: (t.category || "memecoin") as TokenCategory,
            image: t.image ?? null,
          }));
        }
      }
    } catch {
      // API unavailable — use hardcoded registry
    }

    const mints = registry.map((t) => t.mint);
    const map = await fetchMarketData(mints);
    const merged: TokenData[] = registry.map((t) => {
      const d = map.get(t.mint);
      return {
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        category: t.category,
        registryImage: t.image ?? null,
        price: d?.price ?? null,
        change1h: d?.change1h ?? null,
        change6h: d?.change6h ?? null,
        change24h: d?.change24h ?? null,
        volume24h: d?.volume24h ?? null,
        mcap: d?.mcap ?? null,
        liquidity: d?.liquidity ?? null,
        imageUrl: d?.imageUrl ?? null,
      };
    });
    setTokens(merged);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  /* Sort + filter */
  const sorted = useMemo(() => {
    let list = tokens;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.mint.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "price":
          av = a.price ?? -1;
          bv = b.price ?? -1;
          break;
        case "change1h":
          av = a.change1h ?? -Infinity;
          bv = b.change1h ?? -Infinity;
          break;
        case "change24h":
          av = a.change24h ?? -Infinity;
          bv = b.change24h ?? -Infinity;
          break;
        case "volume":
          av = a.volume24h ?? -1;
          bv = b.volume24h ?? -1;
          break;
        default:
          av = a.mcap ?? -1;
          bv = b.mcap ?? -1;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [tokens, search, categoryFilter, sortKey, sortDir]);

  /* Stats */
  const stats = useMemo(() => {
    const totalMcap = tokens.reduce((s, t) => s + (t.mcap ?? 0), 0);
    const totalVol = tokens.reduce((s, t) => s + (t.volume24h ?? 0), 0);
    const stockCount = tokens.filter((t) => t.category === "stock").length;
    const memeCount = tokens.filter((t) => t.category === "memecoin").length;
    return { count: tokens.length, totalMcap, totalVol, stockCount, memeCount };
  }, [tokens]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const arrow = (key: SortKey) =>
    sortKey !== key ? "opacity-30" : "";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      {/* ── Nav ── */}
      <Header />

      {/* ── Hero ── */}
      <section className="relative border-b border-[var(--hairline)] overflow-hidden">
        <div className="hero-glow" />
        <div className="relative mx-auto max-w-7xl px-5 pt-12 pb-10 sm:px-6 md:pt-20 md:pb-16">
          <div className="mb-4 flex flex-wrap items-center gap-2 fade-up">
            <span className="chip">
              <span className="live-dot" />
              {tokens.length} tokens live
            </span>
            {!loading && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(92,90,82,0.06)", color: "var(--ink-soft)", borderColor: "var(--hairline-strong)" }}>
                  {stats.stockCount} Tokenized Stocks
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--accent-dim)", color: "var(--accent-deep)", borderColor: "rgba(247,201,72,0.3)" }}>
                  {stats.memeCount} Memecoins
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-3xl font-medium tracking-[-0.04em] sm:text-5xl md:text-7xl fade-up fade-up-1">
            Approved Tokens
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed fade-up fade-up-2 sm:mt-4 sm:text-lg">
            Borrow SOL against memecoins <em className="font-display not-italic text-[var(--ink)]">and</em> tokenized stocks.
            Deposit any approved token as collateral, pick a tier, and get
            SOL instantly.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 fade-up fade-up-3">
            <a
              href="#submit-token"
              className="btn-accent inline-flex items-center gap-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit a Token
            </a>
            <span className="text-xs text-[var(--ink-faint)]">Real-time data via DexScreener</span>
          </div>

          {/* Stats cards */}
          {!loading && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 fade-up fade-up-4">
              <div className="col-span-2 sm:col-span-1">
                <StatCard
                  label="Total Tokens"
                  value={stats.count.toString()}
                />
              </div>
              <StatCard
                label="Tokenized Stocks"
                value={stats.stockCount.toString()}
                accent="ink"
                onClick={() => { setCategoryFilter("stock"); document.getElementById("token-table")?.scrollIntoView({ behavior: "smooth" }); }}
              />
              <StatCard
                label="Memecoins"
                value={stats.memeCount.toString()}
                accent="amber"
                onClick={() => { setCategoryFilter("memecoin"); document.getElementById("token-table")?.scrollIntoView({ behavior: "smooth" }); }}
              />
              <StatCard
                label="Combined Mcap"
                value={fmtUsd(stats.totalMcap)}
              />
              <StatCard
                label="24h Volume"
                value={fmtUsd(stats.totalVol)}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Table Section ── */}
      <section id="token-table" className="mx-auto max-w-7xl px-5 py-8 scroll-mt-20 sm:px-6 sm:py-10">
        {/* Category filter tabs */}
        <div className="mb-5 flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-1 w-fit max-w-full shadow-sm">
          {([
            { key: "all" as CategoryFilter, label: "All", smLabel: "All Tokens", count: stats.count },
            { key: "stock" as CategoryFilter, label: "Stocks", smLabel: "Stocks", count: stats.stockCount },
            { key: "memecoin" as CategoryFilter, label: "Memes", smLabel: "Memecoins", count: stats.memeCount },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCategoryFilter(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:px-4 ${
                categoryFilter === tab.key
                  ? "bg-[var(--ink)] text-[var(--bg-elevated)] shadow-sm"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.smLabel}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                categoryFilter === tab.key
                  ? "bg-white/15 text-[var(--bg-elevated)]"
                  : "bg-[var(--surface)] text-[var(--ink-faint)]"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, ticker, or address\u2026"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
          {lastUpdated && (
            <p className="shrink-0 text-xs text-[var(--ink-soft)]">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-[var(--bg-elevated)]"
              />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-xs uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                  <th className="px-4 py-3.5 font-medium w-12">#</th>
                  <th className="px-4 py-3.5 font-medium">Token</th>
                  <th
                    className="px-4 py-3.5 font-medium cursor-pointer select-none text-right"
                    onClick={() => toggleSort("price")}
                  >
                    Price{" "}
                    <span className={arrow("price")}>
                      {sortKey === "price"
                        ? sortDir === "desc"
                          ? "\u25BC"
                          : "\u25B2"
                        : "\u25BC"}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3.5 font-medium cursor-pointer select-none text-right hidden lg:table-cell"
                    onClick={() => toggleSort("change1h")}
                  >
                    1h{" "}
                    <span className={arrow("change1h")}>
                      {sortKey === "change1h"
                        ? sortDir === "desc"
                          ? "\u25BC"
                          : "\u25B2"
                        : "\u25BC"}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3.5 font-medium cursor-pointer select-none text-right"
                    onClick={() => toggleSort("change24h")}
                  >
                    24h{" "}
                    <span className={arrow("change24h")}>
                      {sortKey === "change24h"
                        ? sortDir === "desc"
                          ? "\u25BC"
                          : "\u25B2"
                        : "\u25BC"}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3.5 font-medium cursor-pointer select-none text-right hidden md:table-cell"
                    onClick={() => toggleSort("volume")}
                  >
                    24h Vol{" "}
                    <span className={arrow("volume")}>
                      {sortKey === "volume"
                        ? sortDir === "desc"
                          ? "\u25BC"
                          : "\u25B2"
                        : "\u25BC"}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3.5 font-medium cursor-pointer select-none text-right"
                    onClick={() => toggleSort("mcap")}
                  >
                    Market Cap{" "}
                    <span className={arrow("mcap")}>
                      {sortKey === "mcap"
                        ? sortDir === "desc"
                          ? "\u25BC"
                          : "\u25B2"
                        : "\u25BC"}
                    </span>
                  </th>
                  <th className="px-4 py-3.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr
                    key={t.mint}
                    className={`border-b border-[var(--hairline)] last:border-0 transition hover:bg-[var(--accent)]/[0.03] ${
                      t.category === "stock" ? "bg-[var(--surface)]/30" : ""
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3 text-[var(--ink-soft)] tabular">
                      {i + 1}
                    </td>

                    {/* Token */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TokenIcon
                          symbol={t.symbol}
                          mint={t.mint}
                          registryImage={t.registryImage}
                          imageUrl={t.imageUrl}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {t.name}
                            </span>
                            <CategoryBadge category={t.category} />
                          </div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            {t.symbol}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right tabular font-medium">
                      {fmtUsd(t.price)}
                    </td>

                    {/* 1h */}
                    <td
                      className={`px-4 py-3 text-right tabular font-medium hidden lg:table-cell ${pctClass(t.change1h)}`}
                    >
                      {fmtPct(t.change1h)}
                    </td>

                    {/* 24h */}
                    <td
                      className={`px-4 py-3 text-right tabular font-medium ${pctClass(t.change24h)}`}
                    >
                      {fmtPct(t.change24h)}
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-right tabular hidden md:table-cell">
                      {fmtUsd(t.volume24h)}
                    </td>

                    {/* Market Cap */}
                    <td className="px-4 py-3 text-right tabular font-medium">
                      {fmtUsd(t.mcap)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://dexscreener.com/solana/${t.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--hairline-strong)] px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          title="View on DexScreener"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7h8m0 0v8m0-8L10 18"
                            />
                          </svg>
                          Chart
                        </a>
                        <a
                          href={TELEGRAM_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-black transition hover:brightness-110"
                        >
                          Borrow
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sorted.length === 0 && !loading && (
              <div className="py-20 text-center">
                <div className="text-3xl mb-3 opacity-30">&#x1F50D;</div>
                <p className="text-[var(--ink-soft)] font-medium">No tokens match &ldquo;{search}&rdquo;</p>
                <p className="mt-1 text-sm text-[var(--ink-faint)]">Try a different search term or clear your filters.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Request Section ── */}
      <section id="submit-token" className="border-t border-[var(--hairline)] scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">
              Don&rsquo;t see your token?
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
              Submit a token for instant automated vetting. Paste a mint address
              or symbol and get a result in seconds.
            </p>
            <SubmitForm onApproved={() => loadTokens(true)} />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div
            className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full"
            style={{
              background:
                "radial-gradient(circle,var(--accent) 0%,transparent 70%)",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-12 text-center sm:px-6 md:py-20">
          <h2 className="font-display text-2xl font-medium tracking-[-0.03em] sm:text-3xl md:text-4xl">
            Ready to borrow against your bags?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/60">
            Open the Telegram bot, deposit collateral, and get SOL in seconds.
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent mt-8 inline-flex text-base"
          >
            Launch on Telegram <span aria-hidden>&#8594;</span>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function CategoryBadge({ category }: { category: TokenCategory }) {
  if (category === "stock") {
    return (
      <span className="inline-flex items-center rounded-md border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "var(--accent-dim)", color: "var(--accent-deep)", borderColor: "rgba(247,201,72,0.3)" }}>
      Meme
    </span>
  );
}

function StatCard({ label, value, accent, onClick }: { label: string; value: string; accent?: "ink" | "amber"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl border px-5 py-4 shadow-sm text-left transition ${
        accent === "ink"
          ? "border-[var(--ink)]/10 bg-[var(--ink)] text-[var(--bg-elevated)]"
          : accent === "amber"
            ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]"
            : "border-[var(--hairline)] bg-[var(--bg-elevated)]"
      } ${onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-100" : ""}`}
    >
      <div className={`text-[10px] uppercase tracking-[0.18em] ${
        accent === "ink" ? "text-white/50" : accent === "amber" ? "text-[var(--accent-deep)]" : "text-[var(--ink-soft)]"
      }`}>
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-medium tracking-[-0.03em] ${
        accent === "ink" ? "text-white" : accent === "amber" ? "text-[var(--accent-deep)]" : ""
      }`}>
        {value}
      </div>
    </Tag>
  );
}

function TokenIcon({
  symbol,
  mint,
  registryImage,
  imageUrl,
}: {
  symbol: string;
  mint: string;
  /** Local image from registry — highest priority */
  registryImage: string | null;
  imageUrl: string | null;
}) {
  // Priority: registry image > DexScreener API image > DexScreener mint URL > fallback initial
  const initialSrc = registryImage
    || imageUrl
    || `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;

  const [src, setSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-bold text-[var(--accent)]">
        {symbol[0]}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={symbol}
      className="h-8 w-8 shrink-0 rounded-full bg-[var(--bg)]"
      onError={() => {
        // If registry image failed, try DexScreener; if that failed, show initial
        if (registryImage && src === registryImage) {
          setSrc(imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
        } else if (src !== `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png` && imageUrl) {
          setSrc(`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

interface SubmitResult {
  verdict: string;
  symbol?: string;
  name?: string;
  mint?: string;
  liquidity?: number;
  volume24h?: number;
  marketCap?: number;
  ageHours?: number;
  hasMintAuthority?: boolean;
  hasFreezeAuthority?: boolean;
  fails?: string[];
  message?: string;
  error?: string;
}

function SubmitForm({ onApproved }: { onApproved: () => Promise<void> }) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus("sending");
    setResult(null);
    try {
      const res = await fetch("/api/submit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: input.trim() }),
      });
      const data = await res.json();
      setResult(data);
      // Refresh token list if approved so it appears immediately
      if (data.verdict === "approved") {
        onApproved();
      }
    } catch {
      setResult({ verdict: "error", error: "Something went wrong. Please try again." });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="flex gap-3">
        <input
          type="text"
          placeholder="Mint address or symbol (e.g. BONK)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-mono outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <button
          type="submit"
          disabled={status === "sending" || !input.trim()}
          className="btn-accent shrink-0 px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "Analyzing\u2026" : "Submit"}
        </button>
      </form>

      {result && <SubmitResultCard result={result} onReset={() => { setResult(null); setInput(""); }} />}
    </div>
  );
}

function SubmitResultCard({ result, onReset }: { result: SubmitResult; onReset: () => void }) {
  const v = result.verdict;

  // Approved
  if (v === "approved") {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-black text-lg font-bold">&#10003;</span>
          <div>
            <div className="font-semibold text-lg">{result.symbol} &mdash; Approved!</div>
            <div className="text-sm text-[var(--ink-soft)]">{result.name}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 mb-4">
          <Stat label="Liquidity" value={`$${(result.liquidity ?? 0).toLocaleString()}`} />
          <Stat label="Volume 24h" value={`$${(result.volume24h ?? 0).toLocaleString()}`} />
          <Stat label="Market Cap" value={`$${(result.marketCap ?? 0).toLocaleString()}`} />
          <Stat label="Age" value={`${result.ageHours ?? 0}h`} />
        </div>
        <p className="text-sm text-[var(--accent-deep)] font-medium">
          This token is now live as collateral. You can borrow against it immediately on Telegram.
        </p>
        <button onClick={onReset} className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2">
          Submit another
        </button>
      </div>
    );
  }

  // Under review
  if (v === "review") {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)]/10 text-[var(--ink)] text-lg">&#9202;</span>
          <div>
            <div className="font-semibold text-lg">{result.symbol} &mdash; Under Review</div>
            <div className="text-sm text-[var(--ink-soft)]">{result.name}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 mb-4">
          <Stat label="Liquidity" value={`$${(result.liquidity ?? 0).toLocaleString()}`} />
          <Stat label="Volume 24h" value={`$${(result.volume24h ?? 0).toLocaleString()}`} />
          <Stat label="Market Cap" value={`$${(result.marketCap ?? 0).toLocaleString()}`} />
          <Stat label="Age" value={`${result.ageHours ?? 0}h`} />
        </div>
        <p className="text-sm text-[var(--ink-soft)]">
          This token passed safety checks and is in the review queue. Tokens are typically approved within 1 hour.
        </p>
        <button onClick={onReset} className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2">
          Submit another
        </button>
      </div>
    );
  }

  // Rejected
  if (v === "rejected") {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--bad)]/20 bg-[var(--bad)]/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bad)]/10 text-[var(--bad)] text-lg font-bold">&#10007;</span>
          <div>
            <div className="font-semibold text-lg">{result.symbol} &mdash; Not Approved</div>
            <div className="text-sm text-[var(--ink-soft)]">{result.name}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 mb-4">
          <Stat label="Liquidity" value={`$${(result.liquidity ?? 0).toLocaleString()}`} />
          <Stat label="Volume 24h" value={`$${(result.volume24h ?? 0).toLocaleString()}`} />
          <Stat label="Market Cap" value={`$${(result.marketCap ?? 0).toLocaleString()}`} />
          <Stat label="Age" value={`${result.ageHours ?? 0}h`} />
        </div>
        {result.fails && result.fails.length > 0 && (
          <ul className="mb-3 space-y-1">
            {result.fails.map((f, i) => (
              <li key={i} className="text-sm text-[var(--bad)] flex items-start gap-2">
                <span className="mt-0.5 shrink-0">&#8226;</span> {f}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-[var(--ink-soft)]">
          This token does not currently meet our safety criteria for collateral.
        </p>
        <button onClick={onReset} className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2">
          Submit another
        </button>
      </div>
    );
  }

  // Already supported / in review / not found / other messages
  if (result.message) {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-6">
        <p className="text-sm">{result.message}</p>
        <button onClick={onReset} className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2">
          Submit another
        </button>
      </div>
    );
  }

  // Error
  return (
    <div className="mt-6 rounded-2xl border border-[var(--bad)]/20 bg-[var(--bad)]/5 p-6">
      <p className="text-sm text-[var(--bad)]">{result.error || "Something went wrong."}</p>
      <button onClick={onReset} className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2">
        Try again
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">{label}</div>
      <div className="mt-0.5 font-semibold tabular">{value}</div>
    </div>
  );
}

