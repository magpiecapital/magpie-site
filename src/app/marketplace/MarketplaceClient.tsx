"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

const RWA_DESCRIPTIONS: Record<string, { tag: string; desc: string }> = {
  "RWA Express":  { tag: "Quick week",   desc: "7-day loan at 50% LTV. Best when you need capital fast and plan to repay within a week." },
  "RWA Quick":    { tag: "Balanced",     desc: "15-day loan at 60% LTV. The sweet spot — more cash, more time." },
  "RWA Standard": { tag: "Most SOL",     desc: "30-day loan at 70% LTV — our highest. Maximum capital, full month to repay." },
};

function adaptTier(t: LoanTier, descs: Record<string, { tag: string; desc: string }>, fallbackName: string): UiTier {
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
  return (fee * 100).toFixed(fee < 0.02 ? 1 : 0);
}

/* ───────────────────────── TOKEN CHIPS ─────────────────────────
 *
 * Marquee-style row of real approved-token tickers. Decorative — the
 * canonical list lives at /tokens. The point is to put recognizable
 * names in front of the user inside the first second of scanning
 * the page, so the asset class is unmistakable.
 */
interface TokenChip {
  symbol: string;
  name: string;
  mint: string;
}

function ChipMarquee({ chips, accent }: { chips: TokenChip[]; accent: "amber" | "slate" }) {
  // Render the chip list twice end-to-end and translate -50% over a long
  // duration — gives a seamless infinite-scroll feel. Falls back to a
  // static row if the chip list is empty (e.g. bot API down).
  if (chips.length === 0) return null;
  const palette = accent === "amber"
    ? {
        bg: "color-mix(in srgb, var(--accent-dim) 50%, transparent)",
        border: "color-mix(in srgb, var(--accent) 35%, transparent)",
        text: "var(--ink)",
        dotBg: "var(--accent)",
        dotInk: "var(--accent-ink, #0a0a0a)",
      }
    : {
        bg: "color-mix(in srgb, var(--surface-strong) 50%, transparent)",
        border: "color-mix(in srgb, var(--accent-deep) 35%, transparent)",
        text: "var(--ink)",
        dotBg: "var(--accent-deep)",
        dotInk: "#fff",
      };
  return (
    <div className="relative overflow-hidden" aria-hidden="true">
      <div className="flex animate-marquee gap-2 whitespace-nowrap py-1">
        {[...chips, ...chips].map((c, i) => (
          <span
            key={`${c.mint}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
            style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text }}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
              style={{ background: palette.dotBg, color: palette.dotInk }}
            >
              {c.symbol.replace(/x$/i, "").slice(0, 2).toUpperCase()}
            </span>
            {c.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── DUAL-CLASS HERO PANELS ───────────────────────── */

interface ClassPanelProps {
  variant: "memecoin" | "rwa";
  tokenCountInClass: number;
  topLtv: number;
  topDays: number;
  feeRange: string;
  samples: TokenChip[];
}

function ClassPanel({ variant, tokenCountInClass, topLtv, topDays, feeRange, samples }: ClassPanelProps) {
  const isMeme = variant === "memecoin";
  const styles = isMeme
    ? {
        // Memecoin: warm, energetic, brand-amber treatment
        bg: "linear-gradient(155deg, var(--accent-dim) 0%, var(--bg-elevated) 70%)",
        ring: "var(--accent)",
        ringSoft: "color-mix(in srgb, var(--accent) 35%, transparent)",
        eyebrow: "var(--accent-deep)",
        headline: "var(--ink)",
        ctaBg: "var(--accent)",
        ctaFg: "var(--accent-ink, #0a0a0a)",
        ctaHover: "var(--accent-hover)",
        badgeBg: "var(--accent)",
        badgeFg: "var(--accent-ink, #0a0a0a)",
      }
    : {
        // Tokenized stocks: cooler, professional, accent-deep treatment
        bg: "linear-gradient(155deg, var(--surface-strong) 0%, var(--bg-elevated) 70%)",
        ring: "var(--accent-deep)",
        ringSoft: "color-mix(in srgb, var(--accent-deep) 35%, transparent)",
        eyebrow: "var(--accent-deep)",
        headline: "var(--ink)",
        ctaBg: "var(--ink)",
        ctaFg: "var(--bg-elevated)",
        ctaHover: "var(--ink-soft)",
        badgeBg: "var(--accent-deep)",
        badgeFg: "#fff",
      };
  const heading = isMeme ? "MEMECOINS" : "TOKENIZED STOCKS";
  const subheading = isMeme
    ? "Borrow SOL against your bags — without selling."
    : "Borrow SOL against AAPL, NVDA, TSLA, COIN, MSTR and more.";
  const dashboardLink = isMeme ? "/dashboard?category=memecoin" : "/dashboard?category=stock";
  const explorerLink = isMeme ? "/tokens?category=memecoin" : "/tokens?category=stock";
  const eyebrow = isMeme ? "Crypto-native lending" : "Real-world assets · V3 live";
  const supportingLine = isMeme
    ? `${tokenCountInClass}+ approved memecoins. Live USD price, instant SOL payout, on-chain credit score.`
    : `${tokenCountInClass} tokenized equities, ETFs and metals (xStocks). New V3 program — highest LTVs in the protocol.`;
  return (
    <div
      className="group relative overflow-hidden rounded-3xl p-7 sm:p-8 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.ringSoft}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 14px 40px -22px rgba(0,0,0,0.25)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: styles.ringSoft, opacity: 0.5 }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ background: styles.badgeBg, color: styles.badgeFg }}
          >
            {eyebrow}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: styles.eyebrow }}>
            up to <span className="font-bold">{Math.round(topLtv * 100)}% LTV</span>
          </span>
        </div>

        <h2
          className="mt-5 font-display font-bold tracking-tight"
          style={{
            color: styles.headline,
            fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
          }}
        >
          {heading}
        </h2>
        <p className="mt-3 text-lg font-medium" style={{ color: "var(--ink-soft)" }}>
          {subheading}
        </p>

        {/* Marquee row of real ticker chips — the at-a-glance proof
            that the class has the names users actually hold. */}
        <div className="mt-5">
          <ChipMarquee chips={samples} accent={isMeme ? "amber" : "slate"} />
        </div>

        {/* Stat highlights — what the user gets at the top end of the ladder. */}
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            { k: "Max LTV", v: `${Math.round(topLtv * 100)}%` },
            { k: "Longest term", v: `${topDays}d` },
            { k: "Fee range", v: feeRange },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", border: "1px solid var(--hairline)" }}
            >
              <div className="font-display text-xl font-bold" style={{ color: styles.headline }}>
                {s.v}
              </div>
              <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-faint)" }}>
                {s.k}
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-sm" style={{ color: "var(--ink-soft)" }}>{supportingLine}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={dashboardLink}
            className="inline-flex flex-1 items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold transition"
            style={{ background: styles.ctaBg, color: styles.ctaFg }}
            onMouseEnter={(e) => (e.currentTarget.style.background = styles.ctaHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = styles.ctaBg)}
          >
            <span>{isMeme ? "Borrow against memecoins" : "Borrow against stocks"}</span>
            <span aria-hidden className="text-base transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href={explorerLink}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition"
            style={{ border: `1px solid ${styles.ringSoft}`, color: "var(--ink-soft)" }}
          >
            See all {tokenCountInClass}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── CREDIT TIERS ───────────────────────── */

const CREDIT_TIERS = [
  { name: "Bronze", range: "300–499", ltv: "20–30%", fee: "1.5–3%", term: "7 days" },
  { name: "Silver", range: "500–649", ltv: "22–32%", fee: "1.5–3%", term: "7 days" },
  { name: "Gold", range: "650–749", ltv: "25–35%", fee: "1.25–2.75%", term: "14 days" },
  { name: "Platinum", range: "750–850", ltv: "28–38%", fee: "1.0–2.5%", term: "30 days" },
];

/* ───────────────────────── TIER CARD ───────────────────────── */

function TierCard({ tier: t, variant, index = 0 }: { tier: UiTier; variant?: "rwa"; index?: number }) {
  const isRwa = variant === "rwa";
  const accentColor = isRwa ? "var(--accent-deep)" : "var(--accent)";
  const category = isRwa ? "stock" : "memecoin";
  const href = `/dashboard?category=${category}&tier=${index}`;
  const classLabel = isRwa ? "STOCK · ETF · METAL" : "MEMECOIN";
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border bg-[var(--bg)] p-6 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
      style={{ borderColor: "var(--hairline)" }}
    >
      {/* Strong colored band along the top — instantly tells the user
          which class the tier belongs to even after they've scrolled
          past the panel headings. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: accentColor }}
      />
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{
            background: isRwa ? "color-mix(in srgb, var(--accent-deep) 18%, transparent)" : "var(--accent-dim)",
            color: isRwa ? "var(--accent-deep)" : "var(--accent-deep)",
          }}
        >
          {classLabel}
        </span>
        <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-deep)]">
          {t.tag}
        </span>
      </div>
      <h3 className="mt-3 font-display text-2xl font-bold text-[var(--ink)]">{t.name}</h3>
      {t.desc ? <p className="mt-2 text-sm text-[var(--ink-soft)]">{t.desc}</p> : null}

      <div className="mt-5 flex gap-4">
        <div>
          <div className="font-display text-4xl font-bold text-[var(--ink)]">{Math.round(t.ltv * 100)}%</div>
          <div className="text-xs text-[var(--ink-faint)]">LTV</div>
        </div>
        <div className="border-l border-[var(--hairline)] pl-4">
          <div className="font-display text-4xl font-bold text-[var(--ink)]">{t.days}</div>
          <div className="text-xs text-[var(--ink-faint)]">days</div>
        </div>
        <div className="border-l border-[var(--hairline)] pl-4">
          <div className="font-display text-4xl font-bold text-[var(--ink)]">{fmtFeePct(t.fee)}%</div>
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
            style={{ width: `${t.ltv * 100}%`, background: accentColor }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm font-semibold" style={{ color: accentColor }}>
        <span className="opacity-90 transition group-hover:opacity-100 group-focus-visible:opacity-100">
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

function laddersIdentical(a: UiTier[], b: UiTier[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return a.every((m, i) => {
    const r = b[i];
    return r.ltv === m.ltv && r.days === m.days && r.fee === m.fee;
  });
}

function LoanCalculator({ memeTiers, rwaTiers, hasRwa }: LoanCalculatorProps) {
  const [collateralValue, setCollateralValue] = useState(1000);
  const [selectedTier, setSelectedTier] = useState(0);
  const [category, setCategory] = useState<"memecoin" | "rwa">("memecoin");
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
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Pick a class, drag the slider, see your payout.</p>

      {/* Class toggle — visible whenever both classes are available, even
          if the ladders match. With V3 RWA live (50/60/70%) and memecoin
          (30/25/20%), the two ladders are now distinct. */}
      {hasRwa && (
        <div className="mt-5 inline-flex rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-1 text-xs">
          {(["memecoin", "rwa"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setSelectedTier(0);
              }}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                category === c
                  ? c === "rwa"
                    ? "bg-[color-mix(in_srgb,var(--accent-deep)_18%,transparent)] text-[var(--accent-deep)]"
                    : "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {c === "memecoin" ? "Memecoins" : "Tokenized stocks"}
            </button>
          ))}
        </div>
      )}
      {/* Subtle assist when unifiedLadders happens to be true — keeps the
          UI honest without removing the toggle (operator may diverge them). */}
      {hasRwa && unifiedLadders && (
        <p className="mt-2 text-[11px] text-[var(--ink-faint)]">
          Both classes share the same ladder right now — toggle is for context.
        </p>
      )}

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
            <div className="font-semibold">{t.name.replace(/^RWA\s+/, "")}</div>
            <div className="text-[11px] text-[var(--ink-faint)]">{Math.round(t.ltv * 100)}% &middot; {t.days}d</div>
          </button>
        ))}
      </div>

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

/* ───────────────────────── HOW TO BORROW ───────────────────────── */

function buildSteps(tokenCount: number) {
  return [
    {
      num: "1",
      title: "Open the dashboard",
      desc: "Go to magpie.capital/dashboard and connect your wallet — or ask Pip (the chat helper) to start a loan for you.",
    },
    {
      num: "2",
      title: "Pick your collateral",
      desc: `Your dashboard shows every supported holding in your wallet — pick from ${tokenCount} approved tokens. Live USD price, tier-aware caps, exact SOL you'll receive.`,
    },
    {
      num: "3",
      title: "Select a loan tier",
      desc: `Memecoins: 30/25/20% LTV across 2/3/7-day terms. Tokenized stocks: 50/60/70% LTV across 7/15/30-day terms. The dashboard shows your exact payout before you confirm.`,
    },
    {
      num: "4",
      title: "Sign and receive SOL",
      desc: `Approve the transaction in your wallet. SOL lands in seconds. A small origination fee is deducted upfront.`,
    },
    {
      num: "5",
      title: "Repay and get your tokens back",
      desc: "Repay from the dashboard before the term ends. Your collateral is returned the same instant. On-time repayment builds your on-chain credit score and unlocks better tiers next time.",
    },
  ];
}

/* ───────────────────────── MAIN PAGE ───────────────────────── */

interface MarketplaceClientProps {
  tokenCount: number;
  stockCount: number;
  memeTiers: LoanTier[];
  rwaTiers: LoanTier[];
  memeSamples: TokenChip[];
  rwaSamples: TokenChip[];
}

export function MarketplaceClient({
  tokenCount,
  stockCount,
  memeTiers,
  rwaTiers,
  memeSamples,
  rwaSamples,
}: MarketplaceClientProps) {
  const meme = useMemo(
    () => memeTiers.map((t, i) => adaptTier(t, MEME_DESCRIPTIONS, ["Express", "Quick", "Standard"][i] || `Tier ${i + 1}`)),
    [memeTiers],
  );
  const rwa = useMemo(
    () => rwaTiers.map((t, i) => adaptTier(t, RWA_DESCRIPTIONS, ["RWA Express", "RWA Quick", "RWA Standard"][i] || `RWA Tier ${i + 1}`)),
    [rwaTiers],
  );

  const hasRwa = stockCount > 0 && rwa.length > 0;
  const memeCount = Math.max(tokenCount - stockCount, 0);

  const maxMemeLtv = meme.length ? Math.max(...meme.map((t) => t.ltv)) : 0;
  const maxRwaLtv = hasRwa ? Math.max(...rwa.map((t) => t.ltv)) : 0;
  const maxMemeDays = meme.length ? Math.max(...meme.map((t) => t.days)) : 0;
  const maxRwaDays = hasRwa ? Math.max(...rwa.map((t) => t.days)) : 0;

  const memeFees = meme.map((t) => t.fee).filter((f) => f > 0);
  const memeFeeRange = memeFees.length
    ? `${(Math.min(...memeFees) * 100).toFixed(1)}–${(Math.max(...memeFees) * 100).toFixed(0)}%`
    : "—";
  const rwaFees = rwa.map((t) => t.fee).filter((f) => f > 0);
  const rwaFeeRange = rwaFees.length
    ? `${(Math.min(...rwaFees) * 100).toFixed(1)}–${(Math.max(...rwaFees) * 100).toFixed(0)}%`
    : "—";

  const STEPS = buildSteps(tokenCount);

  // Scroll-to-tier helper (Class panels' inline link lands on the tier ladder)
  const memeTiersRef = useRef<HTMLDivElement | null>(null);
  const rwaTiersRef = useRef<HTMLDivElement | null>(null);
  // Hash-based scroll (deep-linkable from header/nav)
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash === "#memecoins") memeTiersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (hash === "#stocks") rwaTiersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        {/* ── Hero (compact) ── */}
        <div className="text-center">
          <div className="inline-block rounded-full bg-[var(--accent-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
            Two asset classes · one click to borrow
          </div>
          <h1 className="mt-4 font-display font-bold tracking-tight text-[var(--ink)]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)", lineHeight: 1.02, letterSpacing: "-0.025em" }}>
            Borrow SOL. <br className="hidden sm:block" />
            Keep your bags <span style={{ color: "var(--accent-deep)" }}>and</span> your stocks.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--ink-soft)]">
            Pick what you hold. Magpie deposits SOL into your wallet in seconds. No counterparty risk. No middlemen. No selling.
          </p>
        </div>

        {/* ── THE BIG DECISION: dual-class panels ── */}
        <section
          aria-label="Choose your collateral class"
          className="mt-12 grid gap-6 lg:grid-cols-2"
        >
          <ClassPanel
            variant="memecoin"
            tokenCountInClass={memeCount}
            topLtv={maxMemeLtv}
            topDays={maxMemeDays}
            feeRange={memeFeeRange}
            samples={memeSamples}
          />
          {hasRwa ? (
            <ClassPanel
              variant="rwa"
              tokenCountInClass={stockCount}
              topLtv={maxRwaLtv}
              topDays={maxRwaDays}
              feeRange={rwaFeeRange}
              samples={rwaSamples}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface)] p-8 text-center">
              <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                Tokenized stocks · coming live
              </span>
              <p className="mt-4 text-sm text-[var(--ink-soft)]">
                xStocks (NVDAx, COINx, MSTRx, TSLAx and more) enable when V3 routing flips for your wallet.
              </p>
            </div>
          )}
        </section>

        {/* ── Telegram-handoff strip ── */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] px-5 py-4 sm:flex-row">
          <p className="text-sm text-[var(--ink-soft)]">
            Prefer chat? Same protocol, same tiers — via Telegram.
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
            </svg>
            Open @magpie_capital_bot
          </a>
        </div>

        {/* ── Key numbers ── */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Approved tokens", value: `${tokenCount}+` },
            { label: "Origination fee", value: (() => {
                const fees = [...meme, ...rwa].map((t) => t.fee).filter((f) => f > 0);
                if (fees.length === 0) return "—";
                const lo = (Math.min(...fees) * 100).toFixed(1);
                const hi = (Math.max(...fees) * 100).toFixed(0);
                return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
              })(),
            },
            { label: "Max LTV", value: hasRwa ? `${Math.round(maxRwaLtv * 100)}%` : `${Math.round(maxMemeLtv * 100)}%`, sub: hasRwa ? "tokenized stocks (V3)" : undefined },
            { label: "Longest term", value: `${Math.max(maxMemeDays, maxRwaDays)}d` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-4 text-center">
              <div className="font-display text-2xl font-semibold text-[var(--ink)]">{s.value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">{s.label}</div>
              {(s as { sub?: string }).sub ? (
                <div className="text-[10px] text-[var(--ink-faint)]">{(s as { sub?: string }).sub}</div>
              ) : null}
            </div>
          ))}
        </div>

        {/* ── Memecoin tier ladder ── */}
        <section id="memecoins" ref={memeTiersRef} className="mt-20 scroll-mt-24">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--hairline)] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--accent-deep)" }}>
                Memecoin loans
              </div>
              <h2 className="mt-1 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                Three tiers. Two-to-seven days. 30% max LTV.
              </h2>
            </div>
            <Link href="/dashboard?category=memecoin" className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover)]">
              Start now <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
            Borrow against {memeCount}+ approved memecoins. Higher volatility caps LTV — shorter terms keep you safe.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {meme.map((t, i) => (
              <TierCard key={t.name} tier={t} index={i} />
            ))}
          </div>
        </section>

        {/* ── RWA tier ladder ── */}
        {hasRwa ? (
          <section id="stocks" ref={rwaTiersRef} className="mt-20 scroll-mt-24">
            <div className="flex items-end justify-between gap-4 border-b border-[var(--hairline)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--accent-deep)" }}>
                    Tokenized stocks · ETFs · metals
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: "var(--accent-deep)", color: "#fff" }}>
                    V3 · highest LTV
                  </span>
                </div>
                <h2 className="mt-1 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                  Up to 70% LTV. 30-day terms. Stocks you already hold.
                </h2>
              </div>
              <Link href="/dashboard?category=stock" className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--bg-elevated)] transition hover:bg-[var(--ink-soft)]">
                Start now <span aria-hidden>→</span>
              </Link>
            </div>
            <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
              Real-world assets carry meaningfully lower volatility, so V3 lends more against them — and for longer.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {rwa.map((t, i) => (
                <TierCard key={t.name} tier={t} variant="rwa" index={i} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── LTV explainer ── */}
        <section className="mt-12 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-7">
          <h4 className="font-display text-lg font-bold text-[var(--ink)]">What happens if my collateral drops?</h4>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            If the value of your collateral falls below <strong>1.1x</strong> the loan amount (the health ratio),
            your position is at risk of liquidation. You can avoid this by topping up collateral, making a partial
            repayment, or extending your loan (fee per extension matches your tier rate). The lower your LTV tier, the more buffer
            you have before liquidation.
          </p>
        </section>

        {/* ── Calculator ── */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            Estimate your loan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            See exactly what you&apos;ll receive before opening the dashboard.
          </p>
          <div className="mt-8 mx-auto max-w-lg">
            <LoanCalculator memeTiers={meme} rwaTiers={rwa} hasRwa={hasRwa} />
          </div>
        </section>

        {/* ── How to borrow ── */}
        <section id="how" className="mt-20 scroll-mt-24">
          <h2 className="text-center font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            Five steps. Under a minute.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            Same on-chain program whether you borrow from the dashboard, Telegram, or Pip.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step) => (
              <li key={step.num} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[var(--accent-ink,#0a0a0a)]">
                  {step.num}
                </div>
                <h3 className="mt-3 font-display font-bold text-[var(--ink)]">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Credit Score ── */}
        <section className="mt-20">
          <div className="rounded-3xl border border-[var(--accent)]/25 bg-[var(--accent-dim)]/30 p-8 sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
              <div className="flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
                  Better credit = better terms
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-[var(--ink)]">
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
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">{tokenCount} approved tokens across both classes</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Memecoins (BONK, WIF, FARTCOIN, POPCAT, PENGU and more) + tokenized stocks (NVDAx, COINx, MSTRx, TSLAx, HOODx) + ETFs + metals. Each token is risk-assessed in real time.
            </p>
          </div>
          <Link
            href="/tokens"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--hairline)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface)]"
          >
            Browse the full list
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-20 text-center">
          <h2 className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
            Ready to borrow?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--ink-soft)]">
            Connect your wallet on the dashboard — or chat with Pip / Telegram if you&rsquo;d rather not click. SOL in your wallet in under a minute.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-8 py-3.5 text-base font-bold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
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
