"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PhoneMock } from "@/components/PhoneMock";
import type { LoanTier } from "@/lib/db";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ───────────────────────── LOAN TIERS ─────────────────────────
 *
 * Tiers are fetched from /api/v1/loan-tiers (memecoin + stock) at
 * page-render time and passed in as props. That keeps the displayed
 * numbers in lock-step with what the bot quotes — when the operator
 * tunes rwa_loan_tiers or MEMECOIN_TIERS, this page picks it up on
 * the next 60s revalidation cycle. See [[feedback_single_source_of_truth]].
 */

interface UiTier {
  name: string;
  ltv: number;     // fraction (0.30 = 30%)
  days: number;
  fee: number;     // fraction (0.015 = 1.5%)
  tag: string;
  desc: string;
}

const MEME_DESCRIPTIONS: Record<string, { tag: string; desc: string }> = {
  Express:  { tag: "Most SOL", desc: "Maximum borrowing power. Best for short-term plays where you need the most capital." },
  Quick:    { tag: "Popular",  desc: "Balanced option. More time to repay with a comfortable loan-to-value ratio." },
  Standard: { tag: "Safest",   desc: "Lowest LTV means more room before liquidation. A full week to repay." },
};

// 2026-06-13: RWA tiers now mirror memecoin LTVs (30/25/20%) because V2
// program hardcodes the same ladder. Descriptions updated to remove the
// "max LTV / 30-day" copy that was never accurate on-chain. A future V3
// program with truly higher LTVs is the only path to differentiate
// RWA pricing.
const RWA_DESCRIPTIONS: Record<string, { tag: string; desc: string }> = {
  "RWA Express":  { tag: "Fast cash",   desc: "Stocks / ETFs / metals as collateral, same 2-day Express term. Premium rate, most SOL upfront." },
  "RWA Quick":    { tag: "Balanced",    desc: "Mid-term option for tokenized stocks. Comfortable LTV with three days to repay." },
  "RWA Standard": { tag: "Best rate",   desc: "Lowest fee, a full week to repay. Stocks / ETFs / metals only — same on-chain math as memecoin Standard, different collateral class." },
};

function adaptTier(t: LoanTier, descs: Record<string, { tag: string; desc: string }>, fallbackName: string): UiTier {
  // The bot's `label` is e.g. "Express" or "RWA Express"; the bare name
  // is the first whitespace-delimited token that maps cleanly to our
  // description dictionary. Fall back to the raw label if the dict
  // doesn't recognize it (so a new tier from the bot still renders).
  const labelMatch = t.label.match(/\(([^)]+)\)\s*$/);
  const niceName = labelMatch ? labelMatch[1] : fallbackName;
  const dictKey = Object.keys(descs).find((k) => t.label.includes(k)) || niceName;
  const desc = descs[dictKey] || { tag: niceName, desc: "" };
  return {
    name: dictKey || niceName,
    ltv: t.ltv_pct / 100,
    days: t.duration_days,
    fee: t.fee_bps / 10_000,
    tag: desc.tag,
    desc: desc.desc,
  };
}

function fmtFeePct(fee: number) {
  // Show one decimal for sub-2% rates, otherwise round (3% reads cleaner than 3.0%)
  return (fee * 100).toFixed(fee < 0.02 ? 1 : 0);
}

/* ───────────────────────── CREDIT TIERS ───────────────────────── */

const CREDIT_TIERS = [
  { name: "Bronze", range: "300–499", ltv: "20–30%", fee: "1.5–3%", term: "7 days" },
  { name: "Silver", range: "500–649", ltv: "22–32%", fee: "1.5–3%", term: "7 days" },
  { name: "Gold", range: "650–749", ltv: "25–35%", fee: "1.25–2.75%", term: "14 days" },
  { name: "Platinum", range: "750–850", ltv: "28–38%", fee: "1.0–2.5%", term: "30 days" },
];

/* ───────────────────────── HOW TO BORROW ───────────────────────── */

// True when memecoin and RWA tier ladders are economically identical
// (same option, LTV, days, fee across the whole ladder). Today they are —
// V2 program hardcodes the same ladder for both categories. When V3 routing
// flips and the RWA ladder diverges (50/60/70% @ 7/15/30d), this returns
// false and the differentiated UI comes back automatically.
function laddersIdentical(a: UiTier[], b: UiTier[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return a.every((m, i) => {
    const r = b[i];
    return r.ltv === m.ltv && r.days === m.days && r.fee === m.fee;
  });
}

function buildSteps(tokenCount: number, memeTiers: UiTier[], rwaTiers: UiTier[]) {
  const memeSummary = memeTiers
    .map((t) => `${Math.round(t.ltv * 100)}% LTV / ${t.days}d`)
    .join(", ");
  const rwaSummary = rwaTiers.length > 0
    ? rwaTiers.map((t) => `${Math.round(t.ltv * 100)}% LTV / ${t.days}d`).join(", ")
    : null;
  const unified = laddersIdentical(memeTiers, rwaTiers);
  // Derive the actual current fee range from the live tier data so the
  // copy can't drift from on-chain reality the way the previous "RWA tiers
  // 2.5-5%" line did after mig 056 collapsed them to 1.5-3%.
  const allFees = [...memeTiers, ...rwaTiers].map((t) => t.fee).filter((f) => f > 0);
  const feeMin = allFees.length ? Math.min(...allFees) : 0.015;
  const feeMax = allFees.length ? Math.max(...allFees) : 0.03;
  const feeRangeStr = `${(feeMin * 100).toFixed(1)}–${(feeMax * 100).toFixed(0)}%`;
  return [
    {
      num: "1",
      title: "Open the dashboard",
      desc: "Go to magpie.capital/dashboard and connect your wallet — or just ask Pip (the chat helper on every page) to start a loan for you.",
      cmd: null,
    },
    {
      num: "2",
      title: "Pick your collateral",
      desc: `Your dashboard shows every supported holding in your wallet — pick from ${tokenCount} approved tokens. Live USD price, tier-aware caps, and exact SOL you'll receive — all visible before you commit.`,
      cmd: null,
    },
    {
      num: "3",
      title: "Select a loan tier",
      desc: unified
        ? `Three tiers across all collateral: ${memeSummary}. Same ladder applies to memecoins and tokenized stocks today. Higher-LTV RWA tiers (50/60/70% @ 7/15/30d) ship with the v3 program — currently in deploy.`
        : rwaSummary
          ? `Memecoins: ${memeSummary}. Tokenized stocks, ETFs, metals: ${rwaSummary} — lower volatility unlocks higher LTVs and longer terms. The dashboard shows your exact payout before you confirm.`
          : `Memecoin tiers: ${memeSummary}. The dashboard shows your exact payout before you confirm.`,
      cmd: null,
    },
    {
      num: "4",
      title: "Sign and receive SOL",
      desc: `Approve the transaction in your wallet. SOL lands in seconds. A small origination fee is deducted upfront — current ladder runs ${feeRangeStr}.`,
      cmd: null,
    },
    {
      num: "5",
      title: "Repay and get your tokens back",
      desc: "Repay from the dashboard before the term ends. Your collateral is returned the same instant. On-time repayment builds your on-chain credit score and unlocks better tiers next time.",
      cmd: null,
    },
  ];
}

/* ───────────────────────── TIER CARD ───────────────────────── */

// Each tier card is a click target — landing on the dashboard with the
// matching category + tier pre-selected. Every interaction on the
// marketplace should be a path to "open a loan", not a dead-end
// presentation surface. The user gets:
//   memecoin tiers  → /dashboard?category=memecoin&tier=N
//   RWA tiers       → /dashboard?category=stock&tier=N    (covers
//                     stock/etf/metal collectively — dashboard scopes
//                     to RWA-eligible holdings)
function TierCard({ tier: t, variant, index = 0 }: { tier: UiTier; variant?: "rwa"; index?: number }) {
  const barColor = variant === "rwa" ? "var(--accent-deep)" : "var(--accent)";
  const category = variant === "rwa" ? "stock" : "memecoin";
  const href = `/dashboard?category=${category}&tier=${index}`;
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 transition hover:border-[var(--accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{t.name}</h3>
        <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-deep)]">
          {t.tag}
        </span>
      </div>
      {t.desc ? <p className="mt-2 text-sm text-[var(--ink-soft)]">{t.desc}</p> : null}

      <div className="mt-5 flex gap-4">
        <div>
          <div className="font-display text-3xl font-bold text-[var(--ink)]">{Math.round(t.ltv * 100)}%</div>
          <div className="text-xs text-[var(--ink-faint)]">LTV</div>
        </div>
        <div className="border-l border-[var(--hairline)] pl-4">
          <div className="font-display text-3xl font-bold text-[var(--ink)]">{t.days}</div>
          <div className="text-xs text-[var(--ink-faint)]">days</div>
        </div>
        <div className="border-l border-[var(--hairline)] pl-4">
          <div className="font-display text-3xl font-bold text-[var(--ink)]">{fmtFeePct(t.fee)}%</div>
          <div className="text-xs text-[var(--ink-faint)]">fee</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-faint)]">
          <span>Borrowed</span>
          <span>Collateral buffer</span>
        </div>
        <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-[var(--surface)]">
          <div
            className="rounded-full transition-all duration-500"
            style={{ width: `${t.ltv * 100}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Sales-mentality CTA — always visible (so users know it's
          clickable on first scan), gains color + arrow translation on
          hover/focus. Mobile users see it without needing to hover. */}
      <div className="mt-5 flex items-center justify-between text-sm font-medium text-[var(--accent-deep)]">
        <span className="opacity-80 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          Start borrowing at this tier
        </span>
        <span
          aria-hidden
          className="text-base transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  );
}

/* ───────────────────────── MINI CALCULATOR ───────────────────────── */

interface LoanCalculatorProps {
  memeTiers: UiTier[];
  rwaTiers: UiTier[];
  hasRwa: boolean;
}

function LoanCalculator({ memeTiers, rwaTiers, hasRwa }: LoanCalculatorProps) {
  const [collateralValue, setCollateralValue] = useState(1000);
  const [selectedTier, setSelectedTier] = useState(0);
  const [category, setCategory] = useState<"memecoin" | "rwa">("memecoin");
  // When the ladders are identical, hide the toggle — a toggle that doesn't
  // change any number is the very mixed-signal we're fixing on this page.
  const unifiedLadders = useMemo(() => laddersIdentical(memeTiers, rwaTiers), [memeTiers, rwaTiers]);

  const activeTiers = category === "rwa" ? rwaTiers : memeTiers;
  const safeIndex = Math.min(selectedTier, activeTiers.length - 1);
  const tier = activeTiers[safeIndex];
  const loanAmount = collateralValue * tier.ltv;
  const fee = loanAmount * tier.fee;
  const payout = loanAmount - fee;
  const liquidationPrice = (1.1 * loanAmount) / collateralValue;

  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
      <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Quick estimate</h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Drag to see how much SOL you can borrow.</p>

      {/* Collateral category toggle — only meaningful when ladders differ.
          With v2 routing (today) the two categories share one ladder; the
          toggle would just swap labels without changing any number. */}
      {hasRwa && !unifiedLadders && (
        <div className="mt-5 inline-flex rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-1 text-xs">
          {(["memecoin", "rwa"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setSelectedTier(0);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                category === c
                  ? "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {c === "memecoin" ? "Memecoin" : "Tokenized stock / ETF / metal"}
            </button>
          ))}
        </div>
      )}

      {/* Collateral slider */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--ink-soft)]">Collateral value (USD)</span>
          <span className="font-display text-xl font-semibold text-[var(--ink)]">${collateralValue.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={100}
          max={50000}
          step={100}
          value={collateralValue}
          onChange={(e) => setCollateralValue(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--ink-faint)]">
          <span>$100</span>
          <span>$50,000</span>
        </div>
      </div>

      {/* Tier picker */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {activeTiers.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setSelectedTier(i)}
            className={`rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition ${
              safeIndex === i
                ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--ink)]"
                : "border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="font-semibold">{t.name}</div>
            <div className="text-[11px] text-[var(--ink-faint)]">{Math.round(t.ltv * 100)}% &middot; {t.days}d</div>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--surface)] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">You receive</div>
          <div className="mt-1 font-display text-2xl font-bold text-[var(--accent-deep)]">
            ${payout.toFixed(2)}
          </div>
          <div className="text-xs text-[var(--ink-faint)]">in SOL equivalent</div>
        </div>
        <div className="rounded-xl bg-[var(--surface)] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Repay</div>
          <div className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">
            ${loanAmount.toFixed(2)}
          </div>
          <div className="text-xs text-[var(--ink-faint)]">within {tier.days} days</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--ink-soft)]">Origination fee ({fmtFeePct(tier.fee)}%)</span>
        <span className="font-medium text-[var(--ink)]">${fee.toFixed(2)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--ink-soft)]">Liquidation threshold</span>
        <span className="font-medium text-[var(--ink)]">{(liquidationPrice * 100).toFixed(1)}% of current price</span>
      </div>

      <div className="mt-5 text-center">
        <Link
          href="/calculate"
          className="text-sm font-medium text-[var(--accent-deep)] hover:underline underline-offset-2"
        >
          Open full calculator with token selection &rarr;
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── MAIN PAGE ───────────────────────── */

interface MarketplaceClientProps {
  tokenCount: number;
  stockCount: number;
  memeTiers: LoanTier[];
  rwaTiers: LoanTier[];
}

export function MarketplaceClient({ tokenCount, stockCount, memeTiers, rwaTiers }: MarketplaceClientProps) {
  const meme = useMemo(() => memeTiers.map((t, i) => adaptTier(t, MEME_DESCRIPTIONS, ["Express","Quick","Standard"][i] || `Tier ${i+1}`)), [memeTiers]);
  const rwa  = useMemo(() => rwaTiers.map((t, i)  => adaptTier(t, RWA_DESCRIPTIONS,  ["RWA Express","RWA Quick","RWA Standard"][i] || `RWA Tier ${i+1}`)), [rwaTiers]);
  // 2026-06-13: when memecoin and RWA ladders are economically identical
  // (today, post mig 056), the differentiated UI is more confusing than
  // helpful — users see "Express 30%" + "RWA Express 30%" and reasonably
  // wonder what the difference is. Treat them as a single ladder until v3
  // routing flips and the API genuinely returns different numbers.
  const unifiedLadders = useMemo(() => laddersIdentical(meme, rwa), [meme, rwa]);
  const showRwaSection = stockCount > 0 && rwa.length > 0 && !unifiedLadders;
  const hasRwa = stockCount > 0 && rwa.length > 0;
  const STEPS = buildSteps(tokenCount, meme, rwa);
  const maxMemeLtv = Math.max(...meme.map((t) => t.ltv));
  const maxRwaLtv  = hasRwa ? Math.max(...rwa.map((t) => t.ltv)) : 0;
  const maxLtvLabel = unifiedLadders
    ? `${Math.round(maxMemeLtv * 100)}%`
    : hasRwa
      ? `${Math.round(maxMemeLtv * 100)}% / ${Math.round(maxRwaLtv * 100)}%`
      : `${Math.round(maxMemeLtv * 100)}%`;
  const maxLtvSubLabel = unifiedLadders
    ? undefined
    : hasRwa ? "Memecoin / RWA" : undefined;
  const maxTermDays = Math.max(...meme.map((t) => t.days), ...rwa.map((t) => t.days));
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        {/* ── Hero ── */}
        <div className="text-center">
          <div className="inline-block rounded-full bg-[var(--accent-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
            Instant memecoin-backed loans
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
            Borrow SOL against<br className="hidden sm:block" /> your bags.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--ink-soft)]">
            Magpie lends you SOL instantly. Deposit memecoins or tokenized stocks as collateral, pick a loan tier, and receive SOL in seconds &mdash; right from your dashboard. Prefer chat? The Telegram bot does the same job. No counterparty risk, no middlemen.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-7 py-3.5 text-base font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
              Open the dashboard
            </Link>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--hairline-strong)] px-5 py-3 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
              </svg>
              Or use Telegram
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              See how it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            </a>
          </div>
        </div>

        {/* ── Key numbers ── */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Approved tokens", value: `${tokenCount}+`, sub: undefined as string | undefined },
            // Origination fee range derived from live tier data (after mig 056
            // the RWA / memecoin ranges collapsed to the same band). When the
            // v3 routing flip diverges them again, the math here picks it up.
            {
              label: "Origination fee",
              value: (() => {
                const fees = [...meme, ...rwa].map((t) => t.fee).filter((f) => f > 0);
                if (fees.length === 0) return "—";
                const lo = (Math.min(...fees) * 100).toFixed(1);
                const hi = (Math.max(...fees) * 100).toFixed(0);
                return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
              })(),
              sub: undefined,
            },
            { label: "Max LTV", value: maxLtvLabel, sub: maxLtvSubLabel },
            { label: "Longest term", value: `${maxTermDays}d`, sub: undefined },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-4 text-center">
              <div className="font-display text-2xl font-semibold text-[var(--ink)]">{s.value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">{s.label}</div>
              {s.sub ? (
                <div className="text-[10px] text-[var(--ink-faint)]">{s.sub}</div>
              ) : null}
            </div>
          ))}
        </div>

        {/* ── Loan Tiers (LTV explanation) ── */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            Pick your loan tier
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            LTV (Loan-to-Value) is the percentage of your collateral&apos;s value that you can borrow. Higher LTV means more SOL, but less room before liquidation.
          </p>

          <h3 className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            {unifiedLadders
              ? "Three loan tiers (all collateral types)"
              : "Memecoin collateral"}
          </h3>
          <div className="mt-3 grid gap-5 md:grid-cols-3">
            {meme.map((t, i) => (
              <TierCard key={t.name} tier={t} index={i} />
            ))}
          </div>

          {showRwaSection ? (
            <>
              <div className="mt-12 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Tokenized stocks · ETFs · metals
                </h3>
                <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-deep)]">
                  Higher LTV · longer terms
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
                Real-world assets carry meaningfully lower volatility than memecoins, so we&apos;re comfortable lending more against them — up to {Math.round(maxRwaLtv * 100)}% LTV.
              </p>
              <div className="mt-3 grid gap-5 md:grid-cols-3">
                {rwa.map((t, i) => (
                  <TierCard key={t.name} tier={t} variant="rwa" index={i} />
                ))}
              </div>
            </>
          ) : null}

          {/* When ladders are still unified, surface what's coming with v3
              so xStock holders know the higher-LTV pitch is real, not vapor. */}
          {unifiedLadders && hasRwa ? (
            <div className="mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--accent-dim)]/30 p-6">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-ink,#0a0a0a)]">
                  Coming with v3
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Higher-LTV tier for tokenized stocks / ETFs / metals
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                When the v3 program goes live (deployed today, currently funding-only), a separate ladder unlocks for RWA collateral:
                {" "}<strong>50% LTV @ 7 days</strong>, <strong>60% @ 15 days</strong>, <strong>70% @ 30 days</strong>{" "}
                with origination fees 2.5–5%. Until then, all collateral classes share the same tier ladder shown above.
              </p>
            </div>
          ) : null}

          {/* LTV explainer */}
          <div className="mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
            <h4 className="font-semibold text-[var(--ink)]">What happens if my collateral drops?</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              If the value of your collateral falls below <strong>1.1x</strong> the loan amount (the health ratio),
              your position is at risk of liquidation. You can avoid this by topping up collateral, making a partial
              repayment, or extending your loan (fee per extension matches your tier rate). The lower your LTV tier, the more buffer
              you have before liquidation.
            </p>
          </div>
        </section>

        {/* ── Calculator ── */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            Estimate your loan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            See exactly what you&apos;ll receive before opening the bot.
          </p>
          <div className="mt-8 mx-auto max-w-lg">
            <LoanCalculator memeTiers={meme} rwaTiers={rwa} hasRwa={hasRwa} />
          </div>
        </section>

        {/* ── How to borrow ── */}
        <section id="how" className="mt-20 scroll-mt-24">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            How to request a loan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            Five steps, under a minute. Run it all from the dashboard &mdash; or use the Telegram bot if you prefer chat. Same on-chain program either way.
          </p>

          <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Left: steps */}
            <div className="relative">
              <div className="absolute left-5 top-0 hidden h-full w-px bg-[var(--hairline)] sm:block" />

              <div className="flex flex-col gap-6 sm:gap-0">
                {STEPS.map((step) => (
                  <div key={step.num} className="relative flex gap-4 sm:gap-6 sm:pb-10">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-ink,#0a0a0a)]">
                      {step.num}
                    </div>
                    <div className="flex-1 pb-2">
                      <h3 className="font-semibold text-[var(--ink)]">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{step.desc}</p>
                      {step.cmd && (
                        <code className="mt-2 inline-block rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-mono text-[var(--accent-deep)]">
                          {step.cmd}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Telegram phone mockup */}
            <div className="hidden lg:block lg:sticky lg:top-28">
              <PhoneMock />
            </div>
          </div>

          {/* Mobile: show phone mockup below steps */}
          <div className="mt-10 lg:hidden">
            <PhoneMock />
          </div>
        </section>

        {/* ── Credit Score ── */}
        <section className="mt-20">
          <div className="rounded-3xl border border-[var(--accent)]/25 bg-[var(--accent-dim)]/30 p-8 sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
              <div className="flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
                  Better credit = better terms
                </div>
                <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--ink)]">
                  Magpie Credit Score
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                  Every borrower starts at 500. On-time repayments increase your score; liquidations lower it.
                  Higher scores unlock better LTV, lower fees, and longer terms. Your score is tied to your
                  wallet and builds over time.
                </p>
                <div className="mt-4 text-sm text-[var(--ink-soft)]">
                  <strong className="text-[var(--ink)]">Score factors:</strong> Repayment history (40%), Loan volume (20%),
                  Account age (15%), Collateral diversity (15%), Liquidation history (10%)
                </div>
                <div className="mt-5">
                  <Link
                    href="/credit"
                    className="text-sm font-medium text-[var(--accent-deep)] hover:underline underline-offset-2"
                  >
                    Full credit score breakdown &rarr;
                  </Link>
                </div>
              </div>

              {/* Tier table */}
              <div className="w-full lg:w-auto">
                <div className="overflow-hidden rounded-xl border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Tier</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Score</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">LTV</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Fee</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CREDIT_TIERS.map((t) => (
                        <tr key={t.name} className="border-t border-[var(--hairline)]">
                          <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{t.name}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.range}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.ltv}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.fee}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.term}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Approved tokens callout ── */}
        <section className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{tokenCount} approved tokens</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              FARTCOIN, WIF, BONK, POPCAT, PENGU, and dozens more. Each token is risk-assessed in real time by our AI engine.
            </p>
          </div>
          <Link
            href="/tokens"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--hairline)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface)]"
          >
            View all tokens
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Ready to borrow?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--ink-soft)]">
            Connect your wallet on the dashboard &mdash; or chat with Pip / the Telegram bot if you&rsquo;d rather not click. SOL in your wallet in under a minute. Your memecoins or tokenized stocks stay on-chain as collateral until you repay.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-8 py-3.5 text-base font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
            >
              Open the dashboard
              <span aria-hidden>→</span>
            </Link>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-6 py-3.5 text-base font-semibold text-[var(--ink-soft)] transition hover:border-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
              </svg>
              Or use Telegram
            </a>
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs text-[var(--ink-faint)]">
            <Link href="/docs" className="hover:text-[var(--ink-soft)]">API Docs</Link>
            <span>&middot;</span>
            <Link href="/security" className="hover:text-[var(--ink-soft)]">Security</Link>
            <span>&middot;</span>
            <Link href="/whitepaper" className="hover:text-[var(--ink-soft)]">Whitepaper</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
