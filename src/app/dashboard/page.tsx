"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const PREFS_KEY = "magpie-dashboard-prefs";
const THEME_KEY = "magpie-dashboard-theme";

/* ───────────────────────── THEME TOKENS ───────────────────────── */

const THEMES = {
  light: {
    "--d-bg": "#e8e4d8",
    "--d-bg-panel": "#f2efe4",
    "--d-bg-card": "#ffffff",
    "--d-ink": "#0a0a0a",
    "--d-ink-soft": "#5c5a52",
    "--d-ink-faint": "#a8a49a",
    "--d-border": "#e0dace",
    "--d-border-strong": "#d1cab4",
    "--d-surface": "#f0ebda",
    "--d-surface-hover": "#e8e2d0",
    "--d-accent": "#f7c948",
    "--d-accent-dim": "#fdf2c7",
    "--d-accent-deep": "#c99a2c",
    "--d-accent-ink": "#1a1500",
    "--d-accent-hover": "#ffd668",
    "--d-warn": "#c96a3d",
    "--d-bad": "#b83a3a",
    "--d-table-alt": "rgba(240,235,218,0.5)",
    "--d-health-warn-bg": "var(--d-health-warn-bg)",
    "--d-health-bad-bg": "var(--d-health-bad-bg)",
    "--d-cta-bg": "#0a0a0a",
    "--d-cta-text": "#f2efe4",
    "--d-cta-muted": "rgba(242,239,228,0.6)",
  },
  dark: {
    "--d-bg": "#0f1114",
    "--d-bg-panel": "#181a1f",
    "--d-bg-card": "#1e2028",
    "--d-ink": "#e8e6e1",
    "--d-ink-soft": "#9a978f",
    "--d-ink-faint": "#5c5a55",
    "--d-border": "#2a2c33",
    "--d-border-strong": "#3a3c44",
    "--d-surface": "#252730",
    "--d-surface-hover": "#2e303a",
    "--d-accent": "#f7c948",
    "--d-accent-dim": "rgba(247,201,72,0.12)",
    "--d-accent-deep": "#f7c948",
    "--d-accent-ink": "#1a1500",
    "--d-accent-hover": "#ffd668",
    "--d-warn": "#e8944d",
    "--d-bad": "#e05555",
    "--d-table-alt": "rgba(255,255,255,0.02)",
    "--d-health-warn-bg": "rgba(232,148,77,0.12)",
    "--d-health-bad-bg": "rgba(224,85,85,0.12)",
    "--d-cta-bg": "#252730",
    "--d-cta-text": "#e8e6e1",
    "--d-cta-muted": "rgba(232,230,225,0.4)",
  },
} as const;

type ThemeMode = keyof typeof THEMES;

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
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", amount: "14,200", usd: 3120, change24h: -2.3, eligible: true },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", amount: "82.1M", usd: 1840, change24h: 5.1, eligible: true },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", amount: "3,400", usd: 980, change24h: -0.8, eligible: true },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", amount: "12,000", usd: 650, change24h: 12.4, eligible: true },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", amount: "210,000", usd: 420, change24h: -1.2, eligible: false },
];

const MOCK_ACTIVITY = [
  { type: "repay", text: "Repaid 2.5 SOL — WIF collateral returned", time: "2h ago", points: "+2,100 pts" },
  { type: "health", text: "WIF loan health at 78%", time: "4h ago" },
  { type: "deposit", text: "12,000 FARTCOIN deposited", time: "1d ago" },
  { type: "borrow", text: "Borrowed 1.1 SOL against 40M BONK", time: "3d ago" },
  { type: "credit", text: "Credit score increased to 720 (+15)", time: "5d ago" },
  { type: "extend", text: "Extended WIF loan by 2 days", time: "1w ago" },
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

/* ───────────────────────── SIDEBAR NAV ITEMS ───────────────────────── */

type NavItem = { key: SectionKey; label: string; icon: React.ReactNode } | { key: "overview"; label: string; icon: React.ReactNode };

const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "activeLoans",
    label: "Loans",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: "credit",
    label: "Credit",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
      </svg>
    ),
  },
  {
    key: "points",
    label: "Points",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    key: "holdings",
    label: "Holdings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    key: "activity",
    label: "Activity",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

/* ───────────────────────── HELPERS ───────────────────────── */

function healthColor(h: number): string {
  if (h >= 75) return "var(--d-accent)";
  if (h >= 50) return "var(--d-warn)";
  return "var(--d-bad)";
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

/* ───────────────────────── TOKEN ICON ───────────────────────── */

function TokenIcon({ mint, symbol, size = 28 }: { mint: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ width: size, height: size, background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}
      >
        {symbol[0]}
      </div>
    );
  }

  return (
    <img
      src={`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`}
      alt={symbol}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

/* ───────────────────────── ANIMATED COUNTER ───────────────────────── */

function useAnimatedCounter(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ───────────────────────── CREDIT GAUGE (compact) ───────────────────────── */

function CreditGauge({ score, maxScore = 850 }: { score: number; maxScore?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [pathLength, setPathLength] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / 1500, 1);
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
      <svg viewBox="0 0 200 120" className="w-40 h-auto">
        <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="var(--d-border)" strokeWidth="14" strokeLinecap="round" />
        <path
          ref={pathRef}
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="var(--d-accent)"
          strokeWidth="14"
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLength || 260,
            strokeDashoffset: pathLength ? dashOffset : 260,
            transition: "stroke-dashoffset 0.05s linear",
          }}
        />
      </svg>
      <div className="absolute top-8 flex flex-col items-center">
        <span className="font-display text-4xl font-bold tracking-tight">{animatedScore}</span>
        <span
          className="mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}
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
    <div className="flex items-center gap-2.5">
      <span className="w-24 shrink-0 text-[11px] text-[var(--d-ink-soft)]">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${width}%`,
            background: value >= 80 ? "var(--d-accent)" : value >= 60 ? "var(--d-warn)" : "var(--d-bad)",
          }}
        />
      </div>
      <span className="w-7 text-right text-[10px] font-medium text-[var(--d-ink-soft)]">{value}</span>
    </div>
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
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[70] h-full w-full max-w-xs transition-transform duration-300 ease-out"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="h-full border-l border-[var(--d-border)] p-6 flex flex-col" style={{ background: "var(--d-bg-panel)" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-medium">Customize</h3>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--d-surface-hover)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-soft)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <p className="text-xs text-[var(--d-ink-soft)] mb-5">Toggle sections on or off. Saved locally.</p>
          <div className="flex flex-col gap-0.5">
            {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
              <button key={key} onClick={() => onToggle(key)} className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-[var(--d-surface-hover)]">
                <span className="text-sm">{SECTION_LABELS[key]}</span>
                <div className="relative h-5 w-9 rounded-full transition-colors duration-200" style={{ background: prefs[key] ? "var(--d-accent)" : "var(--d-border-strong)" }}>
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: prefs[key] ? "translateX(18px)" : "translateX(2px)" }} />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--d-border)]">
            <button
              onClick={() => { (Object.keys(SECTION_LABELS) as SectionKey[]).forEach((k) => { if (!prefs[k]) onToggle(k); }); }}
              className="w-full rounded-xl border border-[var(--d-border-strong)] px-3 py-2 text-xs font-medium transition hover:border-[var(--ink)] hover:bg-[var(--d-surface-hover)]"
            >
              Show all
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("overview");
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
      } catch { /* ignore */ }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const toggleSection = useCallback((key: SectionKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText("5fh2K8xP3q8Qz1").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const scrollTo = useCallback((key: string) => {
    setActiveNav(key);
    if (key === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`section-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Computed
  const totalBorrowed = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.borrowed, 0);
  const totalOwed = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.owed, 0);
  const totalCollateralUsd = MOCK_ACTIVE_LOANS.reduce((s, l) => s + l.collateralUsd, 0);
  const holdingsUsd = MOCK_HOLDINGS.reduce((s, h) => s + h.usd, 0);
  const solUsd = MOCK_SOL_BALANCE * MOCK_SOL_PRICE_USD;
  const netWorth = solUsd + holdingsUsd - totalOwed * MOCK_SOL_PRICE_USD;

  const animatedPoints = useAnimatedCounter(mounted ? MOCK_POINTS.total : 0);

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-300" style={{ ...THEMES[theme] as React.CSSProperties, background: "var(--d-bg)", color: "var(--d-ink)" }}>
      {/* ─── SIDEBAR ─── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-[var(--d-border)] bg-[var(--d-bg-panel)] transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-56"}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-[var(--d-border)] px-4 py-4">
          <Link href="/">
            {sidebarCollapsed ? <Mark size={24} /> : <Wordmark size={24} />}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => scrollTo(item.key)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-[var(--d-accent-dim)] text-[var(--d-accent-deep)]"
                      : "text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={`shrink-0 ${isActive ? "text-[var(--d-accent-deep)]" : "text-[var(--d-ink-faint)] group-hover:text-[var(--d-ink-soft)]"}`}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>

          {!sidebarCollapsed && (
            <div className="mt-6 px-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] mb-2">Links</div>
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "Tokens", href: "/tokens" },
                  { label: "Calculator", href: "/calculate" },
                  { label: "Docs", href: "/docs" },
                  { label: "Stats", href: "/stats" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg px-3 py-2 text-[13px] text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-[var(--d-border)] px-2 py-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex w-full items-center justify-center rounded-xl py-2 text-[var(--d-ink-faint)] transition hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink-soft)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}>
              <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ─── MAIN AREA ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ─── TOP BAR ─── */}
        <header className="flex items-center justify-between border-b border-[var(--d-border)] bg-[var(--d-bg-panel)] px-4 py-3 md:px-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/"><Mark size={22} /></Link>
          </div>

          {/* Left: wallet */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-[var(--d-surface)] px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--d-accent)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--d-accent)]" />
              </span>
              <span className="text-xs text-[var(--d-ink-soft)] tracking-wide">{MOCK_WALLET}</span>
              <button onClick={handleCopy} className="flex h-5 w-5 items-center justify-center rounded transition hover:bg-[var(--hairline)]" title="Copy">
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
            </div>
            <div className="h-4 w-px bg-[var(--hairline)]" />
            <span className="text-xs text-[var(--d-ink-soft)]">
              <span className="font-semibold text-[var(--d-ink)]">{MOCK_SOL_BALANCE.toFixed(2)} SOL</span>
              <span className="text-[var(--d-ink-faint)]"> &middot; ${Math.round(solUsd).toLocaleString()}</span>
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--d-border)] text-[var(--d-ink-soft)] transition hover:border-[var(--d-border-strong)] hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setCustomizeOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--d-border)] px-3 py-1.5 text-xs text-[var(--d-ink-soft)] transition hover:border-[var(--d-border-strong)] hover:bg-[var(--d-surface-hover)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="hidden sm:inline">Customize</span>
            </button>
            <a href={TELEGRAM_URL} className="flex items-center gap-1.5 rounded-xl bg-[var(--d-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" /></svg>
              <span className="hidden sm:inline">Open Bot</span>
            </a>
          </div>
        </header>

        {/* ─── CUSTOMIZE PANEL ─── */}
        <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} prefs={prefs} onToggle={toggleSection} />

        {/* ─── SCROLLABLE CONTENT ─── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">

            {/* ─── KPI CARDS ROW ─── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "SOL Balance", value: MOCK_SOL_BALANCE.toFixed(2), sub: `$${Math.round(solUsd).toLocaleString()}`, accent: false },
                { label: "Net Worth", value: `$${Math.round(netWorth).toLocaleString()}`, sub: "All assets - debt", accent: true },
                { label: "Active Loans", value: `${MOCK_ACTIVE_LOANS.length}`, sub: `${totalBorrowed.toFixed(2)} SOL borrowed`, accent: false },
                { label: "Total Owed", value: `${totalOwed.toFixed(2)} SOL`, sub: `$${Math.round(totalOwed * MOCK_SOL_PRICE_USD).toLocaleString()}`, accent: false },
                { label: "Collateral Locked", value: `$${totalCollateralUsd.toLocaleString()}`, sub: `${MOCK_ACTIVE_LOANS.length} positions`, accent: false },
                { label: "Credit Score", value: `${MOCK_CREDIT.score}`, sub: `${MOCK_CREDIT.tier} tier`, accent: true },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={`rounded-2xl border p-4 ${kpi.accent ? "border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/40" : "border-[var(--d-border)] bg-[var(--d-bg-card)]"}`}
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">{kpi.label}</div>
                  <div className={`mt-1.5 font-display text-[22px] font-semibold tracking-tight ${kpi.accent ? "text-[var(--d-accent-deep)]" : ""}`}>{kpi.value}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--d-ink-faint)]">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* ─── MAIN GRID: 2-column on desktop ─── */}
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">

              {/* ─── LEFT COLUMN (8/12) ─── */}
              <div className="xl:col-span-8 flex flex-col gap-6">

                {/* ACTIVE LOANS */}
                {prefs.activeLoans && (
                  <div id="section-activeLoans">
                    <SectionHeader title="Active Loans" count={MOCK_ACTIVE_LOANS.length} />
                    {MOCK_ACTIVE_LOANS.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--d-border-strong)] bg-[var(--d-surface)]/50 p-10 text-center">
                        <div className="text-sm text-[var(--d-ink-soft)]">No active loans</div>
                        <a href={TELEGRAM_URL} className="mt-3 inline-block text-sm font-medium text-[var(--accent)]">Start borrowing &rarr;</a>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {MOCK_ACTIVE_LOANS.map((loan) => (
                          <div key={loan.id} className="group rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5 transition hover:border-[var(--d-border-strong)] hover:shadow-sm">
                            {/* Top row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-xs font-bold" style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}>
                                  {loan.token}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{loan.token}</span>
                                    <span className="rounded-md bg-[var(--d-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--d-ink-soft)]">{loan.tier}</span>
                                  </div>
                                  <div className="text-[10px] text-[var(--d-ink-faint)]">{loan.id}</div>
                                </div>
                              </div>
                              <div
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  background: loan.health >= 75 ? "var(--d-accent-dim)" : loan.health >= 50 ? "var(--d-health-warn-bg)" : "var(--d-health-bad-bg)",
                                  color: healthColor(loan.health),
                                }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: healthColor(loan.health) }} />
                                {healthLabel(loan.health)}
                              </div>
                            </div>

                            {/* Metrics */}
                            <div className="mt-4 grid grid-cols-3 gap-3">
                              <Metric label="Borrowed" value={`${loan.borrowed} SOL`} />
                              <Metric label="Owed" value={`${loan.owed} SOL`} />
                              <Metric label="Liq. Price" value={loan.liqPrice} danger />
                            </div>

                            {/* Health bar */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-[var(--d-ink-faint)]">Health</span>
                                <span className="font-semibold" style={{ color: healthColor(loan.health) }}>{loan.health}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hairline)]">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${loan.health}%`,
                                    background: `linear-gradient(90deg, var(--d-bad), var(--d-warn), var(--d-accent))`,
                                    backgroundSize: "200% 100%",
                                    backgroundPosition: `${100 - loan.health}% 0`,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-[11px] text-[var(--d-ink-faint)]">
                                {loan.startDate} &rarr; {loan.dueDate}
                              </div>
                              <div className="text-[11px]">
                                <span className="font-semibold" style={{ color: loan.daysLeft <= 2 ? "var(--d-warn)" : "var(--d-ink-soft)" }}>{loan.daysLeft.toFixed(1)}d left</span>
                              </div>
                            </div>

                            {/* Quick actions */}
                            <div className="mt-3 flex gap-1.5">
                              {["Repay", "Top-up", "Extend"].map((label) => (
                                <a key={label} href={TELEGRAM_URL} className="flex-1 rounded-lg border border-[var(--d-border)] py-1.5 text-center text-[10px] font-semibold text-[var(--d-ink-soft)] transition hover:border-[var(--d-accent)] hover:bg-[var(--d-accent-dim)] hover:text-[var(--d-accent)]">
                                  {label}
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* HOLDINGS TABLE */}
                {prefs.holdings && (
                  <div id="section-holdings">
                    <SectionHeader title="Holdings" count={MOCK_HOLDINGS.length} />
                    <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--d-border)] bg-[var(--d-surface)]/60">
                            <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Token</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Amount</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Value</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">24h</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_HOLDINGS.map((h, i) => (
                            <tr key={h.symbol} className={`border-b border-[var(--d-border)] last:border-0 transition hover:bg-[var(--d-surface-hover)]/40 ${i % 2 === 1 ? "bg-[var(--d-surface)]/20" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <TokenIcon mint={h.mint} symbol={h.symbol} size={28} />
                                  <div>
                                    <div className="font-medium text-[13px]">{h.symbol}</div>
                                    <div className="text-[10px] text-[var(--d-ink-faint)]">{h.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden sm:table-cell px-4 py-3 text-right text-xs text-[var(--d-ink-soft)]">{h.amount}</td>
                              <td className="px-4 py-3 text-right text-[13px] font-semibold">${h.usd.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-semibold" style={{ color: h.change24h >= 0 ? "var(--d-accent-deep)" : "var(--d-bad)" }}>
                                  {h.change24h >= 0 ? "+" : ""}{h.change24h}%
                                </span>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-right">
                                {h.eligible ? (
                                  <a href={TELEGRAM_URL} className="rounded-lg border border-[var(--d-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--d-ink-soft)] transition hover:border-[var(--d-accent)] hover:text-[var(--d-accent)]">
                                    Pledge
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-[var(--d-ink-faint)]">N/A</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* LOAN HISTORY */}
                {prefs.loanHistory && (
                  <div id="section-loanHistory">
                    <SectionHeader title="Loan History" count={MOCK_PAST_LOANS.length} />
                    <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--d-border)] bg-[var(--d-surface)]/60">
                            <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium w-8"></th>
                            <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Token</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Borrowed</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Tier</th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Date</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_PAST_LOANS.map((loan, i) => (
                            <tr key={loan.id} className={`border-b border-[var(--d-border)] last:border-0 transition hover:bg-[var(--d-surface-hover)]/40 ${i % 2 === 1 ? "bg-[var(--d-surface)]/20" : ""}`}>
                              <td className="px-4 py-3">
                                {loan.status === "repaid" ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}>{"\u2713"}</span>
                                ) : (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: "var(--d-health-bad-bg)", color: "var(--d-bad)" }}>{"\u2717"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-[13px]">{loan.token}</td>
                              <td className="px-4 py-3 text-right text-[13px] font-medium">{loan.borrowed} SOL</td>
                              <td className="hidden sm:table-cell px-4 py-3">
                                <span className="rounded-md bg-[var(--d-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--d-ink-soft)]">{loan.tier}</span>
                              </td>
                              <td className="hidden sm:table-cell px-4 py-3 text-[12px] text-[var(--d-ink-faint)]">{loan.date}</td>
                              <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color: loan.pointsEarned === 0 ? "var(--d-bad)" : "var(--d-accent-deep)" }}>
                                {loan.pointsEarned === 0 ? "0" : `+${loan.pointsEarned.toLocaleString()}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── RIGHT COLUMN (4/12) ─── */}
              <div className="xl:col-span-4 flex flex-col gap-6">

                {/* CREDIT SCORE CARD */}
                {prefs.credit && (
                  <div id="section-credit" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Credit Score" compact />
                    <div className="flex flex-col items-center">
                      <CreditGauge score={MOCK_CREDIT.score} />
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: "var(--d-accent-deep)" }}>+{MOCK_CREDIT.change}</span>
                        <span className="text-[11px] text-[var(--d-ink-faint)]">this month</span>
                      </div>
                      {/* Next tier */}
                      <div className="mt-3 w-full">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-[var(--d-ink-faint)]">Next: Platinum</span>
                          <span className="text-[var(--d-ink-soft)] font-medium">{MOCK_CREDIT.score}/{MOCK_CREDIT.nextTier}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(MOCK_CREDIT.score / MOCK_CREDIT.nextTier) * 100}%`, background: "var(--d-accent)" }} />
                        </div>
                      </div>
                    </div>
                    {/* Factors */}
                    <div className="mt-5 flex flex-col gap-2.5">
                      <FactorBar label="Repayment" value={MOCK_CREDIT.factors.repaymentHistory} />
                      <FactorBar label="Volume" value={MOCK_CREDIT.factors.loanVolume} />
                      <FactorBar label="Account Age" value={MOCK_CREDIT.factors.accountAge} />
                      <FactorBar label="Diversity" value={MOCK_CREDIT.factors.diversity} />
                      <FactorBar label="Liquidations" value={MOCK_CREDIT.factors.liquidations} />
                    </div>
                    <Link href="/credit" className="mt-4 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                      Full credit report &rarr;
                    </Link>
                  </div>
                )}

                {/* POINTS CARD */}
                {prefs.points && (
                  <div id="section-points" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Points" compact />
                    <div className="flex items-end gap-3">
                      <div className="font-display text-3xl font-bold tracking-tight">{animatedPoints.toLocaleString()}</div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}>#{MOCK_POINTS.rank}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--d-ink-soft)]">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[var(--d-accent-deep)]">{MOCK_POINTS.streak}</span> day streak
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--d-accent-deep)]">+{MOCK_POINTS.thisWeek.toLocaleString()}</span> this week
                      </div>
                    </div>
                    {/* Recent */}
                    <div className="mt-4 flex flex-col">
                      {MOCK_POINTS.recentEarnings.slice(0, 4).map((e, i) => (
                        <div key={i} className="flex items-center justify-between border-t border-[var(--d-border)] py-2.5 first:border-0">
                          <div>
                            <div className="text-xs">{e.reason}</div>
                            <div className="text-[10px] text-[var(--d-ink-faint)]">{e.date}</div>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: e.amount === 0 ? "var(--d-bad)" : "var(--d-accent-deep)" }}>
                            {e.amount === 0 ? "0" : `+${e.amount.toLocaleString()}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Link href="/points" className="mt-3 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                      Points calculator &rarr;
                    </Link>
                  </div>
                )}

                {/* ACTIVITY FEED */}
                {prefs.activity && (
                  <div id="section-activity" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Activity" compact />
                    <div className="flex flex-col">
                      {MOCK_ACTIVITY.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 border-t border-[var(--d-border)] py-3 first:border-0 first:pt-0">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs mt-0.5"
                            style={{
                              background: item.type === "health" ? "var(--d-health-warn-bg)" : "var(--d-accent-dim)",
                              color: item.type === "health" ? "var(--d-warn)" : "var(--d-accent-deep)",
                            }}
                          >
                            {activityIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs leading-snug">{item.text}</div>
                            <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">{item.time}</div>
                          </div>
                          {item.points && (
                            <span className="shrink-0 text-[10px] font-semibold text-[var(--d-accent-deep)]">{item.points}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QUICK ACTIONS */}
                {prefs.quickActions && (
                  <div id="section-quickActions" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Quick Actions" compact />
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "New Loan", icon: "\u2B06", href: TELEGRAM_URL, external: true },
                        { label: "Check Prices", icon: "\u2606", href: "/tokens", external: false },
                        { label: "Calculate", icon: "\u2261", href: "/calculate", external: false },
                        { label: "View Credit", icon: "\u2605", href: "/credit", external: false },
                        { label: "Earn Points", icon: "\u2726", href: "/points", external: false },
                        { label: "Protocol Stats", icon: "\u2630", href: "/stats", external: false },
                      ].map((action) => {
                        const inner = (
                          <div className="flex items-center gap-2 rounded-xl border border-[var(--d-border)] px-3 py-2.5 text-xs font-medium transition hover:border-[var(--d-accent)] hover:bg-[var(--d-accent-dim)] hover:text-[var(--d-accent)] cursor-pointer">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md text-xs" style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}>{action.icon}</span>
                            {action.label}
                          </div>
                        );
                        return action.external ? (
                          <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer">{inner}</a>
                        ) : (
                          <Link key={action.label} href={action.href}>{inner}</Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── FOOTER CTA ─── */}
            <div className="relative mt-8 overflow-hidden rounded-2xl border border-[var(--d-border)] p-8 text-center md:p-10" style={{ background: "var(--d-cta-bg)" }}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--d-accent)]/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-[var(--d-accent-deep)]/15 blur-3xl" />
              <div className="relative">
                <h3 className="font-display text-xl font-medium tracking-tight md:text-2xl" style={{ color: "var(--d-cta-text)" }}>
                  All actions happen in <span className="italic" style={{ color: "var(--d-accent)" }}>Telegram</span>
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--d-cta-muted)" }}>
                  Deposit, borrow, repay, and extend from the bot. This dashboard is read-only.
                </p>
                <a href={TELEGRAM_URL} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--d-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]">
                  Open @magpie_capital_bot
                  <span aria-hidden>&rarr;</span>
                </a>
              </div>
            </div>

            {/* Mini footer */}
            <div className="mt-6 flex items-center justify-between text-[11px] text-[var(--d-ink-faint)] pb-4">
              <span>&copy; {new Date().getFullYear()} Magpie</span>
              <div className="flex gap-4">
                <Link href="/" className="hover:text-[var(--d-ink-soft)]">Home</Link>
                <Link href="/docs" className="hover:text-[var(--d-ink-soft)]">Docs</Link>
                <a href={TELEGRAM_URL} className="hover:text-[var(--d-ink-soft)]">Telegram</a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────── SUB-COMPONENTS ───────────────────────── */

function SectionHeader({ title, count, compact }: { title: string; count?: number; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "mb-4" : "mb-3"}`}>
      <h2 className={`font-display font-medium tracking-tight ${compact ? "text-sm" : "text-base"}`}>{title}</h2>
      {count !== undefined && (
        <span className="rounded-md bg-[var(--d-surface)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--d-ink-soft)]">{count}</span>
      )}
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">{label}</div>
      <div className={`mt-0.5 text-[13px] font-semibold ${danger ? "text-[var(--bad)]" : ""}`}>{value}</div>
    </div>
  );
}
