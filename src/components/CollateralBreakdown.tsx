"use client";

/**
 * CollateralBreakdown — table of every token currently being used as
 * collateral on Magpie. Shows active loans, lifetime loans, and SOL
 * borrowed against it. Sorted by active loans (most-used first).
 *
 * Renders on /stats. Auto-refreshes every 60s. Social proof: shows
 * the protocol's actual collateral diversity rather than promising it
 * abstractly.
 *
 * Logo resolution (mirrors the rest of the site):
 *   1. Local registry image (for xStocks — /tokens/xTSLA.svg etc.)
 *   2. DB image_url (whatever the screener captured at submission)
 *   3. DexScreener cached image by mint
 *   4. Initial badge (symbol's first letter on accent bg)
 */
import { useEffect, useState } from "react";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

interface CollateralToken {
  symbol: string;
  name: string | null;
  mint: string;
  image_url: string | null;
  decimals: number;
  active_loans: number;
  repaid_loans: number;
  liquidated_loans: number;
  total_loans: number;
  total_borrowed_sol: number;
  active_borrowed_sol: number;
  /** Raw sum of collateral_amount across all ACTIVE loans. Use with
   *  `decimals` to convert to human-readable. Comes from sum'd raw
   *  on-chain values — safe to BigInt regardless of supply size. */
  active_collateral_raw: string;
}

function fmtSol(n: number) {
  if (n < 0.001) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  if (n < 100) return n.toFixed(2);
  return n.toFixed(1);
}

/** BigInt-safe token-amount formatter. e.g. ("14160345328", 6) → "14,160.35".
 *  Returns "0" when raw is zero/empty/invalid. Decimals are read from
 *  supported_mints which the bot verifies against on-chain mint info. */
function fmtTokenAmount(rawStr: string, decimals: number): string {
  if (!rawStr || rawStr === "0") return "0";
  try {
    const raw = BigInt(rawStr);
    if (raw === 0n) return "0";
    const divisor = 10n ** BigInt(Math.max(0, decimals));
    const whole = raw / divisor;
    const frac = raw % divisor;
    // Big-supply memecoins display as K/M/B abbreviations
    const wholeNum = Number(whole);
    if (wholeNum >= 1_000_000_000) return (wholeNum / 1_000_000_000).toFixed(2) + "B";
    if (wholeNum >= 1_000_000)     return (wholeNum / 1_000_000).toFixed(2) + "M";
    if (wholeNum >= 1_000)         return (wholeNum / 1_000).toFixed(2) + "K";
    const wholeStr = whole.toString();
    if (decimals === 0 || frac === 0n) return wholeStr;
    const fracDigits = wholeNum < 1 ? Math.min(decimals, 6) : 2;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, fracDigits).replace(/0+$/, "");
    return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  } catch {
    return "—";
  }
}

export function CollateralBreakdown() {
  const [tokens, setTokens] = useState<CollateralToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/transparency/collateral");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.tokens)) {
          setTokens(json.tokens);
          setLoading(false);
        }
      } catch { /* silent */ }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="text-center text-sm text-[var(--ink-faint)] py-8">
        Loading…
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--ink-soft)]">
        No tokens have loans against them yet.
      </div>
    );
  }

  // Compute totals for proportion bars
  const maxActive = Math.max(...tokens.map((t) => t.active_loans), 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-12 gap-3 border-b border-[var(--hairline)] bg-[var(--surface)] px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        <div className="col-span-3">Token</div>
        <div className="col-span-2">Active loans</div>
        <div className="col-span-1 text-right">Lifetime</div>
        <div className="col-span-2 text-right">Locked collateral</div>
        <div className="col-span-2 text-right">Active SOL</div>
        <div className="col-span-2 text-right">Lifetime SOL</div>
      </div>

      <div className="divide-y divide-[var(--hairline)]">
        {tokens.map((t) => {
          const pct = maxActive > 0 ? (t.active_loans / maxActive) * 100 : 0;
          return (
            <div
              key={t.mint}
              className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-4 transition hover:bg-[var(--surface)]"
            >
              {/* Token (with image if available) */}
              <div className="col-span-2 md:col-span-3 flex items-center gap-3 min-w-0">
                <TokenLogo symbol={t.symbol} mint={t.mint} imageUrl={t.image_url} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">${t.symbol}</div>
                  {t.name && (
                    <div className="text-[10px] text-[var(--ink-faint)] truncate">{t.name}</div>
                  )}
                </div>
              </div>

              {/* Active loans bar */}
              <div className="col-span-2 md:col-span-2 flex items-center gap-2">
                <span className="font-display tabular text-base font-medium w-6">{t.active_loans}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Lifetime count */}
              <div className="col-span-1 md:col-span-1 text-right">
                <div className="md:hidden text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Lifetime</div>
                <div className="font-display tabular text-sm">{t.total_loans}</div>
              </div>

              {/* Locked collateral — token amount currently in escrow */}
              <div className="col-span-1 md:col-span-2 text-right">
                <div className="md:hidden text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Locked</div>
                <div className="font-display tabular text-sm">
                  {t.active_loans > 0 ? fmtTokenAmount(t.active_collateral_raw, t.decimals) : "—"}
                </div>
                <div className="text-[10px] text-[var(--ink-faint)] hidden md:block">
                  {t.active_loans > 0 ? t.symbol : ""}
                </div>
              </div>

              {/* Active SOL borrowed */}
              <div className="col-span-1 md:col-span-2 text-right">
                <div className="md:hidden text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Active SOL</div>
                <div className="font-display tabular text-sm">{fmtSol(t.active_borrowed_sol)}</div>
              </div>

              {/* Lifetime SOL — desktop only */}
              <div className="hidden md:block col-span-2 text-right">
                <div className="font-display tabular text-sm text-[var(--ink-soft)]">{fmtSol(t.total_borrowed_sol)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--hairline)] px-5 py-2 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        {tokens.length} {tokens.length === 1 ? "token" : "tokens"} · refreshes every 60s
      </div>
    </div>
  );
}

/* ─── TokenLogo ─── */

function TokenLogo({
  symbol,
  mint,
  imageUrl,
}: {
  symbol: string;
  mint: string;
  imageUrl: string | null;
}) {
  // Priority chain: registry image → DB image_url → DexScreener → initial.
  // The registry image is for xStocks (local SVGs); memecoins fall through
  // to DexScreener which has a cached image for ~every Solana token by mint.
  const registryImage = TOKEN_REGISTRY.find((t) => t.mint === mint)?.image ?? null;
  const dexScreenerUrl = `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;
  const initialSrc = registryImage || imageUrl || dexScreenerUrl;

  const [src, setSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="h-8 w-8 rounded-full bg-[var(--accent)]/15 flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-[var(--accent-deep)] ring-1 ring-[var(--hairline)]">
        {symbol[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={symbol}
      className="h-8 w-8 rounded-full flex-shrink-0 object-cover ring-1 ring-[var(--hairline)] bg-[var(--bg)]"
      onError={() => {
        // Walk the fallback chain on failure
        if (registryImage && src === registryImage && (imageUrl || mint)) {
          setSrc(imageUrl || dexScreenerUrl);
        } else if (imageUrl && src === imageUrl && mint) {
          setSrc(dexScreenerUrl);
        } else if (src !== dexScreenerUrl) {
          setSrc(dexScreenerUrl);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
