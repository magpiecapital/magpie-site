"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const PREFS_KEY = "magpie-dashboard-prefs";

/* ───────────────────────── MOCK DATA ───────────────────────── */

const MOCK_WALLET = "5fh2K8...xP3q8Qz1";
const MOCK_SOL_BALANCE = 24.83;
const MOCK_SOL_PRICE_USD = 162;

const MOCK_CREDIT = {
  score: 720,
  tier: "Gold" as const,
  change: +15,
  nextTier: 750,
  factors: {
    repaymentHistory: 92,
    loanVolume: 78,
    accountAge: 65,
    diversity: 80,
    liquidations: 95,
  },
};

const MOCK_POINTS = {
  total: 47_832,
  rank: 4,
  streak: 6,
  thisWeek: 3_240,
  pendingRedemptions: 0,
  recentEarnings: [
    { date: "Apr 17", amount: 1_850, reason: "WIF Express repaid (early)" },
    { date: "Apr 15", amount: 1_390, reason: "BONK Quick repaid" },
    { date: "Apr 12", amount: 0, reason: "POPCAT loan liquidated" },
    { date: "Apr 10", amount: 2_100, reason: "FARTCOIN Express repaid (early)" },
    { date: "Apr 8", amount: 980, reason: "WIF Standard repaid" },
  ],
};

const MOCK_ACTIVE_LOANS = [
  {
    id: "0xa1b2",
    token: "WIF",
    collateralAmount: "8,000",
    collateralUsd: 1760,
    borrowed: 3.25,
    owed: 3.3,
    ltv: 30,
    health: 78,
    daysLeft: 1.3,
    tier: "Express",
    startDate: "Apr 16",
    dueDate: "Apr 18",
    liqPrice: "$0.156",
  },
  {
    id: "0xc3d4",
    token: "BONK",
    collateralAmount: "40M",
    collateralUsd: 900,
    borrowed: 1.1,
    owed: 1.12,
    ltv: 20,
    health: 92,
    daysLeft: 5.1,
    tier: "Standard",
    startDate: "Apr 14",
    dueDate: "Apr 21",
    liqPrice: "$0.0000182",
  },
];

const MOCK_PAST_LOANS = [
  { id: "0xe5f6", token: "WIF", borrowed: 2.5, status: "repaid", date: "Apr 10", tier: "Express", pointsEarned: 2100 },
  { id: "0xg7h8", token: "FARTCOIN", borrowed: 1.8, status: "repaid", date: "Apr 8", tier: "Quick", pointsEarned: 1390 },
  { id: "0xi9j0", token: "POPCAT", borrowed: 0.9, status: "liquidated", date: "Apr 5", tier: "Express", pointsEarned: 0 },
  { id: "0xk1l2", token: "BONK", borrowed: 3.1, status: "repaid", date: "Apr 1", tier: "Standard", pointsEarned: 980 },
  { id: "0xm3n4", token: "WIF", borrowed: 1.5, status: "repaid", date: "Mar 28", tier: "Quick", pointsEarned: 1200 },
  { id: "0xo5p6", token: "GOAT", borrowed: 2.0, status: "repaid", date: "Mar 25", tier: "Express", pointsEarned: 1650 },
];

const MOCK_HOLDINGS = [
  { symbol: "WIF", name: "dogwifhat", amount: "14,200", usd: 3120, change24h: -2.3, eligible: true },
  { symbol: "BONK", name: "Bonk", amount: "82.1M", usd: 1840, change24h: 5.1, eligible: true },
  { symbol: "POPCAT", name: "Popcat", amount: "3,400", usd: 980, change24h: -0.8, eligible: true },
  { symbol: "FARTCOIN", name: "Fartcoin", amount: "12,000", usd: 650, change24h: 12.4, eligible: true },
  { symbol: "MEW", name: "cat in a dogs world", amount: "210,000", usd: 420, change24h: -1.2, eligible: false },
];

const MOCK_ACTIVITY = [
  { type: "repay", text: "Repaid 2.5 SOL \u2014 WIF collateral returned", time: "2h ago", points: "+2,100 pts" },
  { type: "health", text: "WIF loan #0xa1b2 health at 78%", time: "4h ago" },
  { type: "deposit", text: "12,000 FARTCOIN deposited", time: "1d ago" },
  { type: "borrow", text: "Borrowed 1.1 SOL against 40M BONK", time: "3d ago" },
  { type: "credit", text: "Credit score increased to 720 (+15)", time: "5d ago" },
  { type: "extend", text: "Extended WIF loan #0xe5f6 by 2 days", time: "1w ago" },
];

/* ───────────────────────── TYPES ───────────────────────── */

type SectionKey =
  | "credit"
  | "points"
  | "activeLoans"
  | "loanHistory"
  | "holdings"
  | "activity"
  | "quickActions";

type SectionPrefs = Record<SectionKey, boolean>;

const SECTION_LABELS: Record<SectionKey, string> = {
  credit: "Credit Score",
  points: "Points & Rewards",
  activeLoans: "Active Loans",
  loanHistory: "Loan History",
  holdings: "Holdings",
  activity: "Activity Feed",
  quickActions: "Quick Actions",
};

const DEFAULT_PREFS: SectionPrefs = {
  credit: true,
  points: true,
  activeLoans: true,
  loanHistory: true,
  holdings: true,
  activity: true,
  quickActions: true,
};

/* ───────────────────────── HELPERS ───────────────────────── */

function healthColor(h: number): string {
  if (h >= 75) return "var(--accent)";
  if (h >= 50) return "var(--warn)";
  return "var(--bad)";
}

function healthLabel(h: number): string {
  if (h >= 75) return "Healthy";
  if (h >= 50) return "Watch";
  return "At risk";
}

function activityIcon(type: string): string {
  switch (type) {
    case "repay": return "\u21A9";
    case "health": return "\u26A0";
    case "deposit": return "\u2B07";
    case "borrow": return "\u2B06";
    case "credit": return "\u2605";
    case "extend": return "\u21BB";
    default: return "\u2022";
  }
}

/* ───────────────────────── ANIMATED COUNTER ───────────────────────── */

function useAnimatedCounter(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ───────────────────────── CREDIT GAUGE ───────────────────────── */

function CreditGauge({ score, maxScore = 850 }: { score: number; maxScore?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [pathLength, setPathLength] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [score]);

  const fraction = animatedScore / maxScore;
  const dashOffset = pathLength - pathLength * fraction;

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 130" className="w-56 h-auto">
        {/* Background arc */}
        <path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Animated arc */}
        <path
          ref={pathRef}
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLength || 260,
            strokeDashoffset: pathLength ? dashOffset : 260,
            transition: "stroke-dashoffset 0.05s linear",
          }}
        />
      </svg>
      <div className="absolute top-12 flex flex-col items-center">
        <span className="font-display text-5xl font-bold tracking-tight tabular">{animatedScore}</span>
        <span
          className="mt-1 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          {MOCK_CREDIT.tier}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── FACTOR BAR ───────────────────────── */

function FactorBar({ label, value }: { label: string; value: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 100);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-[var(--ink-soft)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--hairline)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${width}%`,
            background: value >= 80 ? "var(--accent)" : value >= 60 ? "var(--warn)" : "var(--bad)",
          }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular">{value}%</span>
    </div>
  );
}

/* ───────────────────────── SECTION WRAPPER ───────────────────────── */

function Section({
  id,
  title,
  visible,
  onToggle,
  children,
}: {
  id: SectionKey;
  title: string;
  visible: boolean;
  onToggle: (id: SectionKey) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className="transition-all duration-500 ease-out overflow-hidden"
      style={{
        maxHeight: visible ? "3000px" : "0px",
        opacity: visible ? 1 : 0,
        marginTop: visible ? "3rem" : "0px",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium tracking-[-0.03em] md:text-3xl">{title}</h2>
        <button
          onClick={() => onToggle(id)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          title="Hide section"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Hide
        </button>
      </div>
      {children}
    </section>
  );
}

/* ───────────────────────── CUSTOMIZE PANEL ───────────────────────── */

function CustomizePanel({
  open,
  onClose,
  prefs,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  prefs: SectionPrefs;
  onToggle: (key: SectionKey) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-[70] h-full w-full max-w-sm transition-transform duration-300 ease-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div
          className="h-full border-l border-[var(--hairline)] p-8 flex flex-col"
          style={{
            background: "rgba(24,23,20,0.92)",
            backdropFilter: "blur(24px) saturate(1.4)",
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display text-xl font-medium">Customize Dashboard</h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--surface)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-[var(--ink-soft)] mb-6">Toggle dashboard sections on or off. Preferences are saved locally.</p>
          <div className="flex flex-col gap-1">
            {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
              <button
                key={key}
                onClick={() => onToggle(key)}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 transition hover:bg-[var(--surface)]"
              >
                <span className="text-sm font-medium">{SECTION_LABELS[key]}</span>
                {/* Toggle switch */}
                <div
                  className="relative h-6 w-11 rounded-full transition-colors duration-200"
                  style={{ background: prefs[key] ? "var(--accent)" : "var(--hairline-strong)" }}
                >
                  <div
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: prefs[key] ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-6 border-t border-[var(--hairline)]">
            <button
              onClick={() => {
                (Object.keys(SECTION_LABELS) as SectionKey[]).forEach((k) => {
                  if (!prefs[k]) onToggle(k);
                });
              }}
              className="w-full rounded-full border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--ink)] hover:bg-[var(--surface)]"
            >
              Show all sections
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── MAIN PAGE ───────────────────────── */

export default function DashboardPage() {
  const [copied, setCopied] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [prefs, setPrefs] = useState<SectionPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  // Load prefs from localStorage
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleSection = useCallback((key: SectionKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText("5fh2K8xP3q8Qz1").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Computed values
  const totalBorrowed = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.borrowed, 0);
  const totalOwed = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.owed, 0);
  const totalCollateralUsd = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.collateralUsd, 0);
  const holdingsUsd = MOCK_HOLDINGS.reduce((s, h) => s + h.usd, 0);
  const solUsd = MOCK_SOL_BALANCE * MOCK_SOL_PRICE_USD;
  const netWorth = solUsd + holdingsUsd - totalOwed * MOCK_SOL_PRICE_USD;

  const animatedPoints = useAnimatedCounter(mounted ? MOCK_POINTS.total : 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark size={28} />
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/tokens" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">Tokens</Link>
            <Link href="/calculate" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">Calculator</Link>
            <Link href="/credit" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">Credit</Link>
            <Link href="/points" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">Points</Link>
            <Link href="/stats" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">Stats</Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* ─── CUSTOMIZE PANEL ─── */}
      <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} prefs={prefs} onToggle={toggleSection} />

      <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        {/* ─── HERO AREA ─── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="chip">Dashboard</div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
              </span>
              <span className="font-mono text-sm text-[var(--ink-soft)]">{MOCK_WALLET}</span>
              <button
                onClick={handleCopy}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--surface)]"
                title="Copy address"
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-2 self-start rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--ink)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Customize
          </button>
        </div>

        {/* ─── SUMMARY ROW (always visible) ─── */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="SOL Balance" value={`${MOCK_SOL_BALANCE.toFixed(2)}`} sub={`$${Math.round(solUsd).toLocaleString()}`} />
          <SummaryCard label="Active Loans" value={`${MOCK_ACTIVE_LOANS.length}`} sub="In progress" />
          <SummaryCard label="Total Borrowed" value={`${totalBorrowed.toFixed(2)} SOL`} sub={`$${Math.round(totalBorrowed * MOCK_SOL_PRICE_USD).toLocaleString()}`} />
          <SummaryCard label="Total Owed" value={`${totalOwed.toFixed(2)} SOL`} sub={`$${Math.round(totalOwed * MOCK_SOL_PRICE_USD).toLocaleString()}`} />
          <SummaryCard label="Collateral Locked" value={`$${totalCollateralUsd.toLocaleString()}`} sub={`${MOCK_ACTIVE_LOANS.length} positions`} highlight />
          <SummaryCard label="Net Worth" value={`$${Math.round(netWorth).toLocaleString()}`} sub="SOL + Holdings - Owed" highlight />
        </div>

        {/* ─── CREDIT SCORE SECTION ─── */}
        <Section id="credit" title="Credit Score" visible={prefs.credit} onToggle={toggleSection}>
          <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:p-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Left: gauge */}
              <div className="flex flex-col items-center justify-center">
                <CreditGauge score={MOCK_CREDIT.score} />
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>+{MOCK_CREDIT.change}</span>
                  <span className="text-sm text-[var(--ink-soft)]">from last month</span>
                </div>
                {/* Next tier progress */}
                <div className="mt-4 w-full max-w-xs">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--ink-soft)]">Next: Platinum at {MOCK_CREDIT.nextTier}</span>
                    <span className="font-mono tabular">{MOCK_CREDIT.score}/{MOCK_CREDIT.nextTier}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--hairline)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(MOCK_CREDIT.score / MOCK_CREDIT.nextTier) * 100}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Right: factors */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)] mb-1">Score Factors</h4>
                <FactorBar label="Repayment History" value={MOCK_CREDIT.factors.repaymentHistory} />
                <FactorBar label="Loan Volume" value={MOCK_CREDIT.factors.loanVolume} />
                <FactorBar label="Account Age" value={MOCK_CREDIT.factors.accountAge} />
                <FactorBar label="Diversity" value={MOCK_CREDIT.factors.diversity} />
                <FactorBar label="Liquidations" value={MOCK_CREDIT.factors.liquidations} />
                <Link
                  href="/credit"
                  className="mt-2 self-start text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  View full credit report &rarr;
                </Link>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── POINTS & REWARDS SECTION ─── */}
        <Section id="points" title="Points & Rewards" visible={prefs.points} onToggle={toggleSection}>
          <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:p-8">
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <div>
                <div className="font-display text-4xl font-bold tabular tracking-tight">{animatedPoints.toLocaleString()}</div>
                <div className="text-xs text-[var(--ink-soft)] mt-0.5">Total points</div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                #{MOCK_POINTS.rank}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl">{MOCK_POINTS.streak}</span>
                <span className="text-sm text-[var(--ink-soft)]">day streak</span>
              </div>
              <div>
                <span className="font-mono text-sm font-semibold tabular" style={{ color: "var(--accent)" }}>+{MOCK_POINTS.thisWeek.toLocaleString()}</span>
                <span className="text-sm text-[var(--ink-soft)] ml-1">this week</span>
              </div>
            </div>
            {/* Recent earnings table */}
            <div className="overflow-hidden rounded-2xl border border-[var(--hairline)]">
              <div className="hidden md:grid grid-cols-12 gap-4 bg-[var(--surface)] px-5 py-3 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                <div className="col-span-2">Date</div>
                <div className="col-span-7">Reason</div>
                <div className="col-span-3 text-right">Points</div>
              </div>
              {MOCK_POINTS.recentEarnings.map((e, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-4 border-t border-[var(--hairline)] px-5 py-3.5 text-sm"
                  style={{ background: i % 2 === 0 ? "transparent" : "var(--surface)" }}
                >
                  <div className="col-span-4 md:col-span-2 font-mono text-xs text-[var(--ink-soft)]">{e.date}</div>
                  <div className="col-span-8 md:col-span-7 text-[var(--ink-soft)]">{e.reason}</div>
                  <div
                    className="col-span-12 md:col-span-3 text-right font-mono font-semibold tabular"
                    style={{ color: e.amount === 0 ? "var(--bad)" : "var(--accent)" }}
                  >
                    {e.amount === 0 ? "0" : `+${e.amount.toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/points" className="mt-4 inline-block text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline">
              Points calculator &rarr;
            </Link>
          </div>
        </Section>

        {/* ─── ACTIVE LOANS SECTION ─── */}
        <Section id="activeLoans" title="Active Loans" visible={prefs.activeLoans} onToggle={toggleSection}>
          {MOCK_ACTIVE_LOANS.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface)] p-14 text-center">
              <Mark size={48} className="mx-auto mb-5" />
              <div className="text-lg font-semibold">No active loans</div>
              <div className="mt-2 text-sm text-[var(--ink-soft)]">Pledge a bag in Telegram to get started.</div>
              <a href={TELEGRAM_URL} className="btn-accent mt-6 inline-block text-sm">Launch on Telegram &rarr;</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {MOCK_ACTIVE_LOANS.map((loan) => (
                <div
                  key={loan.id}
                  className="group relative overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-lg md:p-8"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-sm font-bold" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        {loan.token}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xl font-medium">{loan.token}</span>
                          <span className="chip">{loan.tier}</span>
                        </div>
                        <div className="font-mono text-xs text-[var(--ink-faint)]">{loan.id}</div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ background: healthColor(loan.health), color: "#fff" }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {healthLabel(loan.health)}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">Collateral</div>
                      <div className="mt-1 font-mono text-sm tabular">{loan.collateralAmount} {loan.token}</div>
                      <div className="text-xs text-[var(--ink-soft)]">${loan.collateralUsd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">Borrowed</div>
                      <div className="mt-1 font-mono text-sm tabular">{loan.borrowed} SOL</div>
                      <div className="text-xs text-[var(--ink-soft)]">Owed {loan.owed} SOL</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">Liq. Price</div>
                      <div className="mt-1 font-mono text-sm tabular" style={{ color: "var(--bad)" }}>{loan.liqPrice}</div>
                      <div className="text-xs text-[var(--ink-soft)]">LTV {loan.ltv}%</div>
                    </div>
                  </div>

                  {/* Health bar */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--ink-soft)]">Health</span>
                      <span className="font-mono font-semibold tabular">{loan.health}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--hairline)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${loan.health}%`,
                          background: `linear-gradient(90deg, var(--bad), var(--warn), var(--accent))`,
                          backgroundSize: "200% 100%",
                          backgroundPosition: `${100 - loan.health}% 0`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="text-[var(--ink-soft)]">
                      {loan.startDate} &rarr; <span className="font-semibold text-[var(--ink)]">{loan.dueDate}</span>
                    </div>
                    <div>
                      Due in <span className="font-mono font-semibold tabular" style={{ color: loan.daysLeft <= 2 ? "var(--warn)" : "var(--ink)" }}>{loan.daysLeft.toFixed(1)}d</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {["Repay", "Top-up", "Partial", "Extend"].map((label) => (
                      <a
                        key={label}
                        href={TELEGRAM_URL}
                        className="rounded-full border border-[var(--hairline-strong)] bg-[var(--bg)] px-3 py-2 text-center text-xs font-semibold transition hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ─── LOAN HISTORY SECTION ─── */}
        <Section id="loanHistory" title="Loan History" visible={prefs.loanHistory} onToggle={toggleSection}>
          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            <div className="hidden md:grid grid-cols-12 gap-4 border-b border-[var(--hairline)] bg-[var(--surface)] px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Loan ID</div>
              <div className="col-span-2">Token</div>
              <div className="col-span-2">Borrowed</div>
              <div className="col-span-1">Tier</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2 text-right">Points</div>
            </div>
            {MOCK_PAST_LOANS.map((loan, i) => (
              <div
                key={loan.id}
                className="grid grid-cols-12 items-center gap-4 border-b border-[var(--hairline)] px-6 py-4 text-sm transition last:border-0 hover:bg-[var(--surface)]/50"
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(31,28,24,0.3)" }}
              >
                <div className="col-span-2 md:col-span-1">
                  {loan.status === "repaid" ? (
                    <span style={{ color: "var(--accent)" }} title="Repaid">{"\u2713"}</span>
                  ) : (
                    <span style={{ color: "var(--bad)" }} title="Liquidated">{"\u2717"}</span>
                  )}
                </div>
                <div className="col-span-4 md:col-span-2 font-mono text-xs text-[var(--ink-soft)]">{loan.id}</div>
                <div className="col-span-6 md:col-span-2 font-semibold">{loan.token}</div>
                <div className="col-span-4 md:col-span-2 font-mono tabular">{loan.borrowed} SOL</div>
                <div className="col-span-4 md:col-span-1">
                  <span className="chip text-[10px]">{loan.tier}</span>
                </div>
                <div className="col-span-4 md:col-span-2 text-[var(--ink-soft)]">{loan.date}</div>
                <div
                  className="col-span-12 md:col-span-2 text-right font-mono font-semibold tabular"
                  style={{ color: loan.pointsEarned === 0 ? "var(--bad)" : "var(--accent)" }}
                >
                  {loan.pointsEarned === 0 ? "0 pts" : `+${loan.pointsEarned.toLocaleString()} pts`}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── HOLDINGS SECTION ─── */}
        <Section id="holdings" title="Holdings" visible={prefs.holdings} onToggle={toggleSection}>
          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            <div className="hidden md:grid grid-cols-12 gap-4 border-b border-[var(--hairline)] bg-[var(--surface)] px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
              <div className="col-span-3">Token</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Value</div>
              <div className="col-span-2">24h</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {MOCK_HOLDINGS.map((h) => (
              <div
                key={h.symbol}
                className="grid grid-cols-12 items-center gap-4 border-b border-[var(--hairline)] px-6 py-5 transition last:border-0 hover:bg-[var(--surface)]/50"
              >
                <div className="col-span-12 md:col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-[var(--accent)]/30 font-mono text-xs font-bold" style={{ background: "var(--accent-dim)", color: "var(--ink)" }}>
                      {h.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold">{h.symbol}</div>
                      <div className="text-xs text-[var(--ink-soft)]">{h.name}</div>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2 font-mono text-sm tabular">{h.amount}</div>
                <div className="col-span-4 md:col-span-2 font-mono text-sm tabular">${h.usd.toLocaleString()}</div>
                <div className="col-span-4 md:col-span-2">
                  <span
                    className="font-mono text-sm font-semibold tabular"
                    style={{ color: h.change24h >= 0 ? "var(--accent-deep)" : "var(--bad)" }}
                  >
                    {h.change24h >= 0 ? "+" : ""}{h.change24h}%
                  </span>
                </div>
                <div className="col-span-6 md:col-span-1">
                  {h.eligible ? (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                      Eligible
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">N/A</span>
                  )}
                </div>
                <div className="col-span-6 md:col-span-2 text-right">
                  {h.eligible ? (
                    <a href={TELEGRAM_URL} className="btn-ghost text-xs">Pledge &rarr;</a>
                  ) : (
                    <span className="text-xs text-[var(--ink-faint)]">Not eligible</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── ACTIVITY FEED SECTION ─── */}
        <Section id="activity" title="Activity Feed" visible={prefs.activity} onToggle={toggleSection}>
          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
            {MOCK_ACTIVITY.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 border-b border-[var(--hairline)] px-6 py-4 last:border-0 transition hover:bg-[var(--surface)]/50"
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(31,28,24,0.3)" }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{
                    background: item.type === "health" ? "rgba(196,128,58,0.15)" : "var(--accent-dim)",
                    color: item.type === "health" ? "var(--warn)" : "var(--accent)",
                  }}
                >
                  {activityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{item.text}</div>
                  <div className="mt-0.5 text-xs text-[var(--ink-faint)]">{item.time}</div>
                </div>
                {item.points && (
                  <div className="shrink-0 font-mono text-sm font-semibold tabular" style={{ color: "var(--accent)" }}>
                    {item.points}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ─── QUICK ACTIONS SECTION ─── */}
        <Section id="quickActions" title="Quick Actions" visible={prefs.quickActions} onToggle={toggleSection}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <QuickAction label="New Loan" icon={"\u2B06"} href={TELEGRAM_URL} external />
            <QuickAction label="Check Prices" icon={"\u2606"} href="/tokens" />
            <QuickAction label="Calculate Loan" icon={"\u2261"} href="/calculate" />
            <QuickAction label="View Credit" icon={"\u2605"} href="/credit" />
            <QuickAction label="Earn Points" icon={"\u2726"} href="/points" />
            <QuickAction label="Protocol Stats" icon={"\u2630"} href="/stats" />
          </div>
        </Section>

        {/* ─── FOOTER CTA ─── */}
        <section className="relative mt-16 overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--ink)] p-10 text-center md:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-52 w-52 rounded-full bg-[var(--accent-deep)]/20 blur-3xl" />
          <div className="relative">
            <Mark size={56} className="mx-auto mb-6" />
            <h3 className="font-display text-3xl font-medium tracking-[-0.03em] text-[var(--bg)] md:text-5xl">
              All actions happen in <span className="italic text-[var(--accent)]">Telegram</span>
            </h3>
            <p className="mx-auto mt-4 max-w-lg text-[var(--bg)]/70">
              Deposit, repay, top-up, and extend are signed and broadcast from the bot. Dashboard is a read-only preview.
            </p>
            <a href={TELEGRAM_URL} className="btn-accent mt-10 inline-block text-base">
              Open @magpie_capital_bot
              <span aria-hidden> &rarr;</span>
            </a>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="mt-20 border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex flex-wrap items-center gap-6 text-sm text-[var(--ink-soft)]">
            <Link href="/tokens" className="transition hover:text-[var(--ink)]">Tokens</Link>
            <Link href="/calculate" className="transition hover:text-[var(--ink)]">Calculator</Link>
            <Link href="/credit" className="transition hover:text-[var(--ink)]">Credit</Link>
            <Link href="/points" className="transition hover:text-[var(--ink)]">Points</Link>
            <Link href="/stats" className="transition hover:text-[var(--ink)]">Stats</Link>
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--ink)]">Telegram</a>
            <Link href="/" className="transition hover:text-[var(--ink)]">Home</Link>
          </div>
          <div className="text-xs text-[var(--ink-soft)]">&copy; {new Date().getFullYear()} Magpie</div>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────── SUB-COMPONENTS ───────────────────────── */

function SummaryCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        highlight
          ? "border-[var(--accent)]/20 bg-[var(--bg-elevated)] shadow-md"
          : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--hairline-strong)] hover:shadow-sm"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">{label}</div>
      <div className="font-display tabular mt-2 text-2xl font-medium tracking-[-0.03em]">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--ink-soft)]">{sub}</div>
    </div>
  );
}

function QuickAction({
  label,
  icon,
  href,
  external = false,
}: {
  label: string;
  icon: string;
  href: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-6 text-center transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-md cursor-pointer">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}
