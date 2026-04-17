"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const X_URL = "https://x.com/MagpieLending";

/* ─── Token Registry ─── */
const REGISTRY: { symbol: string; name: string; mint: string }[] = [
  { symbol: "ACT", name: "Act", mint: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump" },
  { symbol: "ALCH", name: "Alchemist AI", mint: "HNg5PYJmtqcmzXrv6S9zP1CDKk5BgDuyFBxbvNApump" },
  { symbol: "ARC", name: "Arc", mint: "61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump" },
  { symbol: "ASTEROID", name: "Asteroid", mint: "F1ppSHedBsGGwEKH78JVgoqr4xkQHswtsGGLpgM7bCP2" },
  { symbol: "AURA", name: "Aura", mint: "DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2" },
  { symbol: "BAN", name: "Ban", mint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump" },
  { symbol: "BERT", name: "Bert", mint: "HgBRWfYxEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "BULL", name: "Bull", mint: "3TYgKwkE2Y3rxdw9osLRSpxpXmSC1C1oo19W9KHspump" },
  { symbol: "BUTTCOIN", name: "Buttcoin", mint: "Cm6fNnMk7NfzStP9CZpsQA2v3jjzbcYGAxdJySmHpump" },
  { symbol: "CHILLGUY", name: "Chill Guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump" },
  { symbol: "CHILLHOUSE", name: "Chillhouse", mint: "GkyPYa7NnCFbduLknCfBfP7p8564X1VZhwZYJ6CZpump" },
  { symbol: "CODEC", name: "Codec", mint: "69LjZUUzxj3Cb3Fxeo1X4QpYEQTboApkhXTysPpbpump" },
  { symbol: "COPPERINU", name: "Copper Inu", mint: "61Wj56QgGyyB966T7YsMzEAKRLcMvJpDbPzjkrCZc4Bi" },
  { symbol: "DREAMS", name: "Dreams", mint: "GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump" },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" },
  { symbol: "FORCA", name: "Forca", mint: "J1wsY5rqFesHmQojnzBNs4Bhk5vEtCb9GU5xv7A7pump" },
  { symbol: "FWOG", name: "Fwog", mint: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump" },
  { symbol: "GOAT", name: "Goat", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump" },
  { symbol: "GRIFFAIN", name: "Griffain", mint: "KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP" },
  { symbol: "HODL", name: "Hodl", mint: "Hh3oTaqDCKKfdBgsQEvxp9sUwyNf8x9qmKqEMLBWpump" },
  { symbol: "JELLYJELLY", name: "Jelly Jelly", mint: "FeR8VBqNRSUD5NtXAj2n3j1dAHkZHfyDktKuLXD4pump" },
  { symbol: "LOBSTAR", name: "Lobstar", mint: "AVF9F4C4j8b1Kh4BmNHqybDaHgnZpJ7W7yLvL7hUpump" },
  { symbol: "LOL", name: "LOL", mint: "34q2KmCvapecJgR6ZrtbCTrzZVtkt3a5mHEA3TuEsWYb" },
  { symbol: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY" },
  { symbol: "NEET", name: "Neet", mint: "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump" },
  { symbol: "PENGUIN", name: "Penguin", mint: "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump" },
  { symbol: "PNUT", name: "Pnut", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump" },
  { symbol: "PUMPCADE", name: "Pumpcade", mint: "Eg2ymQ2aQqjMcibnmTt8erC6Tvk9PVpJZCxvVPJz2agu" },
  { symbol: "PUNCH", name: "Punch", mint: "NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump" },
  { symbol: "PYTH", name: "Pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" },
  { symbol: "PYTHIA", name: "Pythia", mint: "CreiuhfwdWCN5mJbMJtA9bBpYQrQF2tCBuZwSPWfpump" },
  { symbol: "RAIN", name: "Rain", mint: "3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump" },
  { symbol: "REITRE", name: "Reitre", mint: "zGh48JtNHVBb5evgoZLXwgPD2Qu4MhkWdJLGDAupump" },
  { symbol: "RENTA", name: "Renta", mint: "5MxQUFdPisppdVfjitL6hs492GyikCFnsBWYtuAqpump" },
  { symbol: "SMR", name: "Smr", mint: "EiRfZeWLW1NymAfjKUePz3jwtq5rZ69XM3zLDS1Npump" },
  { symbol: "SPIKE", name: "Spike", mint: "BFiGUxnidogqcZAPVPDZRCfhx3nXnFLYqpQUaUGpump" },
  { symbol: "SWARMS", name: "Swarms", mint: "74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump" },
  { symbol: "TESTICLE", name: "Testicle", mint: "4TyZGqRLG3VcHTGMcLBoPUmqYitMVojXinAmkL8xpump" },
  { symbol: "TRIPLET", name: "TripleT", mint: "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump" },
  { symbol: "TROLL", name: "Troll", mint: "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2" },
  { symbol: "UFD", name: "UFD", mint: "eL5fUxj2J4CiQsmW85k5FG9DvuQjjUoBHoQBi2Kpump" },
  { symbol: "UNC", name: "Unc", mint: "ACtfUWtgvaXrQGNMiohTusi5jcx5RJf5zwu9aAxkpump" },
  { symbol: "VINE", name: "Vine", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump" },
  { symbol: "WHITEWHALE", name: "White Whale", mint: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "WOJAK", name: "Wojak", mint: "8J69rbLTzWWgUJziFY8jeu5tDwEPBwUz4pKBMr5rpump" },
  { symbol: "WOULD", name: "Would", mint: "J1Wpmugrooj1yMyQKrdZ2vwRXG5rhfx3vTnYE39gpump" },
  { symbol: "ZAUTH", name: "Zauth", mint: "DNhQZ1CE9qZ2FNrVhsCXwQJ2vZG8ufZkcYakTS5Jpump" },
  { symbol: "ZEREBRO", name: "Zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn" },
];

/* ─── Types ─── */
type SortKey = "rank" | "price" | "change1h" | "change24h" | "volume" | "mcap";
type SortDir = "asc" | "desc";

interface TokenData {
  symbol: string;
  name: string;
  mint: string;
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
  return n >= 0 ? "text-[var(--accent-deep)]" : "text-[var(--bad)]";
}

/* ─── DexScreener fetch ─── */
async function fetchMarketData(
  mints: string[],
): Promise<Map<string, Omit<TokenData, "symbol" | "name" | "mint">>> {
  const map = new Map<string, Omit<TokenData, "symbol" | "name" | "mint">>();
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
  const [sortKey, setSortKey] = useState<SortKey>("mcap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* Fetch market data on mount */
  useEffect(() => {
    const mints = REGISTRY.map((t) => t.mint);
    fetchMarketData(mints).then((map) => {
      const merged: TokenData[] = REGISTRY.map((t) => {
        const d = map.get(t.mint);
        return {
          symbol: t.symbol,
          name: t.name,
          mint: t.mint,
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
    });
  }, []);

  /* Sort + filter */
  const sorted = useMemo(() => {
    let list = tokens;
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
  }, [tokens, search, sortKey, sortDir]);

  /* Stats */
  const stats = useMemo(() => {
    const totalMcap = tokens.reduce((s, t) => s + (t.mcap ?? 0), 0);
    const totalVol = tokens.reduce((s, t) => s + (t.volume24h ?? 0), 0);
    return { count: tokens.length, totalMcap, totalVol };
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
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark size={28} />
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/tokens"
              className="text-sm font-semibold text-[var(--ink)] transition"
            >
              Tokens
            </Link>
            <Link
              href="/demo"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Demo
            </Link>
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">
              Launch
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-20 md:pb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span>{tokens.length} tokens live</span>
          </div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.04em] md:text-7xl">
            Approved Tokens
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Every token below is accepted as collateral on Magpie. Deposit any
            of them to your wallet, pick a tier, and borrow SOL instantly.
            Real-time data powered by DexScreener.
          </p>

          {/* Stats cards */}
          {!loading && (
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Accepted Tokens"
                value={stats.count.toString()}
              />
              <StatCard
                label="Combined Market Cap"
                value={fmtUsd(stats.totalMcap)}
              />
              <StatCard
                label="24h Combined Volume"
                value={fmtUsd(stats.totalVol)}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Table Section ── */}
      <section className="mx-auto max-w-7xl px-6 py-10">
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
                <tr className="border-b border-[var(--hairline)] text-left text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
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
                    className="border-b border-[var(--hairline)] last:border-0 transition hover:bg-[var(--accent)]/[0.03]"
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
                          imageUrl={t.imageUrl}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {t.name}
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
              <div className="py-16 text-center text-[var(--ink-soft)]">
                No tokens match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Request Section ── */}
      <section className="border-t border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
              Don&rsquo;t see your token?
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
              Submit a request and we&rsquo;ll review it. We typically approve
              new tokens within 24 hours if they have sufficient liquidity.
            </p>
            <RequestForm />
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
        <div className="relative mx-auto max-w-7xl px-6 py-16 text-center md:py-20">
          <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
            Ready to borrow against your bags?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/60">
            Open the Telegram bot, deposit collateral, and get SOL in seconds.
          </p>
          <a
            href={TELEGRAM_URL}
            className="btn-accent mt-8 inline-flex text-base"
          >
            Launch on Telegram <span aria-hidden>&#8594;</span>
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex items-center gap-8 text-sm text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--ink)]">
              Home
            </Link>
            <Link href="/demo" className="transition hover:text-[var(--ink)]">
              Demo
            </Link>
            <Link
              href="/dashboard"
              className="transition hover:text-[var(--ink)]"
            >
              Dashboard
            </Link>
            <a
              href={TELEGRAM_URL}
              className="transition hover:text-[var(--ink)]"
            >
              Telegram
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-[var(--ink)]"
            >
              X
            </a>
          </div>
          <div className="text-xs text-[var(--ink-soft)]">
            &copy; {new Date().getFullYear()} Magpie
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-5 py-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-medium tracking-[-0.03em]">
        {value}
      </div>
    </div>
  );
}

function TokenIcon({
  symbol,
  mint,
  imageUrl,
}: {
  symbol: string;
  mint: string;
  imageUrl: string | null;
}) {
  const [src, setSrc] = useState(
    imageUrl ||
      `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`,
  );
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
        if (
          !imageUrl ||
          src === `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`
        ) {
          setFailed(true);
        } else {
          setSrc(
            `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`,
          );
        }
      }}
    />
  );
}

function RequestForm() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [mint, setMint] = useState("");
  const [reason, setReason] = useState("");
  const [telegram, setTelegram] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !symbol.trim() || !mint.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/token-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          symbol: symbol.trim(),
          mint: mint.trim(),
          reason: reason.trim(),
          telegram: telegram.trim(),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setName("");
      setSymbol("");
      setMint("");
      setReason("");
      setTelegram("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 text-center">
        <div className="text-2xl">&#10003;</div>
        <div className="mt-2 font-semibold">Request submitted!</div>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          We&rsquo;ll review your token and get back to you.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium text-[var(--accent)] underline underline-offset-2"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Token Name"
          placeholder="e.g. Dogwifhat"
          value={name}
          onChange={setName}
          required
        />
        <Field
          label="Ticker"
          placeholder="e.g. WIF"
          value={symbol}
          onChange={setSymbol}
          required
        />
      </div>
      <Field
        label="Mint Address"
        placeholder="Solana token mint address"
        value={mint}
        onChange={setMint}
        required
        mono
      />
      <Field
        label="Why should we add this token?"
        placeholder="Liquidity, community size, notable listings\u2026"
        value={reason}
        onChange={setReason}
        textarea
      />
      <Field
        label="Your Telegram (optional)"
        placeholder="@username"
        value={telegram}
        onChange={setTelegram}
      />

      {status === "error" && (
        <p className="text-sm text-[var(--bad)]">
          Something went wrong. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || !name || !symbol || !mint}
        className="btn-accent mt-2 w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Submitting\u2026" : "Submit Request"}
      </button>
    </form>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  required,
  mono,
  textarea,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  mono?: boolean;
  textarea?: boolean;
}) {
  const cls = `w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 ${mono ? "font-mono text-xs" : ""}`;

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {label}
        {required && <span className="text-[var(--bad)]"> *</span>}
      </span>
      {textarea ? (
        <textarea
          className={cls + " min-h-[80px] resize-y"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={cls}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </label>
  );
}
