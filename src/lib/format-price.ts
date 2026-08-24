/**
 * Magnitude-aware price/amount formatting — THE single source of truth for
 * every user-facing number on the site.
 *
 * Operator mandate (2026-08-24): a $SPCX auto-sell target rendered as
 * "$170.0000" — four decimals on a stock price is a cosmetic defect, but the
 * fix must be holistic: fixed decimal counts are wrong at every magnitude
 * except the one they were written for. $170.0000 is noise; $0.00 on a
 * microcap destroys the information entirely.
 *
 * THE RULE:
 *   USD ≥ $1        → exactly 2 decimals, thousands separators   $170.00  $1,234.50
 *   USD $0.01–$1    → 4 significant digits                       $0.228   $0.06029
 *   USD < $0.01     → 4 significant digits (never "$0.00")       $0.0006408
 *   SOL ≥ 1         → up to 3 decimals (trailing zeros trimmed)  12.5 SOL  1.334 SOL
 *   SOL < 1         → 4 significant digits                       0.03947 SOL
 *
 * Ad-hoc `toFixed(n)` on prices/amounts is banned in components — import from
 * here instead, so a formatting decision is made exactly once.
 */

/** Format a USD price/value, magnitude-aware. */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "—";
  const sign = usd < 0 ? "-" : "";
  const v = Math.abs(usd);
  if (v === 0) return "$0.00";
  if (v >= 1) {
    return `${sign}$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Sub-dollar: 4 significant digits, never scientific, never "$0.00".
  const s = v.toPrecision(4);
  const plain = Number(s) < 1e-6 ? Number(s).toFixed(12).replace(/0+$/, "") : s.includes("e")
    ? Number(s).toFixed(Math.max(2, -Math.floor(Math.log10(v)) + 3))
    : s;
  return `${sign}$${trimTrailingZeros(plain)}`;
}

/** Format a SOL amount, magnitude-aware. */
export function formatSol(sol: number): string {
  if (!Number.isFinite(sol)) return "—";
  const sign = sol < 0 ? "-" : "";
  const v = Math.abs(sol);
  if (v === 0) return "0";
  if (v >= 1) return `${sign}${trimTrailingZeros(v.toFixed(3))}`;
  return `${sign}${trimTrailingZeros(Number(v.toPrecision(4)).toFixed(12))}`;
}

/** Format a token amount (generic asset units), magnitude-aware. */
export function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const v = Math.abs(amount);
  if (v >= 1000) return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return trimTrailingZeros(amount.toFixed(2));
  if (v === 0) return "0";
  return trimTrailingZeros(Number(amount.toPrecision(4)).toFixed(12));
}

function trimTrailingZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
