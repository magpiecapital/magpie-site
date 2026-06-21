/**
 * Robust cross-sourced USD pricing for collateral tokens.
 *
 * WHY THIS EXISTS (P0, 2026-06-20)
 * ────────────────────────────────
 * Every surface that priced tokens straight from DexScreener could be grossly
 * over-valued by a SINGLE mis-priced pair. Real incident: the only $PUMP pair
 * is PUMP/MET on Meteora, whose derived priceUsd was $7.32 while $PUMP is
 * really ~$0.00146 (Jupiter + the on-chain price attestation agree) — a
 * ~5000x error that inflated every loan option on the dashboard.
 *
 * Jupiter is the protocol's PRIMARY price oracle — the SAME source the
 * on-chain price attestation uses to value collateral. So display valuation
 * MUST agree with Jupiter, or the figure shown to the user diverges from the
 * loan the program will actually issue. This module makes Jupiter the source
 * of truth for price, keeps DexScreener only for liquidity/volume metrics +
 * as a fallback when Jupiter has no quote, and rejects a wildly-divergent
 * DexScreener price so a single bad pair can NEVER inflate a value again.
 *
 * PARAMETERS (the guardrails — tune here, one place):
 *   PRICE_SOURCE_PRIORITY        Jupiter > DexScreener (Jupiter is authoritative)
 *   PRICE_DIVERGENCE_REJECT_RATIO  3 — a DexScreener price more than 3x above or
 *                                  below Jupiter is treated as an outlier and
 *                                  ignored (logged). Jupiter wins.
 *   FETCH_TIMEOUT_MS             7000
 *
 * Used by EVERY collateral-pricing surface (eligible-collateral, calculate,
 * loans, take-profit) so they share one robust valuation.
 */
const JUP_PRICE_URL = "https://lite-api.jup.ag/price/v3";
const DEXSCREENER_URL = "https://api.dexscreener.com/tokens/v1/solana";

export const PRICE_DIVERGENCE_REJECT_RATIO = 3;
const FETCH_TIMEOUT_MS = 7000;

export interface RobustPrice {
  mint: string;
  /** Authoritative USD price (Jupiter-primary), or null if no source had one. */
  priceUsd: number | null;
  source: "jupiter" | "dexscreener" | "none";
  /** DexScreener metrics (kept for risk preview; never used for the price). */
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24hPct: number | null;
}

/**
 * Fetch robust USD prices for a set of mints. Jupiter-primary with DexScreener
 * fallback + outlier rejection. Never throws — a missing source yields a null
 * price for that mint (callers treat null as "no price", same as before).
 */
export async function robustTokenPricesUsd(
  mints: string[],
  opts: { timeoutMs?: number } = {},
): Promise<Map<string, RobustPrice>> {
  const out = new Map<string, RobustPrice>();
  const unique = [...new Set(mints.filter(Boolean))];
  if (unique.length === 0) return out;
  const timeout = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const ids = unique.join(",");

  const [jupRes, dexRes] = await Promise.allSettled([
    fetch(`${JUP_PRICE_URL}?ids=${encodeURIComponent(ids)}`, { signal: AbortSignal.timeout(timeout) }),
    fetch(`${DEXSCREENER_URL}/${encodeURIComponent(ids)}`, { signal: AbortSignal.timeout(timeout) }),
  ]);

  // Jupiter (authoritative price).
  const jup = new Map<string, number>();
  if (jupRes.status === "fulfilled" && jupRes.value.ok) {
    try {
      const jd = (await jupRes.value.json()) as Record<string, { usdPrice?: number } | null>;
      for (const [m, v] of Object.entries(jd || {})) {
        const p = Number(v?.usdPrice);
        if (isFinite(p) && p > 0) jup.set(m, p);
      }
    } catch {
      /* ignore malformed */
    }
  }

  // DexScreener (deepest-liquidity pair per mint — metrics + fallback only).
  const dex = new Map<string, { price: number; liquidity: number; volume24h: number; priceChange24h: number }>();
  if (dexRes.status === "fulfilled" && dexRes.value.ok) {
    try {
      const raw = await dexRes.value.json();
      const pairs = Array.isArray(raw) ? raw : (raw?.pairs ?? []);
      for (const p of pairs as Array<{
        baseToken?: { address?: string };
        priceUsd?: string;
        priceChange?: { h24?: number };
        volume?: { h24?: number };
        liquidity?: { usd?: number };
      }>) {
        const addr = p?.baseToken?.address;
        const price = parseFloat(p?.priceUsd ?? "0");
        const liq = p?.liquidity?.usd ?? 0;
        if (!addr || !isFinite(price) || price <= 0) continue;
        const ex = dex.get(addr);
        if (!ex || liq > ex.liquidity) {
          dex.set(addr, {
            price,
            liquidity: liq,
            volume24h: p?.volume?.h24 ?? 0,
            priceChange24h: p?.priceChange?.h24 ?? 0,
          });
        }
      }
    } catch {
      /* ignore malformed */
    }
  }

  for (const mint of unique) {
    const j = jup.get(mint);
    const d = dex.get(mint);
    let priceUsd: number | null = null;
    let source: RobustPrice["source"] = "none";
    if (j && j > 0) {
      priceUsd = j;
      source = "jupiter";
      if (d && d.price > 0) {
        const ratio = d.price / j;
        if (ratio > PRICE_DIVERGENCE_REJECT_RATIO || ratio < 1 / PRICE_DIVERGENCE_REJECT_RATIO) {
          console.warn(
            `[robust-price] DexScreener outlier ${mint.slice(0, 8)}…: dex=$${d.price} jup=$${j} ` +
              `(${ratio.toFixed(1)}x) — using Jupiter`,
          );
        }
      }
    } else if (d && d.price > 0) {
      priceUsd = d.price;
      source = "dexscreener";
    }
    out.set(mint, {
      mint,
      priceUsd,
      source,
      liquidityUsd: d?.liquidity ?? null,
      volume24hUsd: d?.volume24h ?? null,
      priceChange24hPct: d ? d.priceChange24h : null,
    });
  }
  return out;
}

/** Convenience: robust USD price for a single mint (or null). */
export async function robustTokenPriceUsd(mint: string, opts?: { timeoutMs?: number }): Promise<number | null> {
  const m = await robustTokenPricesUsd([mint], opts);
  return m.get(mint)?.priceUsd ?? null;
}
