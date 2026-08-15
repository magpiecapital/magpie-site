/**
 * Public per-token scorecard. SSR-rendered so SEO + shareable links
 * work. Anyone (logged in or not, TG or non-TG) can paste a mint
 * here and see exactly how the protocol classifies that token —
 * tier, cap, remaining capacity, the screener metrics behind the
 * decision, and lifetime activity. Makes our automated risk
 * decisions auditable from the outside.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface ScorecardResponse {
  ok: boolean;
  token?: {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    category: string | null;
    image: string | null;
    enabled: boolean;
  };
  tier?: {
    label: string;
    capSol: number | null;
    usedSol: number;
    remainingSol: number | null;
    activeLoans: number;
    mcapFallback: boolean;
    demotionReason: string | null;
  };
  risk_metrics?: {
    liquidity_usd: number;
    market_cap_usd: number;
    holder_count: number;
    token_age_hours: number;
    top10_holder_pct: number;
    has_mint_authority: boolean;
    has_freeze_authority: boolean;
    lp_burned: boolean;
    last_screened_at: string | null;
  };
  lifetime?: {
    borrowed_sol: number;
    loan_count: number;
    repaid: number;
    liquidations: number;
    liquidation_rate: number;
  } | null;
  generated_at?: string;
}

async function fetchScorecard(mint: string): Promise<ScorecardResponse | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  try {
    const res = await fetch(`${base}/api/v1/tokens/${mint}`, {
      next: { revalidate: 30 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ mint: string }> },
): Promise<Metadata> {
  const { mint } = await params;
  const data = await fetchScorecard(mint);
  if (!data?.token) {
    return { title: "Token not found | Magpie" };
  }
  const tierLabel = data.tier?.label ?? "small";
  const capSol = data.tier?.capSol;
  return {
    title: `$${data.token.symbol} · ${tierLabel} tier | Magpie`,
    description: `Magpie classifies $${data.token.symbol} as ${tierLabel} tier${capSol ? ` (${capSol} SOL protocol cap)` : ""}. Live risk metrics, lifetime activity, and cap utilization.`,
  };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

const TIER_COLORS: Record<string, string> = {
  bluechip: "var(--accent-deep)",
  large: "var(--accent-deep)",
  mid: "var(--warn, #d97706)",
  small: "var(--ink-soft)",
  unlimited: "var(--accent-deep)",
  "operator-pinned": "var(--accent-deep)",
};

export default async function TokenScorecardPage(
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  const data = await fetchScorecard(mint);
  if (!data?.token || !data.tier || !data.risk_metrics) {
    notFound();
  }
  const { token, tier, risk_metrics: rm, lifetime } = data;
  const tierColor = TIER_COLORS[tier.label] ?? "var(--ink-soft)";
  const utilizationPct = tier.capSol && tier.capSol > 0
    ? Math.min(100, (tier.usedSol / tier.capSol) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Heading */}
        <div className="flex items-start gap-4 mb-8">
          {token.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={token.image} alt={token.symbol} className="h-12 w-12 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-bold tracking-tight">
                ${token.symbol}
              </h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: tierColor, borderColor: tierColor }}
              >
                {tier.label}
                {tier.mcapFallback && <span className="text-[10px] opacity-70">(mcap)</span>}
              </span>
            </div>
            <div className="mt-1 text-sm text-[var(--ink-soft)]">{token.name}</div>
            <div className="mt-2 font-mono text-[10px] text-[var(--ink-faint)] break-all">
              {token.mint}
            </div>
          </div>
        </div>

        {/* Cap utilization */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-2">
            Protocol exposure cap
          </div>
          {tier.capSol === null ? (
            <div className="text-2xl font-display font-bold" style={{ color: tierColor }}>
              Unlimited
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="font-display text-2xl font-bold tabular-nums">
                  {tier.usedSol.toFixed(2)} <span className="text-[var(--ink-soft)] text-base font-normal">/ {tier.capSol.toFixed(0)} SOL borrowed</span>
                </div>
                <div className="text-sm" style={{ color: utilizationPct >= 90 ? "var(--bad, #dc2626)" : utilizationPct >= 75 ? "var(--warn, #d97706)" : "var(--ink-soft)" }}>
                  {tier.remainingSol != null && tier.remainingSol > 0
                    ? `${tier.remainingSol.toFixed(2)} SOL capacity left`
                    : "at cap"}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--hairline)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${utilizationPct}%`,
                    background: utilizationPct >= 90 ? "var(--bad, #dc2626)" : utilizationPct >= 75 ? "var(--warn, #d97706)" : tierColor,
                  }}
                />
              </div>
              <div className="mt-3 text-xs text-[var(--ink-soft)]">
                {tier.activeLoans} active loan{tier.activeLoans === 1 ? "" : "s"} against this token right now.
              </div>
            </>
          )}
        </section>

        {/* Why this tier — surfaces the protocol's reasoning */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Why this tier
          </div>
          {tier.demotionReason && (
            <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">Demoted to small:</span> {tier.demotionReason}
            </div>
          )}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Liquidity</dt>
              <dd className="font-medium">{formatUsd(rm.liquidity_usd)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Market cap</dt>
              <dd className="font-medium">{formatUsd(rm.market_cap_usd)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Holders</dt>
              <dd className="font-medium">{rm.holder_count > 0 ? rm.holder_count.toLocaleString() : <span className="text-[var(--ink-faint)]">—</span>}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Token age</dt>
              <dd className="font-medium">{rm.token_age_hours > 0 ? formatAge(rm.token_age_hours) : <span className="text-[var(--ink-faint)]">—</span>}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Top-10 share</dt>
              <dd className="font-medium">{rm.top10_holder_pct > 0 ? `${rm.top10_holder_pct.toFixed(1)}%` : <span className="text-[var(--ink-faint)]">—</span>}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">LP burned</dt>
              <dd className="font-medium">
                {rm.lp_burned ? <span className="text-emerald-600">yes</span> : <span className="text-[var(--ink-soft)]">no</span>}
              </dd>
            </div>
          </dl>
          <div className="mt-4 pt-3 border-t border-[var(--hairline)] grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={rm.has_mint_authority ? "text-red-600 font-semibold" : "text-emerald-600"}>
                {rm.has_mint_authority ? "✗" : "✓"}
              </span>
              <span className="text-[var(--ink-soft)]">mint authority revoked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={rm.has_freeze_authority ? "text-red-600 font-semibold" : "text-emerald-600"}>
                {rm.has_freeze_authority ? "✗" : "✓"}
              </span>
              <span className="text-[var(--ink-soft)]">freeze authority revoked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={rm.lp_burned ? "text-emerald-600" : "text-[var(--ink-soft)]"}>
                {rm.lp_burned ? "✓" : "—"}
              </span>
              <span className="text-[var(--ink-soft)]">LP burned</span>
            </div>
          </div>
        </section>

        {/* Lifetime activity on this token */}
        {lifetime && lifetime.loan_count > 0 && (
          <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
              Lifetime activity (against this token)
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Total loans</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{lifetime.loan_count}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Borrowed</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{lifetime.borrowed_sol.toFixed(2)} <span className="text-xs font-normal text-[var(--ink-soft)]">SOL</span></dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Repaid</dt>
                <dd className="font-display text-xl font-bold tabular-nums text-emerald-600">{lifetime.repaid}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Liquidations</dt>
                <dd className="font-display text-xl font-bold tabular-nums" style={{ color: lifetime.liquidations > 0 ? "var(--warn, #d97706)" : "var(--ink-soft)" }}>
                  {lifetime.liquidations}
                  {lifetime.loan_count > 0 && (
                    <span className="text-xs font-normal text-[var(--ink-faint)] ml-1">
                      ({(lifetime.liquidation_rate * 100).toFixed(1)}%)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* Verify externally */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Verify externally
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-[var(--hairline-strong)] px-3 py-2 underline text-[var(--accent-deep)]">
              Solscan ↗
            </a>
            <a href={`https://dexscreener.com/solana/${token.mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-[var(--hairline-strong)] px-3 py-2 underline text-[var(--accent-deep)]">
              DexScreener ↗
            </a>
            <a href={`https://birdeye.so/token/${token.mint}?chain=solana`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-[var(--hairline-strong)] px-3 py-2 underline text-[var(--accent-deep)]">
              Birdeye ↗
            </a>
          </div>
        </section>

        <div className="text-xs text-[var(--ink-faint)] text-center">
          <Link href="/tokens" className="underline">← All approved tokens</Link>
          <span className="mx-2">·</span>
          <Link href={`/borrow/${token.symbol.toLowerCase()}`} className="underline">
            Borrow against ${token.symbol}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/dashboard" className="underline">Dashboard</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
