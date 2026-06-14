"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Mark, Wordmark } from "@/components/Logo";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { buildBorrowTransaction } from "@/lib/solana/borrow";
import { fetchDepositorPosition, type DepositorInfo } from "@/lib/solana/pool";
import { translateTxError } from "@/lib/solana/tx-error";
import dynamic from "next/dynamic";
import CustodialWithdraw from "./CustodialWithdraw";
import WalletsList from "./WalletsList";
import PrefsPanel from "./PrefsPanel";
import SiteStatusBanner from "./SiteStatusBanner";
import { ApiHealthBanner } from "@/components/ApiHealthBanner";
import { TakeProfitCard, useTakeProfitState } from "./TakeProfitCard";
import { armTakeProfit } from "@/lib/solana/site-take-profit";
import { DashboardProvider } from "./DashboardContext";

// Below-the-fold widgets are dynamically imported so the initial
// dashboard payload stays small. Each shows null while loading
// (their natural empty-state). Mobile networks gain the most here.
const SupportTickets = dynamic(() => import("./SupportTickets"), { ssr: false });
const ActivityFeed = dynamic(() => import("./ActivityFeed"), { ssr: false });
const EarningsCard = dynamic(() => import("./EarningsCard"), { ssr: false });
const GovernanceCard = dynamic(() => import("./GovernanceCard"), { ssr: false });
const DistributionCard = dynamic(() => import("./DistributionCard"), { ssr: false });

// Note: the floating AI chat is rendered site-wide via
// ClientProviders → FloatingAiChatGlobal, so the dashboard no longer
// mounts its own copy.

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

/* ───────────────────────── TYPES ───────────────────────── */

type SectionKey =
  | "credit"
  | "points"
  | "activeLoans"
  | "loanHistory"
  | "holdings"
  | "quickActions";

type SectionPrefs = Record<SectionKey, boolean>;

// "activity" used to live here gating a second inline activity feed.
// Removed when the duplicate broken feed was deleted — the unified
// <ActivityFeed/> is now the only activity surface and isn't toggleable.
const SECTION_LABELS: Record<SectionKey, string> = {
  credit: "Credit Score",
  points: "Points & Rewards",
  activeLoans: "Active Loans",
  loanHistory: "Loan History",
  holdings: "Holdings",
  quickActions: "Quick Actions",
};

const DEFAULT_PREFS: SectionPrefs = {
  credit: true,
  points: true,
  activeLoans: true,
  loanHistory: true,
  holdings: true,
  quickActions: true,
};

/* ───────────────────────── TYPES: TOKEN HOLDING ───────────────────────── */

interface TokenHolding {
  symbol: string;
  name: string;
  mint: string;
  amount: string;
  decimals: number;
  // Collateral category from supported_mints. Drives the tier ladder
  // display (memecoin vs RWA) when this holding is rendered as
  // eligible collateral in the borrow flow.
  category?: string | null;
}

interface ApprovedToken {
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  // Per-token protocol-exposure cap (computed server-side in
  // /api/v1/eligible-collateral from supported_mints metadata).
  // Lets the dashboard show users the tier their token qualifies
  // for and how much capacity remains before they sign a borrow.
  tier?: string;
  capSol?: number | null;
  openSol?: number;
  remainingSol?: number | null;
  // Collateral category from supported_mints. Used to route the
  // borrow tx to the correct program (V1 for memecoin, V2 for
  // stock/etf/metal). Required for RWA borrows.
  category?: string | null;
}

interface EligibleHolding extends TokenHolding {
  approved: ApprovedToken;
  valueUsd: number;
}

/* ───────────────────────── SIDEBAR NAV ITEMS ───────────────────────── */

// Nav keys include SectionKey (toggleable user-pref sections) plus a
// couple of fixed keys: "overview" (always shown) and "activity" (anchor
// only — the activity feed is always-on for linked users).
type NavItem = { key: SectionKey | "overview" | "activity" | "governance"; label: string; icon: React.ReactNode };

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
  // Governance — operator-flagged that voting was hard to find. Sits
  // last in the section nav so users see Loans / Credit / Holdings
  // first but can still get to active proposals in one click.
  {
    key: "governance",
    label: "Governance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 L4 6 L4 13 C4 17 7 20 12 22 C17 20 20 17 20 13 L20 6 Z" />
        <path d="M9 12 L11 14 L15 10" />
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
    case "repay_early": return "\u21A9";
    case "repay_ontime": return "\u21A9";
    case "repay_late": return "\u21A9";
    case "health": return "\u26A0";
    case "deposit": return "\u2B07";
    case "borrow": return "\u2B06";
    case "credit": return "\u2605";
    case "extend": return "\u21BB";
    case "topup": return "\u2795";
    case "liquidation": return "\u26A0";
    case "referral_earned": return "\uD83C\uDF81"; // \uD83C\uDF81
    case "holder_distribution": return "\uD83D\uDC8E"; // \uD83D\uDC8E
    default: return "\u2022";
  }
}

/** Format a raw token amount with decimals into a human-readable string */
function formatTokenAmount(rawAmount: string, decimals: number): string {
  const num = Number(rawAmount) / Math.pow(10, decimals);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num > 0) return num.toPrecision(4);
  return "0";
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
      // loading="lazy" defers offscreen icons; decoding="async" keeps
      // image decode off the main render thread on mobile.
      loading="lazy"
      decoding="async"
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

function CreditGauge({ score, tier, maxScore = 850 }: { score: number; tier: string; maxScore?: number }) {
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
          {tier}
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
            <button onClick={onClose} aria-label="Close customize panel" className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--d-surface-hover)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-soft)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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

/* ───────────────────────── MOBILE MENU ───────────────────────── */

function MobileMenu({
  open,
  onClose,
  theme,
  onToggleTheme,
  wallet,
  solBalance,
  onCopy,
  copied,
  onScrollTo,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  wallet: string;
  solBalance: number;
  onCopy: () => void;
  copied: boolean;
  onScrollTo: (key: string) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] transition-opacity duration-300 md:hidden"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed left-0 top-0 z-[90] h-full w-[280px] transition-transform duration-300 ease-out md:hidden flex flex-col"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)", background: "var(--d-bg-panel)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--d-border)] px-5 py-4">
          <Wordmark size={22} />
          <button onClick={onClose} aria-label="Close menu" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Wallet info */}
        <div className="border-b border-[var(--d-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--d-accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--d-accent)]" />
            </span>
            <span className="text-xs text-[var(--d-ink-soft)] tracking-wide">{wallet}</span>
            <button
              onClick={onCopy}
              aria-label={copied ? "Wallet address copied" : "Copy wallet address"}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--d-ink-faint)]"
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          <div className="mt-2 text-lg font-semibold">{solBalance.toFixed(4)} SOL</div>
        </div>

        {/* Dashboard sections */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">Dashboard</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onScrollTo(item.key)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
            >
              <span className="text-[var(--d-ink-faint)]">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="mt-4 mb-2 h-px bg-[var(--d-border)]" />
          <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">Pages</div>
          {[
            { label: "Home", href: "/" },
            { label: "Approved Tokens", href: "/tokens" },
            { label: "Loan Calculator", href: "/calculate" },
            { label: "Credit Score", href: "/credit" },
            { label: "Points & Rewards", href: "/points" },
            { label: "Protocol Stats", href: "/stats" },
            { label: "Documentation", href: "/docs" },
            { label: "About", href: "/about" },
            { label: "Changelog", href: "/changelog" },
            { label: "Security", href: "/security" },
            { label: "Whitepaper", href: "/whitepaper" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-[var(--d-border)] px-4 py-4 flex flex-col gap-2">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)]"
          >
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {/* Launch bot */}
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--d-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" /></svg>
            Open Telegram Bot
          </a>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── EMPTY STATE ───────────────────────── */

function EmptyState({
  message,
  cta,
}: {
  message: string;
  cta?: { label: string; href: string } | { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--d-border-strong)] bg-[var(--d-surface)]/50 p-10 text-center">
      <div className="text-sm text-[var(--d-ink-soft)]">{message}</div>
      {cta && "href" in cta && (
        <a href={cta.href} className="mt-3 inline-block text-sm font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
          {cta.label} &rarr;
        </a>
      )}
      {cta && "onClick" in cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-3 inline-block text-sm font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4"
        >
          {cta.label} &rarr;
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton placeholder for loading-state sections. Renders N row-shaped
 * pulsing blocks inside a rounded container that visually matches the
 * eventual populated content. Used everywhere we'd otherwise show
 * plain "Loading…" text.
 */
function SkeletonRows({ count = 3, layout = "row" }: { count?: number; layout?: "row" | "card" }) {
  if (layout === "card") {
    return (
      <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-6">
        <div className="h-4 w-32 rounded bg-[var(--d-border)] animate-pulse" />
        <div className="mt-3 h-8 w-48 rounded bg-[var(--d-border)] animate-pulse" />
        <div className="mt-2 h-3 w-24 rounded bg-[var(--d-border)] animate-pulse" />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)]">
      <div className="divide-y divide-[var(--d-border)]">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-8 w-8 rounded-full bg-[var(--d-border)] animate-pulse shrink-0" />
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="h-3 w-20 rounded bg-[var(--d-border)] animate-pulse" />
              <div className="h-3 w-16 rounded bg-[var(--d-border)] animate-pulse" />
              <div className="h-3 w-24 rounded bg-[var(--d-border)] animate-pulse" />
            </div>
            <div className="h-3 w-14 rounded bg-[var(--d-border)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── MAIN PAGE ───────────────────────── */

// useSearchParams requires a Suspense boundary at build time for client
// components in Next.js 14+. Wrap DashboardPageInner so static rendering
// doesn't blow up; the boundary is invisible in practice (the page
// hydrates instantly on the client).
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const [copied, setCopied] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [prefs, setPrefs] = useState<SectionPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("overview");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMint, setExpandedMint] = useState<string | null>(null);
  const [loanPercent, setLoanPercent] = useState<Record<string, number>>({});

  // ── Wallet integration ──
  const { publicKey, connected, wallets, select, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const [liveCredit, setLiveCredit] = useState<any>(null);
  const [referrals, setReferrals] = useState<{
    linked: boolean;
    code: string | null;
    share_link: string | null;
    referred_count: number;
    borrowed_count: number;
    lifetime_lamports: string;
    paid_lamports: string;
    claimable_lamports: string;
  } | null>(null);
  const [holders, setHolders] = useState<{
    magpie_balance_raw: string;
    magpie_balance: number;
    has_balance: boolean;
    lifetime_lamports: string;
    paid_lamports: string;
    pending_lamports: string;
    distributions_count: number;
    estimated_next_payout_lamports: string;
  } | null>(null);
  const [lpPosition, setLpPosition] = useState<DepositorInfo | null>(null);
  const [lpLoyalty, setLpLoyalty] = useState<{
    has_position: boolean;
    days_held: number;
    lifetime_lamports: string;
    paid_lamports: string;
    distributions_received: number;
    reward_pct: number;
  } | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  // Tier ladders fetched from the bot's /api/v1/loan-tiers endpoint.
  // Falls back to hardcoded constants if the fetch fails (e.g. before
  // the bot endpoint is deployed, or during a transient outage). The
  // fetch is the source of truth so DB tuning of rwa_loan_tiers
  // propagates without a site redeploy.
  type ApiTier = { option: number; ltv_pct: number; duration_days: number; fee_bps: number; label: string };
  const [tiersByCategory, setTiersByCategory] = useState<Record<string, ApiTier[]>>({});
  useEffect(() => {
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
    let cancelled = false;
    (async () => {
      const cats = ["memecoin", "stock"]; // etf/metal can be added when seeded; resolver returns same as stock today
      const next: Record<string, ApiTier[]> = {};
      for (const cat of cats) {
        try {
          const r = await fetch(`${botApi}/api/v1/loan-tiers?category=${cat}`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) continue;
          const j = await r.json();
          if (Array.isArray(j?.tiers) && j.tiers.length > 0) next[cat] = j.tiers as ApiTier[];
        } catch { /* fall through to hardcoded fallback */ }
      }
      if (!cancelled && Object.keys(next).length > 0) setTiersByCategory(next);
    })();
    return () => { cancelled = true; };
  }, []);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [approvedTokens, setApprovedTokens] = useState<ApprovedToken[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);

  // ── Preselect-from-URL (?borrow=<mint>) ──
  // Tokens-page Borrow button (PR #47) routes to /dashboard?borrow=<mint>.
  // When holdings have loaded AND the mint is present in the user's
  // holdings, auto-expand that row + scroll to it so the user lands on
  // the right collateral with one click. If the mint isn't held, the
  // tab still switches to Holdings — the empty-state CTA there explains
  // they need to deposit first. The query param is stripped after we
  // apply it so a refresh doesn't re-trigger the scroll.
  const searchParams = useSearchParams();
  const router = useRouter();
  const borrowMintQuery = searchParams.get("borrow");
  const categoryQuery = searchParams.get("category"); // memecoin | stock | etf | metal
  const tierQuery = searchParams.get("tier");          // "0" | "1" | "2"
  const [hasAppliedBorrowQuery, setHasAppliedBorrowQuery] = useState(false);
  const [hasAppliedCategoryQuery, setHasAppliedCategoryQuery] = useState(false);
  useEffect(() => {
    if (!borrowMintQuery || hasAppliedBorrowQuery) return;
    if (holdingsLoading) return; // wait for first holdings fetch
    const match = holdings.find((h) => h.mint === borrowMintQuery);
    setActiveNav("holdings");
    if (match) {
      setExpandedMint(borrowMintQuery);
      // Defer scroll until the expanded row has rendered.
      setTimeout(() => {
        const el = document.querySelector(`[data-holding-mint="${borrowMintQuery}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    setHasAppliedBorrowQuery(true);
    // Strip the query param so a refresh doesn't re-trigger the scroll.
    router.replace("/dashboard", { scroll: false });
  }, [borrowMintQuery, holdings, holdingsLoading, hasAppliedBorrowQuery, router]);

  // Marketplace tier-card click: ?category=memecoin|stock&tier=0|1|2
  // Behavior:
  //   1. Switch to the holdings nav
  //   2. Find the FIRST eligible holding in that category (one the user
  //      actually owns enough of) and auto-expand its borrow row,
  //      pre-selected to the tier index from the param.
  //   3. If the user has no holdings in that category, scroll to the
  //      holdings list anyway so they see the "deposit collateral"
  //      surface — every marketplace click should arrive somewhere
  //      actionable.
  useEffect(() => {
    if (!categoryQuery || hasAppliedCategoryQuery) return;
    if (holdingsLoading) return;
    const isRwa = categoryQuery === "stock" || categoryQuery === "etf" || categoryQuery === "metal";
    const wantedCategories = isRwa ? new Set(["stock", "etf", "metal"]) : new Set(["memecoin"]);
    const match = holdings.find((h) => h.category && wantedCategories.has(h.category) && Number(h.amount) > 0);
    setActiveNav("holdings");
    if (match) {
      setExpandedMint(match.mint);
      const tierIdx = tierQuery && /^\d$/.test(tierQuery) ? Number(tierQuery) : 0;
      // Stash the desired tier in sessionStorage so the borrow form
      // can pick it up when it mounts. The borrow form already has
      // tier selection wired; this is the deep-link plumbing only.
      try { sessionStorage.setItem("magpie:marketplace-tier-hint", String(tierIdx)); } catch { /* private mode */ }
      setTimeout(() => {
        const el = document.querySelector(`[data-holding-mint="${match.mint}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else {
      // No matching holdings — still scroll to the holdings section so
      // the user lands somewhere actionable instead of the top of the
      // page. Empty-state copy in the holdings list handles "deposit
      // X to get started".
      setTimeout(() => {
        const el = document.querySelector("[data-section=\"holdings\"]") ?? document.querySelector("[data-holding-mint]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    setHasAppliedCategoryQuery(true);
    router.replace("/dashboard", { scroll: false });
  }, [categoryQuery, tierQuery, holdings, holdingsLoading, hasAppliedCategoryQuery, router]);

  // ── Loans ──
  type Loan = {
    loan_id: string | null;
    loan_pda: string;
    /** Program ID the loan lives on — v1 (memecoin) or v2b (RWA). Used by
     * the site repay flow to target the correct on-chain program. */
    program_id: string | null;
    status: string;
    collateral: { mint: string; symbol: string | null; name: string | null; decimals: number | null; image: string | null; category: string; amount: string | null };
    loan: { amount_lamports: string | null; original_amount_lamports: string | null; ltv_percentage: number; duration_days: number };
    timestamps: { started_at: string; due_at: string; updated_at: string };
    // Live collateral-health snapshot — null for non-active loans or
    // when prices weren't available at fetch time. The UI falls back
    // to "—" in that case.
    health?: {
      ratio: number;
      collateral_value_lamports: string | null;
      liquidation_price_sol: number | null;
      liquidation_threshold: number;
      current_price_sol: number;
    } | null;
    tx_signature: string | null;
  };
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [loanHistory, setLoanHistory] = useState<Loan[]>([]);

  // Deep-link to a specific loan from the TG bot health alert.
  // When the bot DMs "Loan health dipped" with a [Loan #X](magpie.capital/dashboard?loan=X)
  // link, this effect scrolls the loan into view AND flashes a highlight ring
  // so the user can immediately see which loan the alert was about.
  // Re-runs when activeLoans changes because on first load activeLoans is
  // empty — we wait until the data is in before scrolling.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetLoanId = params.get("loan");
    if (!targetLoanId) return;
    if (activeLoans.length === 0) return; // data not loaded yet — wait for next run
    const tryScroll = () => {
      const el = document.getElementById(`loan-${targetLoanId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash a highlight ring around the loan card for 2.5s so the
      // user knows which one the alert was about.
      el.style.boxShadow = "inset 0 0 0 2px var(--d-accent, #5b8def), 0 0 0 4px rgba(91,141,239,0.18)";
      el.style.borderRadius = "10px";
      setTimeout(() => {
        el.style.boxShadow = "";
        el.style.borderRadius = "";
      }, 2_500);
    };
    // Slight delay so the layout settles before we scroll. The activeLoans
    // map renders synchronously after state update but layout/measure is async.
    const t = setTimeout(tryScroll, 250);
    return () => clearTimeout(t);
  }, [activeLoans]);
  // Active loans that exist on OTHER linked wallets — surface as a hint
  // so a multi-wallet user understands why "Active Loans" reads 0 when
  // they know they have one elsewhere.
  const [otherWalletsActiveCount, setOtherWalletsActiveCount] = useState<number>(0);
  const [loansLoading, setLoansLoading] = useState(false);

  // ── Eligible collateral (server-computed intersection) ──
  type ApiEligible = {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    image: string | null;
    category: string;
    raw_amount: string;
    amount: number;
    /** Live USD price per token, populated server-side from DexScreener.
     *  Without this the tier cards show "You receive $0.00" — see
     *  /api/v1/eligible-collateral. */
    priceUsd?: number | null;
    /** Risk-preview fields from DexScreener (same response). Surfaced
     *  on each token tile so users can size up token fundamentals BEFORE
     *  signing a borrow — thin liquidity + high volatility = liquidation
     *  risk regardless of how good the tier looks on paper. */
    liquidityUsd?: number | null;
    volume24hUsd?: number | null;
    priceChange24hPct?: number | null;
    /** Per-token protocol-exposure cap fields (computed server-side
     *  from supported_mints metadata + currently-active loans). Lets
     *  the dashboard show users the tier their token qualifies for
     *  (bluechip/large/mid/small/override/unlimited) and how much
     *  borrowing capacity is left across the whole protocol before
     *  the cap is hit. Without this, users only learn about the cap
     *  AFTER signing and getting refused by anti-exploit. */
    tier?: string;
    capSol?: number | null;
    openSol?: number;
    remainingSol?: number | null;
  };
  const [eligibleFromApi, setEligibleFromApi] = useState<ApiEligible[]>([]);

  // Bumped after any user action that mutates protocol state (borrow, etc.)
  // OR by a 2-min auto-poll for the slower endpoints (credit/refs/holders/lpLoy).
  // Every state-fetching useEffect depends on this — so a single bump
  // forces a fresh load across the whole dashboard.
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const forceRefresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  // Auto-poll trigger every 2 min so updates from bot actions
  // (e.g., user repays a loan via TG → credit score updates) appear
  // on the dashboard without a manual reload.
  //
  // Skip the bump when the tab is hidden so dashboards left open in
  // a buried tab don't keep hitting our APIs. When the user comes
  // back to the tab, fire one immediate forceRefresh so they see
  // fresh data instead of waiting up to 2 min for the next tick.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      forceRefresh();
    }, 120_000);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) forceRefresh();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [forceRefresh]);

  // ── Activity feed (unified across loans, referrals, holder distributions) ──
  type ActivityEvent = {
    id: string | number;
    source?: string;
    type: string;
    score_delta: number | null;
    timestamp: string;
    loan_id: number | null;
    token: {
      symbol: string;
      mint: string | null;
      decimals: number | null;
      image: string | null;
    } | null;
    amounts: {
      collateral_raw: string | null;
      loan_lamports: string | null;
      original_loan_lamports: string | null;
    };
    terms: {
      ltv_percentage: number | null;
      duration_days: number | null;
    };
    tx_signature: string | null;
    reward: {
      lamports: string;
      status: string | null;
    } | null;
  };
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  // Cumulative credit-event points across the user's ENTIRE history.
  // Sourced from the bot's /api/v1/activity total_points field, which
  // sums credit_events.score_delta server-side. We can't compute this
  // from `activity` on the client because activity is limit-paged (30
  // events default) — clients with more lifetime activity would see
  // a lower total than reality. The bot's SUM is the source of truth.
  const [lifetimePoints, setLifetimePoints] = useState<number>(0);

  // Take-profit state — one fetch for all loans on the connected wallet,
  // polled every 60s. Lifted up so we don't fire N requests for N loans
  // (one per <TakeProfitCard/>). Each card receives the state + a refresh
  // callback via props.
  const takeProfitState = useTakeProfitState(
    process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app",
    publicKey?.toBase58() ?? null,
  );

  // ── Borrow state ──
  const [borrowing, setBorrowing] = useState(false);
  const [borrowTx, setBorrowTx] = useState<string | null>(null);
  // After a successful borrow, surface a 1-tap "lock in upside" prompt
  // so the user can arm an autonomous take-profit immediately while
  // they're already at the dashboard. Cleared on borrow start AND on
  // explicit dismiss.
  const [postBorrowTakeProfit, setPostBorrowTakeProfit] = useState<{
    chainLoanId: string;
    collateralSymbol: string;
  } | null>(null);
  const [postBorrowTpBusy, setPostBorrowTpBusy] = useState(false);
  const [postBorrowTpError, setPostBorrowTpError] = useState<string | null>(null);
  // Pre-borrow take-profit toggle. null = off; a number = arm at this
  // multiplier automatically the moment the borrow tx confirms. Local
  // state per page mount; the user re-picks for each borrow.
  const [autoTakeProfitMultiplier, setAutoTakeProfitMultiplier] = useState<number | null>(null);
  // After a successful auto-arm we DON'T show the inline post-borrow prompt
  // (it would be redundant). This flag distinguishes "the auto path armed
  // it" from "user dismissed and might want to manually pick later".
  const [autoArmedAfterBorrow, setAutoArmedAfterBorrow] = useState<{ multiplier: number } | null>(null);
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const { sendTransaction, signTransaction, signMessage } = useWallet();

  // Site-repay / extend / topup are now the default — always render the
  // action buttons. The feature flag is retired (kept as a constant
  // here only so the env var can still force-disable in an emergency,
  // by setting NEXT_PUBLIC_SITE_REPAY_ENABLED=false explicitly).
  // Otherwise the buttons are visible to every site-connected user,
  // including site-native auto-bootstrapped accounts.
  const SITE_REPAY_ENABLED = process.env.NEXT_PUBLIC_SITE_REPAY_ENABLED !== "false";
  const [repayPendingFor, setRepayPendingFor] = useState<string | null>(null); // loan_pda
  const [repaySuccessSig, setRepaySuccessSig] = useState<string | null>(null);
  const [repayError, setRepayError] = useState<string | null>(null);
  const [repayConfirmFor, setRepayConfirmFor] = useState<Loan | null>(null);
  // 100 = full repay (closes loan, collateral returns).
  // 25/50/75 = partial (pays down debt, collateral stays locked).
  const [repayPct, setRepayPct] = useState<25 | 50 | 75 | 100>(100);
  // Extend modal — shows the computed fee + confirmation
  const [extendConfirmFor, setExtendConfirmFor] = useState<Loan | null>(null);
  const [extendPendingFor, setExtendPendingFor] = useState<string | null>(null);
  // Topup modal — user enters extra collateral amount
  const [topupConfirmFor, setTopupConfirmFor] = useState<Loan | null>(null);
  const [topupAmountStr, setTopupAmountStr] = useState("");
  const [topupMaxRaw, setTopupMaxRaw] = useState<bigint | null>(null); // exact lamports/raw if Max clicked
  const [topupPendingFor, setTopupPendingFor] = useState<string | null>(null);

  const walletDisplay = connected && publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const walletFull = connected && publicKey ? publicKey.toBase58() : "";

  // Use a ref for connection to prevent effects re-firing when the
  // ConnectionProvider re-renders (which creates a new context value).
  const connRef = useRef(connection);
  connRef.current = connection;

  // Fetch SOL balance — poll every 20s. With Helius RPC the request cost
  // is tiny (1 credit each) and the user expects the dashboard to feel live.
  useEffect(() => {
    if (!connected || !publicKey) { setSolBalance(0); return; }
    let cancelled = false;
    const fetchBalance = () => {
      connRef.current.getBalance(publicKey)
        .then((lamports) => {
          if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
        })
        .catch((err) => {
          // Don't zero on transient failure — keep last good value so a single
          // 429 doesn't make the UI show "0 SOL" when the user actually has SOL.
          console.warn("[dashboard] getBalance failed:", err?.message);
        });
    };
    fetchBalance();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchBalance();
    }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, refreshTrigger]);

  // Fetch SPL token holdings via our server-side proxy that talks to
  // the bot's Helius-backed RPC. Bypasses the browser wallet adapter
  // entirely so Token-2022 mints (like $CUM) reliably show up.
  // Polls every 30s so deposits / repays reflect quickly.
  useEffect(() => {
    if (!connected || !publicKey) { setHoldings([]); return; }
    let cancelled = false;
    const walletStr = publicKey.toBase58();

    const fetchHoldings = () => {
      setHoldingsLoading(true);
      fetch(`/api/v1/wallet/balance?wallet=${walletStr}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d?.ok) return;
          if (typeof d.sol?.amount === "number") setSolBalance(d.sol.amount);
          const tokens: TokenHolding[] = (d.tokens ?? []).map((t: any) => ({
            // Prefer real symbol/name from the API (which now does a
            // DexScreener lookup for unknown mints); only fall back to
            // a short label if even that didn't resolve. Never display a
            // 4-char mint prefix as if it were a ticker.
            symbol: t.symbol || "Unknown",
            name: t.name || t.symbol || `Unknown (${t.mint.slice(0, 4)}…${t.mint.slice(-4)})`,
            mint: t.mint,
            amount: t.raw_amount,
            decimals: t.decimals,
            // category from supported_mints — load-bearing for the tier
            // ladder picker. Without this, every holding gets treated as
            // memecoin (h.category is undefined → isRwa is false) and an
            // RWA collateral shows the 20%/25%/30% memecoin ladder
            // instead of the 50%/60%/70% RWA ladder. Caused the
            // 2026-06-13 0.78-vs-2.68 SOL SPCX preview mismatch.
            category: t.category ?? null,
          }));
          tokens.sort((a, b) => {
            const aNum = Number(a.amount) / Math.pow(10, a.decimals);
            const bNum = Number(b.amount) / Math.pow(10, b.decimals);
            return bNum - aNum;
          });
          setHoldings(tokens);
        })
        .catch((err) => {
          console.warn("[dashboard] /wallet/balance fetch failed:", err?.message);
        })
        .finally(() => { if (!cancelled) setHoldingsLoading(false); });
    };
    fetchHoldings();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchHoldings();
    }, 90_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, refreshTrigger]);

  // Fetch approved collateral tokens
  useEffect(() => {
    if (!connected || !publicKey) { setApprovedTokens([]); return; }
    let cancelled = false;
    setApprovedLoading(true);
    fetch("/api/v1/tokens")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // /api/v1/tokens returns { ok, count, tokens: [...] } — the
        // historical d.data shape never existed, which is why the
        // approved list silently stayed empty.
        const list = Array.isArray(d?.tokens) ? d.tokens : Array.isArray(d?.data) ? d.data : [];
        setApprovedTokens(list);
        setApprovedLoading(false);
      })
      .catch(() => {
        if (!cancelled) setApprovedLoading(false);
      });
    return () => { cancelled = true; };
  }, [connected, publicKey, refreshTrigger]);

  // Eligible collateral comes from the server-side endpoint that does the
  // intersection of (held tokens) × (approved tokens). The dashboard does
  // NOT gate this on approvedTokens being populated — the API already did
  // the join and is the authoritative source.
  const eligibleCollateral: EligibleHolding[] = (() => {
    if (!eligibleFromApi.length) return [];
    const approvedMap = new Map(approvedTokens.map((t) => [t.mint, t]));
    return eligibleFromApi
      .map((e) => {
        const approved = approvedMap.get(e.mint);
        const uiAmount = e.amount ?? 0;
        // Prefer the live price the eligible-collateral endpoint
        // attached server-side (via DexScreener) — falls back to the
        // approvedTokens entry (legacy path, currently has no price)
        // and finally 0. Without this, the borrow tier cards showed
        // "You receive $0.00" because neither source had a price.
        const livePriceUsd = e.priceUsd ?? approved?.priceUsd ?? null;
        const valueUsd = livePriceUsd ? uiAmount * livePriceUsd : 0;
        // Prefer server-side enrichment (DexScreener via
        // /api/v1/eligible-collateral) for the risk-preview fields,
        // falling back to whatever supported_mints had cached.
        const liveLiquidity = e.liquidityUsd ?? approved?.liquidity ?? null;
        const liveVolume24h = e.volume24hUsd ?? approved?.volume24h ?? null;
        const livePriceChange24h = e.priceChange24hPct ?? approved?.priceChange24h ?? null;
        return {
          symbol: e.symbol,
          name: e.name,
          mint: e.mint,
          amount: e.raw_amount,
          decimals: e.decimals,
          // category drives the tier ladder display (RWA vs memecoin).
          // Source: /api/v1/eligible-collateral which already joins
          // supported_mints.category.
          category: e.category,
          approved: approved
            ? {
                ...approved,
                priceUsd: livePriceUsd ?? approved.priceUsd,
                liquidity: liveLiquidity,
                volume24h: liveVolume24h,
                priceChange24h: livePriceChange24h,
                tier: e.tier,
                capSol: e.capSol,
                openSol: e.openSol,
                remainingSol: e.remainingSol,
              }
            : {
                mint: e.mint,
                symbol: e.symbol,
                name: e.name,
                priceUsd: livePriceUsd,
                priceChange24h: livePriceChange24h,
                volume24h: liveVolume24h,
                marketCap: null,
                liquidity: liveLiquidity,
                tier: e.tier,
                capSol: e.capSol,
                openSol: e.openSol,
                remainingSol: e.remainingSol,
              },
          valueUsd,
        };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);
  })();

  const totalEligibleUsd = eligibleCollateral.reduce((sum, h) => sum + h.valueUsd, 0);

  // ── Borrow handler: build tx, sign with Phantom, send on-chain ──
  const handleBorrow = useCallback(async (
    holding: EligibleHolding,
    tierOption: number,
    pct: number,
  ) => {
    if (!publicKey || !connected) return;
    setBorrowing(true);
    setBorrowTx(null);
    setBorrowError(null);
    setPostBorrowTakeProfit(null);
    setPostBorrowTpError(null);
    setAutoArmedAfterBorrow(null);

    try {
      const uiAmount = Number(holding.amount) / Math.pow(10, holding.decimals);
      const collateralUiAmount = uiAmount * (pct / 100);
      const collateralAmountRaw = BigInt(Math.floor(collateralUiAmount * Math.pow(10, holding.decimals))).toString();

      // Fetch SOL price to convert USD value to lamports
      const solPriceRes = await fetch("https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112");
      const solPriceData = await solPriceRes.json();
      const solPairs = Array.isArray(solPriceData) ? solPriceData : solPriceData.pairs || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bestSol = solPairs.reduce((best: any, pair: any) =>
        (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best,
      );
      const solPriceUsd = parseFloat(bestSol.priceUsd);

      // Collateral value in lamports = (uiAmount * priceUsd / solPriceUsd) * 1e9
      const priceUsd = holding.approved.priceUsd || 0;
      const collateralValueSol = (collateralUiAmount * priceUsd) / solPriceUsd;
      const collateralValueLamports = Math.floor(collateralValueSol * 1e9).toString();

      // PRE-ATTEST the on-chain price feed before building / signing.
      // Without this, the wallet (Phantom) simulates the tx using its own
      // RPC and may see a feed > 120s old → "Transaction rejected:
      // StalePriceAttestation" appears BEFORE the user can sign. cosign-borrow
      // also has a JIT attest, but that runs AFTER the wallet sign, too late
      // for the simulation gate. Tied refresh to a soft 12s timeout so a
      // flaky attestor doesn't hang the borrow flow indefinitely; on failure
      // we still attempt the borrow (cosign-borrow's JIT might recover).
      const botApiForRefresh = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
      try {
        const refreshCtl = new AbortController();
        const refreshTimer = setTimeout(() => refreshCtl.abort(), 12_000);
        const refreshRes = await fetch(`${botApiForRefresh}/api/v1/price/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mint: holding.mint }),
          signal: refreshCtl.signal,
        });
        clearTimeout(refreshTimer);
        if (!refreshRes.ok) {
          // Non-fatal — log and continue. cosign-borrow's server-side JIT
          // attestation may still rescue the borrow. The wallet simulation
          // may still fail; the user gets a retry path in that case.
          console.warn("[borrow] price refresh non-200, proceeding:", refreshRes.status);
        }
      } catch (refreshErr) {
        console.warn("[borrow] price refresh failed (proceeding):", (refreshErr as Error).message);
      }

      const { transaction, loanId: chainLoanId } = await buildBorrowTransaction({
        borrower: publicKey,
        collateralMint: holding.mint,
        collateralAmountRaw,
        collateralValueLamports,
        loanOption: tierOption,
        connection,
        // CRITICAL — routes RWA borrows (stock/etf/metal) to V2 program.
        // 2026-06-13 fix: previously `holding.approved.category`. The
        // `approved` object is built from /api/v1/tokens via a SEPARATE
        // fetch with a hand-built fallback (line ~1244) that does NOT
        // include category. So when approvedTokens hasn't loaded yet OR
        // a mint isn't in the approvedTokens map, `approved.category` is
        // undefined → chooseProgramIdForCategory defaults to V1 → V1
        // program applies memecoin Standard 20% LTV → user receives 0.78
        // SOL instead of the advertised 2.65 SOL on RWA Standard.
        //
        // `holding.category` is the AUTHORITATIVE field — sourced from
        // /api/v1/eligible-collateral (which joins supported_mints.category
        // server-side) and now also passed through the /wallet/balance
        // mapping (PR #58). The eligibility fetch is the same one that
        // gates whether the user can even see the borrow button, so by
        // the time we reach handleBorrow, holding.category is reliably
        // populated.
        category: holding.category ?? holding.approved.category,
      });

      // PRE-SIMULATE before asking the wallet to sign. Phantom's docs
      // (docs.phantom.com/developer-powertools/domain-and-transaction-warnings)
      // explicitly recommend this for multi-signer flows where Phantom can't
      // submit itself — pre-sim catches errors BEFORE the user gets a
      // warning, and gives Phantom strong signal that the dApp is being
      // careful. sigVerify:false because the tx isn't signed yet at this
      // step. Soft-fail (don't block on simulation failure — the real
      // submit gives the authoritative answer; this is just an early
      // sanity check).
      try {
        // Legacy Transaction simulateTransaction signature — RPC simulates
        // without requiring signatures when none are present.
        const sim = await connection.simulateTransaction(transaction);
        if (sim.value.err) {
          // Surface a friendly error pre-sign, so Phantom never sees a
          // tx we expect to fail.
          throw new Error(
            `Pre-flight failed: ${JSON.stringify(sim.value.err)}. ` +
              (sim.value.logs?.slice(-3).join(" | ") ?? ""),
          );
        }
      } catch (simErr) {
        // If simulation threw (network blip, etc.) — proceed anyway. The
        // backend cosign + submit will surface any real error.
        if ((simErr as Error).message?.startsWith("Pre-flight failed:")) throw simErr;
        // else continue
      }

      // Two-step sign: user signs first (in browser via wallet adapter),
      // then the bot's co-sign endpoint adds the lender authority signature
      // and submits. The endpoint strictly allowlists request_and_fund_loan
      // and rejects any other instruction the lender authority could sign
      // (admin_withdraw, set_paused, etc.) — see src/api/cosign-borrow.js
      // for the security gates.
      if (!signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }
      const userSigned = await signTransaction(transaction);
      const partialBase64 = userSigned.serialize({ requireAllSignatures: false }).toString("base64");

      const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
      const cosignRes = await fetch(`${botApi}/api/v1/cosign-borrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partialSignedTxBase64: partialBase64 }),
      });
      const cosignBody = await cosignRes.json();
      if (!cosignRes.ok || !cosignBody.ok) {
        throw new Error(cosignBody.error || `Co-sign failed (${cosignRes.status})`);
      }
      const signature: string = cosignBody.signature;

      setBorrowTx(signature);

      // Pre-borrow toggle path: user pre-selected a multiplier before
      // clicking borrow. Auto-arm right now without a second click. If
      // the arm fails we still surface the manual 1-tap prompt below so
      // the user can retry.
      let autoArmedOk = false;
      if (autoTakeProfitMultiplier != null && publicKey && signMessage) {
        try {
          const botApi2 = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
          await armTakeProfit({
            botApiUrl: botApi2,
            signerPubkey: publicKey.toBase58(),
            signMessage,
            request: {
              from: publicKey.toBase58(),
              loanIdChain: chainLoanId.toString(),
              target: { kind: "multiplier", multiplier: autoTakeProfitMultiplier },
              slippageBps: 200,
              sellDestination: "sol",
            },
          });
          autoArmedOk = true;
          setAutoArmedAfterBorrow({ multiplier: autoTakeProfitMultiplier });
          // Clear the toggle so the next borrow is a clean choice.
          setAutoTakeProfitMultiplier(null);
        } catch (err) {
          console.warn("[borrow] auto take-profit arm failed (fall back to manual prompt):", err);
        }
      }

      // Surface the 1-tap take-profit prompt only if the auto path didn't
      // already arm. chainLoanId is the u64 loan_id derived client-side
      // during buildBorrowTransaction — same id the bot wrote into
      // loans.loan_id, so we can arm against it.
      if (!autoArmedOk) {
        setPostBorrowTakeProfit({
          chainLoanId: chainLoanId.toString(),
          collateralSymbol: holding.symbol || "token",
        });
      }

      // Safety net: trigger a sync-loan in case cosign-borrow's inline
      // recordLoan hit an RPC blip. cosign-borrow returns the loan_pda
      // in its response specifically so we can do this. Fail-soft.
      if (cosignBody.loan_pda) {
        fetch(`${botApi}/api/v1/sync-loan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loan_pda: cosignBody.loan_pda, signature }),
        }).catch(() => {});
      }

      // Refresh balances + ALL dashboard state. The borrow just changed:
      //  • SOL balance (got the loan)
      //  • Active loans (new entry)
      //  • Eligible collateral (some locked up)
      //  • Credit score (volume + activity factors tick)
      //  • Activity feed
      //  • Referrer's earnings (if applicable)
      // forceRefresh bumps refreshTrigger which all the effects watch.
      connection.getBalance(publicKey).then((lamports) => setSolBalance(lamports / LAMPORTS_PER_SOL)).catch(() => {});
      forceRefresh();
    } catch (err) {
      // Use the same translator as /earn so users see clean, educational
      // error copy instead of raw Solana logs.
      const friendly = translateTxError(err, { flow: "deposit" }); // borrow uses same patterns
      setBorrowError(`${friendly.title}: ${friendly.body.split("\n")[0]}`);
    } finally {
      setBorrowing(false);
    }
  }, [publicKey, connected, connection, sendTransaction, signMessage, autoTakeProfitMultiplier, forceRefresh]);

  // Inline post-borrow take-profit arming. Called from the 1-tap prompt
  // rendered right under the "Loan executed" banner. Uses the chain
  // loan_id the site already knows from buildBorrowTransaction — no
  // need to wait for the bot to sync the new loan.
  const armPostBorrowTakeProfit = useCallback(
    async (multiplier: number) => {
      if (!publicKey || !signMessage || !postBorrowTakeProfit) return;
      setPostBorrowTpBusy(true);
      setPostBorrowTpError(null);
      try {
        const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
        await armTakeProfit({
          botApiUrl: botApi,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          request: {
            from: publicKey.toBase58(),
            loanIdChain: postBorrowTakeProfit.chainLoanId,
            target: { kind: "multiplier", multiplier },
            slippageBps: 200,
            sellDestination: "sol",
          },
        });
        setPostBorrowTakeProfit(null);
        forceRefresh();
      } catch (err) {
        setPostBorrowTpError((err as Error).message || "Could not arm take-profit");
      } finally {
        setPostBorrowTpBusy(false);
      }
    },
    [publicKey, signMessage, postBorrowTakeProfit, forceRefresh],
  );

  // Stop-loss companion to armPostBorrowTakeProfit. Same loan, same
  // signing flow, just Direction: below and multiplier < 1×. Lets the
  // user lock in BOTH upside and downside in two taps right after
  // borrow — the funnel today required leaving the post-borrow card
  // and finding the loan in the active-loans list to set SL.
  const armPostBorrowStopLoss = useCallback(
    async (multiplier: number) => {
      if (!publicKey || !signMessage || !postBorrowTakeProfit) return;
      setPostBorrowTpBusy(true);
      setPostBorrowTpError(null);
      try {
        const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
        await armTakeProfit({
          botApiUrl: botApi,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          request: {
            from: publicKey.toBase58(),
            loanIdChain: postBorrowTakeProfit.chainLoanId,
            direction: "below",
            // SL needs a wider default slippage than TP — down-drafts
            // thin liquidity faster. 3% matches the LimitSlot default.
            target: { kind: "multiplier", multiplier },
            slippageBps: 300,
            sellDestination: "sol",
          },
        });
        // Don't clear the post-borrow card — the user may want to also
        // arm TP. forceRefresh updates the dashboard's order list so
        // the LimitSlot below shows the new SL row immediately.
        forceRefresh();
      } catch (err) {
        setPostBorrowTpError((err as Error).message || "Could not arm stop-loss");
      } finally {
        setPostBorrowTpBusy(false);
      }
    },
    [publicKey, signMessage, postBorrowTakeProfit, forceRefresh],
  );

  // Site-repay handler. Routes to full or partial repay based on repayPct.
  // 100% → buildRepayTransaction (closes loan, collateral returns).
  // <100 → buildPartialRepayTransaction (pays down debt, collateral stays locked).
  // Both build → user signs → submit → poll → refresh. TG flow untouched.
  const handleRepay = useCallback(async (loan: Loan, pct: 25 | 50 | 75 | 100) => {
    if (!publicKey || !connected) return;
    setRepayConfirmFor(null);
    setRepayError(null);
    setRepaySuccessSig(null);
    setRepayPendingFor(loan.loan_pda);
    try {
      // PRE-FLIGHT: SOL balance check.
      // The Anchor repay instruction includes a System Program transfer of
      // `owed_lamports` from the borrower to the lender vault. If the
      // borrower has less SOL than that + a small reserve for tx fees,
      // the on-chain tx fails with `InstructionError: [4, Custom(1)]`
      // (System Program "result with negative lamports"). That error is
      // technically correct but useless to the user — they have no idea
      // they're short on SOL. We catch this case ourselves and surface
      // the exact deficit + a concrete next step.
      //
      // Owed estimate: original_amount_lamports is the on-chain owed at
      // the moment the loan was created. Real on-chain repay_amount
      // can be a few lamports higher due to interest/rounding. We add a
      // 0.005 SOL reserve to cover both the tx fee and that small drift.
      const owedRaw = BigInt(loan.loan.original_amount_lamports ?? "0");
      const repayLamportsExpected = pct === 100 ? owedRaw : (owedRaw * BigInt(pct)) / 100n;
      const TX_FEE_RESERVE = 5_000_000n; // 0.005 SOL — priority fee + drift buffer
      const userBalance = BigInt(await connection.getBalance(publicKey));
      const needed = repayLamportsExpected + TX_FEE_RESERVE;
      if (userBalance < needed) {
        const deficitSol = Number(needed - userBalance) / 1e9;
        const haveSol = Number(userBalance) / 1e9;
        const needSol = Number(needed) / 1e9;
        throw new Error(
          `Not enough SOL to ${pct === 100 ? "repay this loan" : `partial-repay ${pct}%`}. ` +
          `You have ${haveSol.toFixed(4)} SOL, need ~${needSol.toFixed(4)} SOL ` +
          `(${(Number(repayLamportsExpected) / 1e9).toFixed(4)} repay + small reserve for tx fee). ` +
          `Add ${deficitSol.toFixed(4)} SOL to your wallet and try again. ` +
          `If you want to repay LESS, pick a smaller % (25/50/75) — that closes the loan partially.`
        );
      }

      const { PublicKey } = await import("@solana/web3.js");
      const { PROGRAM_ID } = await import("@/lib/solana/constants");
      const programId = loan.program_id ? new PublicKey(loan.program_id) : PROGRAM_ID;
      let transaction;
      if (pct === 100) {
        // Full repay — reads live on-chain repay_amount internally
        const { buildRepayTransaction } = await import("@/lib/solana/repay");
        const r = await buildRepayTransaction({
          borrower: publicKey,
          loanPda: loan.loan_pda,
          collateralMint: loan.collateral.mint,
          connection,
          programId,
        });
        transaction = r.transaction;
      } else {
        // Partial — compute the percentage of current owed (live on-chain
        // value would be ideal; for now use the original_amount as a safe
        // upper bound, and the tx builder hard-clamps to actual on-chain).
        const owed = BigInt(loan.loan.original_amount_lamports ?? "0");
        const repayLamports = (owed * BigInt(pct)) / 100n;
        if (repayLamports <= 0n) throw new Error("Partial amount comes out to 0 — try a larger %");
        const { buildPartialRepayTransaction } = await import("@/lib/solana/partial-repay");
        const r = await buildPartialRepayTransaction({
          borrower: publicKey,
          loanPda: loan.loan_pda,
          repayLamports,
          connection,
          programId,
        });
        transaction = r.transaction;
      }
      const sig = await sendTransaction(transaction, connection);
      // Poll for confirmation
      const start = Date.now();
      let confirmed = false;
      while (Date.now() - start < 90_000) {
        const status = await connection.getSignatureStatus(sig);
        const s = status?.value;
        if (s?.err) throw new Error(JSON.stringify(s.err));
        if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
          confirmed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!confirmed) throw new Error("Tx not confirmed in 90s — check Solscan");
      // Tell the bot the tx landed so the activity feed, /stats, credit
      // score, and streak pick up the state change immediately instead
      // of waiting for the every-5-min reconciler. Fail-soft.
      const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
      fetch(`${botApi}/api/v1/sync-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_pda: loan.loan_pda, signature: sig }),
      }).catch(() => {});
      setRepaySuccessSig(sig);
      forceRefresh();
    } catch (e: unknown) {
      // Translate Anchor's terse "InstructionError [4, Custom 1]" + the
      // various RPC "insufficient lamports" formats into a clear,
      // actionable message in the user's own language. The repay flow
      // gets its own branch in translateTxError so the copy is specific
      // to "you don't have enough SOL to repay" rather than the generic
      // "fees" wording for withdraw.
      const friendly = translateTxError(e, { flow: "repay" });
      setRepayError(`${friendly.title}: ${friendly.body.split("\n").filter(Boolean).slice(0, 4).join(" — ")}`);
    } finally {
      setRepayPendingFor(null);
    }
  }, [publicKey, connected, connection, sendTransaction, forceRefresh]);

  // Extend handler: pay tier-dependent fee, get a fresh duration.
  // Borrower-only signature, no lender co-sign needed.
  const handleExtend = useCallback(async (loan: Loan) => {
    if (!publicKey || !connected) return;
    setExtendConfirmFor(null);
    setRepayError(null);
    setRepaySuccessSig(null);
    setExtendPendingFor(loan.loan_pda);
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { PROGRAM_ID } = await import("@/lib/solana/constants");
      const { buildExtendTransaction } = await import("@/lib/solana/extend");
      const programId = loan.program_id ? new PublicKey(loan.program_id) : PROGRAM_ID;
      const { transaction } = await buildExtendTransaction({
        borrower: publicKey,
        loanPda: loan.loan_pda,
        connection,
        programId,
      });
      const sig = await sendTransaction(transaction, connection);
      // Confirm polling — same pattern as repay
      const start = Date.now();
      let confirmed = false;
      while (Date.now() - start < 90_000) {
        const status = await connection.getSignatureStatus(sig);
        const s = status?.value;
        if (s?.err) throw new Error(JSON.stringify(s.err));
        if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
          confirmed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!confirmed) throw new Error("Tx not confirmed in 90s — check Solscan");
      const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
      fetch(`${botApi}/api/v1/sync-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_pda: loan.loan_pda, signature: sig }),
      }).catch(() => {});
      setRepaySuccessSig(sig);
      forceRefresh();
    } catch (e: unknown) {
      setRepayError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtendPendingFor(null);
    }
  }, [publicKey, connected, connection, sendTransaction, forceRefresh]);

  // Topup handler: add more collateral to an existing loan.
  // Borrower-only signature. Uses same Max-captures-exact-raw pattern as /earn
  // to avoid display-rounding bugs.
  const handleTopup = useCallback(async (loan: Loan, rawAmount: bigint) => {
    if (!publicKey || !connected) return;
    if (rawAmount <= 0n) {
      setRepayError("Topup amount must be > 0");
      return;
    }
    setTopupConfirmFor(null);
    setRepayError(null);
    setRepaySuccessSig(null);
    setTopupPendingFor(loan.loan_pda);
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { PROGRAM_ID } = await import("@/lib/solana/constants");
      const { buildTopupTransaction } = await import("@/lib/solana/topup");
      const programId = loan.program_id ? new PublicKey(loan.program_id) : PROGRAM_ID;
      const { transaction } = await buildTopupTransaction({
        borrower: publicKey,
        loanPda: loan.loan_pda,
        collateralMint: loan.collateral.mint,
        extraRawAmount: rawAmount,
        connection,
        programId,
      });
      const sig = await sendTransaction(transaction, connection);
      const start = Date.now();
      let confirmed = false;
      while (Date.now() - start < 90_000) {
        const status = await connection.getSignatureStatus(sig);
        const s = status?.value;
        if (s?.err) throw new Error(JSON.stringify(s.err));
        if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
          confirmed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!confirmed) throw new Error("Tx not confirmed in 90s — check Solscan");
      const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
      fetch(`${botApi}/api/v1/sync-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_pda: loan.loan_pda, signature: sig }),
      }).catch(() => {});
      setRepaySuccessSig(sig);
      forceRefresh();
    } catch (e: unknown) {
      setRepayError(e instanceof Error ? e.message : String(e));
    } finally {
      setTopupPendingFor(null);
    }
  }, [publicKey, connected, connection, sendTransaction, forceRefresh]);

  // Fetch live credit score — refetches on wallet change AND refreshTrigger
  // bumps (every 2 min OR after any user action that mutates state).
  useEffect(() => {
    if (!connected || !publicKey) { setLiveCredit(null); return; }
    fetch(`/api/v1/credit?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setLiveCredit(d.data); })
      .catch(() => {});
  }, [connected, publicKey, refreshTrigger]);

  // Fetch referral stats — same refresh dependency
  useEffect(() => {
    if (!connected || !publicKey) { setReferrals(null); return; }
    fetch(`/api/v1/referrals?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setReferrals(d.data); })
      .catch(() => {});
  }, [connected, publicKey, refreshTrigger]);

  // Fetch $MAGPIE holder stats — same refresh dependency
  useEffect(() => {
    if (!connected || !publicKey) { setHolders(null); return; }
    fetch(`/api/v1/holders?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setHolders(d.data?.data ?? d.data ?? null); })
      .catch(() => {});
  }, [connected, publicKey, refreshTrigger]);

  // Fetch LP loyalty stats — same refresh dependency
  useEffect(() => {
    if (!connected || !publicKey) { setLpLoyalty(null); return; }
    fetch(`/api/v1/lp-loyalty?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setLpLoyalty(d.data?.data ?? d.data ?? null); })
      .catch(() => {});
  }, [connected, publicKey, refreshTrigger]);

  // Fetch LP position (on-chain depositor PDA) when wallet connected.
  // Same call as the /earn page — but here we surface it inline so users
  // don't have to leave the dashboard to see their LP yield.
  useEffect(() => {
    if (!connected || !publicKey) { setLpPosition(null); return; }
    let cancelled = false;
    fetchDepositorPosition(connection, publicKey)
      .then(pos => { if (!cancelled) setLpPosition(pos); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [connected, publicKey, connection]);

  // Self-heal any on-chain loans missing from the DB. Runs once on
  // connect — scans the user's wallet for loans that landed on-chain
  // (e.g. from a site borrow whose post-submit recordLoan hit an RPC
  // propagation race) and inserts them. Fail-soft: the endpoint is
  // rate-limited and any failure is silent. Without this, a missing
  // loan stays invisible in /stats / activity / credit forever.
  useEffect(() => {
    if (!connected || !publicKey) return;
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
    fetch(`${botApi}/api/v1/wallet/backfill-loans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toBase58() }),
    }).catch(() => { /* best-effort */ });
  }, [connected, publicKey]);

  // Fetch active loans + history. Polls every 30s so a freshly-opened or
  // freshly-repaid loan reflects within seconds of returning to the page.
  useEffect(() => {
    if (!connected || !publicKey) {
      setActiveLoans([]); setLoanHistory([]); return;
    }
    let cancelled = false;
    const fetchLoans = () => {
      setLoansLoading(true);
      fetch(`/api/v1/loans?wallet=${publicKey.toBase58()}`)
        .then(r => r.json())
        .then(d => {
          if (cancelled || !d.ok) return;
          setActiveLoans(d.active ?? []);
          setLoanHistory(d.history ?? []);
          setOtherWalletsActiveCount(
            typeof d.other_wallets_active_count === "number" ? d.other_wallets_active_count : 0,
          );
        })
        .catch(() => { /* keep last good data on transient failure */ })
        .finally(() => { if (!cancelled) setLoansLoading(false); });
    };
    fetchLoans();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchLoans();
    }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, refreshTrigger]);

  // Eligible collateral — single server-computed list, polls every 30s.
  // This is the source of truth for "what can I borrow against".
  useEffect(() => {
    if (!connected || !publicKey) { setEligibleFromApi([]); return; }
    let cancelled = false;
    const walletStr = publicKey.toBase58();
    const fetchEligible = () => {
      fetch(`/api/v1/eligible-collateral?wallet=${walletStr}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d?.ok) return;
          setEligibleFromApi(d.eligible ?? []);
        })
        .catch(() => { /* keep last good */ });
    };
    fetchEligible();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchEligible();
    }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, refreshTrigger]);

  // Activity feed — repays, borrows, top-ups, extensions, liquidations.
  // Used to compute totalPoints (the credit-event score deltas). The
  // user-visible activity list is rendered by <ActivityFeed/> further
  // down the tree — this fetch is purely for the points calculation.
  // Poll every 60s so a fresh repay shows up shortly after returning to
  // the page.
  //
  // Bot API URL is REQUIRED — the previous version used a relative
  // /api/v1/activity path, which hit the site (which doesn't expose
  // this endpoint) instead of the bot. Result: totalPoints was always
  // 0, and the old inline activity section showed "No activity yet"
  // even when the user had real on-chain history.
  useEffect(() => {
    if (!connected || !publicKey) { setActivity([]); setLifetimePoints(0); return; }
    let cancelled = false;
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
    const fetchActivity = () => {
      fetch(`${botApi}/api/v1/activity?wallet=${publicKey.toBase58()}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.ok) {
            setActivity(d.events ?? []);
            // Use the bot's cumulative total (server-side SUM across
            // entire history) instead of summing limited paged events.
            if (typeof d.total_points === "number") setLifetimePoints(d.total_points);
          }
        })
        .catch(() => { /* keep last good */ });
    };
    fetchActivity();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchActivity();
    }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, refreshTrigger]);

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
    if (!walletFull) return;
    navigator.clipboard.writeText(walletFull).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [walletFull]);

  const scrollTo = useCallback((key: string) => {
    setActiveNav(key);
    if (key === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`section-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Total points = cumulative sum of credit-event deltas across the
  // user's ENTIRE history (repay_ontime +15, repay_early +20, borrow +3,
  // topup +8, liquidations subtract -40, etc).
  //
  // CHANGED 2026-06-12: previously computed from the paged `activity`
  // array via reduce(), which silently under-counted users with > 30
  // lifetime events. The bot's /api/v1/activity now returns a
  // server-side SUM in `total_points` — we use that directly so a
  // user who's done 50 borrows + 50 repays sees the correct ~1000
  // points instead of ~600 (only last 30 counted).
  const totalPoints = lifetimePoints;
  const animatedPoints = useAnimatedCounter(mounted ? totalPoints : 0);

  // Credit display values
  const creditScore = liveCredit?.score ?? 0;
  const creditTier = liveCredit?.tier
    ? liveCredit.tier.charAt(0).toUpperCase() + liveCredit.tier.slice(1)
    : "Unranked";

  /* ─── LOADING: Wait for wallet provider to mount ─── */
  if (!mounted) {
    return (
      <div
        className="flex h-screen items-center justify-center transition-colors duration-300"
        style={{ ...THEMES[theme] as React.CSSProperties, background: "var(--d-bg)", color: "var(--d-ink)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <Mark size={48} className="animate-pulse" />
          <div className="text-sm text-[var(--d-ink-soft)]">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const isConnected = connected && publicKey;
  const installedWallets = wallets.filter((w) => w.readyState === "Installed");

  /* ─── FULL DASHBOARD (zeroed when no wallet) ─── */
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

      {/* ─── Site-repay confirmation modal (feature-flagged) ─── */}
      {SITE_REPAY_ENABLED && repayConfirmFor && (() => {
        const owed = Number(repayConfirmFor.loan.original_amount_lamports ?? 0) / 1e9;
        const repayAmount = (owed * repayPct) / 100;
        const isFull = repayPct === 100;
        const collateralDisplay = (() => {
          const a = repayConfirmFor.collateral.amount;
          const d = repayConfirmFor.collateral.decimals;
          return a && d != null ? formatTokenAmount(a, d) : "—";
        })();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setRepayConfirmFor(null)}>
            <div className="w-full max-w-md rounded-2xl bg-[var(--d-bg-panel)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--d-ink)]">Repay loan</h3>

              {/* Percentage selector */}
              <div className="mt-4 flex gap-1.5">
                {([25, 50, 75, 100] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRepayPct(p)}
                    className={`flex-1 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                      repayPct === p
                        ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-[var(--d-accent-ink)]"
                        : "border-[var(--d-border)] text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                    }`}
                  >
                    {p === 100 ? "Full" : `${p}%`}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-4 rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">You repay</span>
                  <span className="font-mono font-semibold text-[var(--d-ink)]">{repayAmount.toFixed(4)} SOL</span>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">Collateral</span>
                  <span className="font-mono text-[var(--d-ink)]">
                    {isFull ? "returns to wallet" : "stays locked"}
                  </span>
                </div>
                {isFull && (
                  <div className="mt-1.5 text-[11px] text-[var(--d-ink-faint)]">
                    {collateralDisplay} {repayConfirmFor.collateral.symbol || "tokens"}
                  </div>
                )}
              </div>

              {/* Explanation when partial is selected */}
              {!isFull && (
                <p className="mt-3 text-xs text-[var(--d-ink-faint)] leading-relaxed">
                  Partial repay pays down the debt and lowers your liquidation risk, but the loan stays open and the collateral stays locked. To get collateral back, pick &ldquo;Full&rdquo;.
                </p>
              )}

              <p className="mt-3 text-[11px] text-[var(--d-ink-faint)]">
                Wallet popup is next. Amounts come from the on-chain loan state — never a stored display value.
              </p>

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={() => setRepayConfirmFor(null)}
                  className="rounded-md border border-[var(--d-border)] px-3 py-2 text-sm font-medium text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRepay(repayConfirmFor, repayPct)}
                  className="rounded-md bg-[var(--d-accent)] px-3 py-2 text-sm font-semibold text-[var(--d-accent-ink)] hover:brightness-110"
                >
                  {isFull ? "Sign & repay full" : `Sign & repay ${repayPct}%`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Extend confirmation modal (feature-flagged) ─── */}
      {SITE_REPAY_ENABLED && extendConfirmFor && (() => {
        const owed = Number(extendConfirmFor.loan.original_amount_lamports ?? 0) / 1e9;
        const ltv = extendConfirmFor.loan.ltv_percentage;
        // Fee per LTV bracket. 2026-06-13: V2 program's on-chain LTV
        // ladder is identical to V1 (30/25/20% — see bot mig 056), so
        // both memecoin and RWA loans share the same fee schedule.
        const feePct =
          ltv >= 30 ? 0.030 :   // Express (option 0)
          ltv >= 25 ? 0.020 :   // Quick (option 1)
                     0.015;     // Standard (option 2, 20%)
        const feeSol = owed * feePct;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setExtendConfirmFor(null)}>
            <div className="w-full max-w-md rounded-2xl bg-[var(--d-bg-panel)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--d-ink)]">Extend loan</h3>
              <p className="mt-2 text-sm text-[var(--d-ink-soft)]">
                Renews this loan for another full duration ({extendConfirmFor.loan.duration_days}d). If past-due, the clock resets from now.
              </p>
              <div className="mt-4 rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">Extend fee ({(feePct * 100).toFixed(1)}% of owed)</span>
                  <span className="font-mono font-semibold text-[var(--d-ink)]">{feeSol.toFixed(4)} SOL</span>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">New due in</span>
                  <span className="font-mono text-[var(--d-ink)]">~{extendConfirmFor.loan.duration_days} days</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[var(--d-ink-faint)]">
                The exact fee is computed from on-chain state at sign time, not the display value above.
              </p>
              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={() => setExtendConfirmFor(null)}
                  className="rounded-md border border-[var(--d-border)] px-3 py-2 text-sm font-medium text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExtend(extendConfirmFor)}
                  className="rounded-md bg-[var(--d-accent)] px-3 py-2 text-sm font-semibold text-[var(--d-accent-ink)] hover:brightness-110"
                >
                  Sign & extend
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Topup modal (feature-flagged) ─── */}
      {SITE_REPAY_ENABLED && topupConfirmFor && (() => {
        const loan = topupConfirmFor;
        const decimals = loan.collateral.decimals ?? 6;
        const symbol = loan.collateral.symbol || "tokens";
        const holding = holdings.find((h) => h.mint === loan.collateral.mint);
        const maxRawAvailable = holding ? BigInt(holding.amount) : 0n;
        // Compute the raw amount the user actually wants — prefer the
        // exact captured value from Max click, fall back to parsing the
        // typed string (with float→BigInt conversion only at submit).
        let intendedRaw: bigint = 0n;
        if (topupMaxRaw != null) {
          intendedRaw = topupMaxRaw;
        } else {
          const parsed = parseFloat(topupAmountStr);
          if (Number.isFinite(parsed) && parsed > 0) {
            intendedRaw = BigInt(Math.floor(parsed * Math.pow(10, decimals)));
          }
        }
        // Hard clamp to wallet balance — prevents over-asking
        if (intendedRaw > maxRawAvailable) intendedRaw = maxRawAvailable;
        const intendedUi = Number(intendedRaw) / Math.pow(10, decimals);
        const maxUi = Number(maxRawAvailable) / Math.pow(10, decimals);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setTopupConfirmFor(null)}>
            <div className="w-full max-w-md rounded-2xl bg-[var(--d-bg-panel)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--d-ink)]">Add collateral</h3>
              <p className="mt-2 text-sm text-[var(--d-ink-soft)]">
                Add more {symbol} to this loan&apos;s collateral vault. Lowers your effective LTV. Free (just tx fees).
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[var(--d-ink-soft)]">Amount ({symbol})</label>
                  <button
                    onClick={() => {
                      setTopupMaxRaw(maxRawAvailable);
                      setTopupAmountStr((Math.floor(Number(maxRawAvailable) / Math.pow(10, decimals - 4)) / 1e4).toFixed(4));
                    }}
                    className="text-[11px] font-medium text-[var(--d-accent-deep)] hover:text-[var(--d-accent)]"
                  >
                    Max: {maxUi.toFixed(4)}
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={topupAmountStr}
                  onChange={(e) => { setTopupAmountStr(e.target.value); setTopupMaxRaw(null); }}
                  className="w-full rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--d-accent)]"
                />
                {maxRawAvailable === 0n && (
                  <p className="mt-1.5 text-[11px] text-[var(--d-bad)]">You don&apos;t hold any {symbol} in this wallet right now.</p>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">Adding</span>
                  <span className="font-mono font-semibold text-[var(--d-ink)]">{intendedUi.toFixed(4)} {symbol}</span>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-[var(--d-ink-soft)]">Current collateral</span>
                  <span className="font-mono text-[var(--d-ink-soft)]">
                    {(() => { const a = loan.collateral.amount; const d = loan.collateral.decimals; return a && d != null ? formatTokenAmount(a, d) : "—"; })()} {symbol}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={() => setTopupConfirmFor(null)}
                  className="rounded-md border border-[var(--d-border)] px-3 py-2 text-sm font-medium text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTopup(loan, intendedRaw)}
                  disabled={intendedRaw <= 0n}
                  className="rounded-md bg-[var(--d-accent)] px-3 py-2 text-sm font-semibold text-[var(--d-accent-ink)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign & add
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Site-repay success/error toast (feature-flagged) ─── */}
      {SITE_REPAY_ENABLED && (repaySuccessSig || repayError) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-[var(--d-bg-panel)] p-4 shadow-2xl border border-[var(--d-border)]">
          {repaySuccessSig && (
            <>
              <div className="text-sm font-semibold text-emerald-600">Repay confirmed</div>
              <div className="mt-1 text-xs text-[var(--d-ink-soft)]">
                Collateral returned to your wallet.{" "}
                <a href={`https://solscan.io/tx/${repaySuccessSig}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--d-ink)]">
                  View tx
                </a>
              </div>
              <button onClick={() => setRepaySuccessSig(null)} aria-label="Dismiss success notice" className="absolute top-2 right-2 text-[var(--d-ink-faint)] hover:text-[var(--d-ink)]">×</button>
            </>
          )}
          {repayError && (
            <>
              <div className="text-sm font-semibold text-red-500">Repay failed</div>
              <div className="mt-1 text-xs text-[var(--d-ink-soft)] break-words">{repayError.slice(0, 200)}</div>
              <p className="mt-2 text-[11px] text-[var(--d-ink-faint)]">Your funds are safe. Try again — if this keeps happening, ask Pip or open a support ticket.</p>
              <button onClick={() => setRepayError(null)} aria-label="Dismiss error notice" className="absolute top-2 right-2 text-[var(--d-ink-faint)] hover:text-[var(--d-ink)]">×</button>
            </>
          )}
        </div>
      )}

      {/* ─── MAIN AREA ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ─── TOP BAR ─── */}
        <header className="flex items-center justify-between border-b border-[var(--d-border)] bg-[var(--d-bg-panel)] px-4 py-3 md:px-6">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)]"
              aria-label="Open menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/"><Mark size={22} /></Link>
          </div>

          {/* Left: wallet or connect prompt */}
          <div className="hidden md:flex items-center gap-3">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--d-surface)] px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--d-accent)] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--d-accent)]" />
                  </span>
                  <span className="text-xs text-[var(--d-ink-soft)] tracking-wide">{walletDisplay}</span>
                  <button onClick={handleCopy} aria-label={copied ? "Wallet address copied" : "Copy wallet address"} className="flex h-5 w-5 items-center justify-center rounded transition hover:bg-[var(--hairline)]" title="Copy">
                    {copied ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                  </button>
                </div>
                <div className="h-4 w-px bg-[var(--hairline)]" />
                <span className="text-xs text-[var(--d-ink-soft)]">
                  <span className="font-semibold text-[var(--d-ink)]">{solBalance.toFixed(4)} SOL</span>
                </span>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--d-surface)] px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--d-ink-faint)]" />
                </span>
                <span className="text-xs text-[var(--d-ink-faint)]">No wallet connected</span>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Wallet connect/disconnect */}
            {isConnected ? (
              <button
                onClick={() => disconnect()}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--d-border)] px-3 py-1.5 text-xs text-[var(--d-ink-soft)] transition hover:border-[var(--d-border-strong)] hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
              >
                {walletDisplay}
              </button>
            ) : installedWallets.length > 0 ? (
              <button
                onClick={() => select(installedWallets[0].adapter.name)}
                disabled={connecting}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[var(--d-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <a
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[var(--d-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]"
              >
                Get Wallet
              </a>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
              aria-label="Customize dashboard sections"
              className="flex items-center gap-1.5 rounded-xl border border-[var(--d-border)] px-3 py-1.5 text-xs text-[var(--d-ink-soft)] transition hover:border-[var(--d-border-strong)] hover:bg-[var(--d-surface-hover)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="hidden sm:inline">Customize</span>
            </button>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Magpie Telegram bot in a new tab" className="flex items-center gap-1.5 rounded-xl bg-[var(--d-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" /></svg>
              <span className="hidden sm:inline">Open Bot</span>
            </a>
          </div>
        </header>

        {/* ─── MOBILE MENU ─── */}
        <MobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
          wallet={walletDisplay}
          solBalance={solBalance}
          onCopy={handleCopy}
          copied={copied}
          onScrollTo={(key: string) => { scrollTo(key); setMobileMenuOpen(false); }}
        />

        {/* ─── CUSTOMIZE PANEL ─── */}
        <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} prefs={prefs} onToggle={toggleSection} />

        {/* ─── SCROLLABLE CONTENT ─── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">

            {/* ─── CONNECT BANNER (when no wallet) ─── */}
            {!isConnected && (
              <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/40 px-6 py-5">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Connect your wallet to get started</h2>
                  <p className="mt-1 text-sm text-[var(--d-ink-soft)]">View your balances, credit score, and borrow against your memecoins.</p>
                </div>
                <div className="flex items-center gap-2">
                  {installedWallets.length > 0 ? (
                    installedWallets.map((wallet) => (
                      <button
                        key={wallet.adapter.name}
                        onClick={() => select(wallet.adapter.name)}
                        disabled={connecting}
                        className="flex items-center gap-2 rounded-xl bg-[var(--d-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={wallet.adapter.icon} alt={wallet.adapter.name} width={20} height={20} className="rounded" />
                        {connecting ? "Connecting..." : wallet.adapter.name}
                      </button>
                    ))
                  ) : (
                    <a
                      href="https://phantom.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-[var(--d-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]"
                    >
                      Install Phantom
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ─── TOTAL EARNED — aggregates LP + Referral + Holder rewards ─── */}
            {(() => {
              const lpEarned = lpPosition ? Math.max(0, lpPosition.yieldEarned) / LAMPORTS_PER_SOL : 0;
              const referralEarned = referrals ? Number(referrals.lifetime_lamports) / LAMPORTS_PER_SOL : 0;
              const holderEarned = holders ? Number(holders.paid_lamports) / LAMPORTS_PER_SOL : 0;
              const totalEarned = lpEarned + referralEarned + holderEarned;
              if (totalEarned <= 0) return null;
              return (
                <div className="mb-6 rounded-2xl border border-[var(--d-accent)]/30 bg-[var(--d-accent-dim)]/40 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-accent-deep)]">
                        Lifetime earned across Magpie
                      </div>
                      <div className="mt-1 font-display text-3xl font-semibold text-[var(--d-ink)] sm:text-4xl">
                        {totalEarned.toFixed(6)} SOL
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs sm:gap-5">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">LP yield</div>
                        <div className="mt-0.5 font-mono text-sm text-[var(--d-ink)]">{lpEarned.toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">Referrals</div>
                        <div className="mt-0.5 font-mono text-sm text-[var(--d-ink)]">{referralEarned.toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">Holder</div>
                        <div className="mt-0.5 font-mono text-sm text-[var(--d-ink)]">{holderEarned.toFixed(4)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── KPI CARDS ROW ─── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(() => {
                const totalOwedLamports = activeLoans.reduce(
                  (sum, l) => sum + BigInt(l.loan.original_amount_lamports ?? "0"),
                  0n,
                );
                const totalOwedSol = Number(totalOwedLamports) / LAMPORTS_PER_SOL;
                return [
                  { label: "SOL Balance", value: solBalance.toFixed(4), sub: "SOL", accent: false },
                  { label: "Holdings", value: `${holdings.length}`, sub: "SPL tokens", accent: false },
                  { label: "Eligible Collateral", value: `${eligibleCollateral.length}`, sub: totalEligibleUsd > 0 ? `$${totalEligibleUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "No eligible tokens", accent: eligibleCollateral.length > 0 },
                  { label: "Active Loans", value: `${activeLoans.length}`, sub: activeLoans.length > 0 ? "outstanding" : "No active loans", accent: activeLoans.length > 0 },
                  { label: "Total Owed", value: `${totalOwedSol.toFixed(4)} SOL`, sub: totalOwedSol > 0 ? "outstanding" : "No debt", accent: totalOwedSol > 0 },
                  { label: "Credit Score", value: `${creditScore}`, sub: `${creditTier} tier`, accent: true },
                ];
              })().map((kpi) => (
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
              <DashboardProvider botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}>
              <div className="xl:col-span-8 flex flex-col gap-6">

                {/* Global site-disabled banner — visible to everyone when the operator has flipped the kill-switch. */}
                <SiteStatusBanner botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""} />

                {/* API uptime banner — shows when the bot's Railway service is unreachable
                    or degraded so users see a clear "Magpie API is recovering" instead of
                    silently-failing forms. Self-clearing as soon as the bot is healthy. */}
                <ApiHealthBanner />

                {/* TG link status — invisible until response comes back, then either ✓ banner or button */}
                {connected && publicKey && (
                  <LinkToTelegram
                    wallet={publicKey.toBase58()}
                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                  />
                )}

                {/* Custodial wallet management — only renders for linked users. */}
                {connected && publicKey && (
                  <CustodialWithdraw
                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                  />
                )}

                {/* Wallets list — only renders for linked users with 2+ wallets. */}
                {connected && publicKey && (
                  <div id="section-wallets">
                    <WalletsList
                      botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                    />
                  </div>
                )}

                {/* Activity moved to the right column (below the
                    $MAGPIE Holders card) per operator-stated layout —
                    Active Loans is the main thing the user came to do;
                    the Activity feed is reference info that belongs
                    alongside the credit / holders / lp stack on the
                    right. The section-activity anchor still resolves
                    in the side nav because the moved element retains
                    the same id. */}

                {/* Earnings summary (referrals + holder + LP yield) —
                    hides if user has zero across all three. */}
                {connected && publicKey && (
                  <EarningsCard
                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                  />
                )}

                {/* (Floating AI chat is rendered at the page root —
                    see below — so no ancestor transform/overflow can
                    affect its fixed positioning.) */}

                {/* Support tickets — renders an "Ask a question" composer
                    plus any existing tickets the user has. Needs a real bot
                    API URL (the other dashboard child components were
                    reverted to empty URL after producing visual surprises,
                    but the ticket surface MUST function for non-TG users —
                    that's now their only way to reach support). */}
                {connected && publicKey && (
                  <SupportTickets
                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app"}
                  />
                )}

                {/* ACTIVE LOANS */}
                {prefs.activeLoans && (
                  <div id="section-activeLoans">
                    <SectionHeader title="Active Loans" count={activeLoans.length} />
                    {loansLoading && activeLoans.length === 0 ? (
                      <SkeletonRows count={3} />
                    ) : activeLoans.length === 0 ? (
                      <>
                        <EmptyState
                          message={
                            otherWalletsActiveCount > 0
                              ? `No active loans on this wallet — ${otherWalletsActiveCount} loan${otherWalletsActiveCount === 1 ? "" : "s"} on another linked wallet`
                              : eligibleCollateral.length > 0
                                ? "No active loans — pick a token in Eligible Collateral below to borrow"
                                : "No active loans — deposit a supported token to use as collateral"
                          }
                          cta={
                            otherWalletsActiveCount > 0
                              ? { label: "Switch wallets", onClick: () => scrollTo("wallets") }
                              : eligibleCollateral.length > 0
                                ? { label: "Scroll to collateral", onClick: () => scrollTo("eligible") }
                                : undefined
                          }
                        />
                      </>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-[var(--d-accent)]/20 bg-[var(--d-bg-card)]">
                        <div className="border-b border-[var(--d-border)] bg-[var(--d-accent-dim)]/30 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-medium text-[var(--d-accent-deep)]">
                            {activeLoans.length} loan{activeLoans.length !== 1 ? "s" : ""} outstanding
                          </span>
                          {otherWalletsActiveCount > 0 && (
                            <button
                              type="button"
                              onClick={() => scrollTo("wallets")}
                              className="text-[11px] text-[var(--d-ink-faint)] hover:text-[var(--d-ink-soft)] underline underline-offset-2"
                              title="Switch to that wallet to see + manage those loans"
                            >
                              +{otherWalletsActiveCount} on another wallet →
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-[var(--d-border)]">
                          {activeLoans.map((l) => {
                            const owedSol = Number(BigInt(l.loan.original_amount_lamports ?? "0")) / LAMPORTS_PER_SOL;
                            const due = new Date(l.timestamps.due_at);
                            const msLeft = due.getTime() - Date.now();
                            const dueLabel = msLeft <= 0
                              ? `Overdue by ${Math.floor(-msLeft / 86_400_000)}d`
                              : msLeft < 86_400_000
                                ? `Due in ${Math.floor(msLeft / 3_600_000)}h`
                                : `Due in ${Math.floor(msLeft / 86_400_000)}d`;
                            const overdue = msLeft <= 0;

                            // Live health snapshot. Color-band the badge so users see
                            // their risk at a glance: green safe, amber tight, red danger.
                            // Thresholds: <1.20x = danger (close to 1.10x liquidation),
                            //             1.20-1.50x = tight, >1.50x = healthy.
                            const h = l.health?.ratio ?? null;
                            const healthBand = h == null
                              ? { txt: "text-[var(--d-ink-faint)]", bg: "bg-transparent", label: "—" }
                              : h < 1.20
                                ? { txt: "text-red-500", bg: "bg-red-500/10 border border-red-500/30", label: `${h.toFixed(2)}x · danger` }
                                : h < 1.50
                                  ? { txt: "text-amber-500", bg: "bg-amber-500/10 border border-amber-500/30", label: `${h.toFixed(2)}x · tight` }
                                  : { txt: "text-emerald-500", bg: "bg-emerald-500/10 border border-emerald-500/30", label: `${h.toFixed(2)}x · healthy` };

                            return (
                              <div
                                key={l.loan_pda}
                                id={`loan-${l.loan_id ?? l.loan_pda}`}
                                data-loan-id={String(l.loan_id ?? l.loan_pda)}
                                className="px-4 py-3 transition-colors duration-500"
                              >
                                <div className="flex items-center gap-3">
                                <TokenIcon mint={l.collateral.mint} symbol={l.collateral.symbol || "?"} size={32} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-[14px]">{l.collateral.symbol || l.collateral.mint.slice(0, 6)}</span>
                                    <span className="text-[10px] text-[var(--d-ink-faint)]">{l.loan.ltv_percentage}% LTV · {l.loan.duration_days}d</span>
                                    {h != null && (
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${healthBand.bg} ${healthBand.txt}`}
                                        title="Collateral value ÷ amount owed. Below 1.10x triggers auto-liquidation."
                                      >
                                        {healthBand.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--d-ink-soft)]">
                                    {l.collateral.amount && l.collateral.decimals !== null
                                      ? formatTokenAmount(l.collateral.amount, l.collateral.decimals)
                                      : "—"} collateral
                                    {l.health?.liquidation_price_sol != null && (
                                      <>
                                        {" · "}
                                        <span className="text-[var(--d-ink-faint)]">
                                          liq @ {l.health.liquidation_price_sol < 0.000001
                                            ? l.health.liquidation_price_sol.toExponential(2)
                                            : l.health.liquidation_price_sol.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")} SOL
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <div>
                                    <div className="text-[13px] font-semibold">{owedSol.toFixed(4)} SOL</div>
                                    <div className={`text-[10px] ${overdue ? "text-red-500" : "text-[var(--d-ink-faint)]"}`}>{dueLabel}</div>
                                  </div>
                                  {SITE_REPAY_ENABLED && (() => {
                                    const anyPending = repayPendingFor === l.loan_pda || extendPendingFor === l.loan_pda || topupPendingFor === l.loan_pda;
                                    return (
                                      <div className="flex flex-col gap-1">
                                        <button
                                          onClick={() => { setRepayPct(100); setRepayConfirmFor(l); }}
                                          disabled={anyPending}
                                          // text-white on bright accent was too hot in
                                          // dark mode. Use the accent-ink token which
                                          // resolves to the proper high-contrast
                                          // foreground for each theme (dark text on
                                          // light, light-but-not-white on dark).
                                          className="rounded-md bg-[var(--d-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-accent-ink)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {repayPendingFor === l.loan_pda ? "Repaying…" : "Repay"}
                                        </button>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => setExtendConfirmFor(l)}
                                            disabled={anyPending}
                                            className="flex-1 rounded-md border border-[var(--d-border)] px-2 py-1 text-[10px] font-semibold text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {extendPendingFor === l.loan_pda ? "…" : "Extend"}
                                          </button>
                                          <button
                                            onClick={() => { setTopupAmountStr(""); setTopupMaxRaw(null); setTopupConfirmFor(l); }}
                                            disabled={anyPending}
                                            className="flex-1 rounded-md border border-[var(--d-border)] px-2 py-1 text-[10px] font-semibold text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {topupPendingFor === l.loan_pda ? "…" : "Top up"}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                                </div>
                                {l.loan_id && (
                                  <TakeProfitCard
                                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app"}
                                    loanIdChain={String(l.loan_id)}
                                    loanDbId={Number((l as unknown as { id?: number; loan_db_id?: number }).id ?? (l as unknown as { id?: number; loan_db_id?: number }).loan_db_id ?? 0)}
                                    collateralSymbol={l.collateral.symbol}
                                    collateralMint={l.collateral.mint}
                                    state={takeProfitState.state}
                                    onMutated={takeProfitState.refresh}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t border-[var(--d-border)] bg-[var(--d-bg-card)] px-4 py-3 text-center">
                          <a
                            href={TELEGRAM_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[var(--d-ink-faint)] hover:text-[var(--d-accent-deep)] hover:underline"
                          >
                            Prefer Telegram? Manage from @magpie_capital_bot →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ELIGIBLE COLLATERAL */}
                <div id="section-eligible">
                  <SectionHeader title="Eligible Collateral" count={eligibleCollateral.length} />
                  {approvedLoading || holdingsLoading ? (
                    <SkeletonRows count={3} />
                  ) : eligibleCollateral.length === 0 ? (
                    <EmptyState
                      message={holdings.length === 0 ? "No tokens in wallet — deposit supported memecoins to use as collateral" : "None of your tokens are currently eligible as collateral"}
                      cta={{ label: "View approved tokens", href: "/tokens" }}
                    />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-[var(--d-accent)]/20 bg-[var(--d-bg-card)]">
                      <div className="border-b border-[var(--d-border)] bg-[var(--d-accent-dim)]/30 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px]" style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}>&#x2713;</span>
                          <span className="text-xs font-medium text-[var(--d-accent-deep)]">
                            {eligibleCollateral.length} token{eligibleCollateral.length !== 1 ? "s" : ""} eligible &mdash; click to simulate a loan
                          </span>
                        </div>
                        <span className="text-xs text-[var(--d-ink-soft)]">
                          Total: <span className="font-semibold text-[var(--d-ink)]">${totalEligibleUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </span>
                      </div>
                      <div className="divide-y divide-[var(--d-border)]">
                        {eligibleCollateral.map((h, i) => {
                          const uiAmount = Number(h.amount) / Math.pow(10, h.decimals);
                          const isExpanded = expandedMint === h.mint;
                          const pct = loanPercent[h.mint] ?? 100;
                          const collateralUsd = h.valueUsd * (pct / 100);
                          // Tier ladder by category. First-choice source is
                          // the bot's /api/v1/loan-tiers endpoint (fetched on
                          // mount, cached in tiersByCategory). When the API
                          // is unreachable — e.g. before the bot ships the
                          // endpoint, or transient outage — we fall back to
                          // hardcoded constants that mirror migration 040's
                          // seed values. The bot's cosign-borrow.js does the
                          // authoritative LTV math; this is purely the
                          // preview number the user sees.
                          const isRwa = h.category === "stock" || h.category === "etf" || h.category === "metal";
                          const apiCategory = isRwa ? "stock" : "memecoin";
                          const apiTiers = tiersByCategory[apiCategory];
                          const memeApiTiers = tiersByCategory["memecoin"];
                          // 2026-06-13: detect when the API returns the same
                          // ladder for both categories (post mig 056). When
                          // unified, drop the "RWA" prefix from tier names —
                          // it'd just confuse users into thinking the numbers
                          // differ when they don't. When divergent (post v3
                          // routing), prefix returns automatically.
                          const isUnifiedLadder = isRwa && apiTiers && memeApiTiers
                            && apiTiers.length === memeApiTiers.length
                            && apiTiers.every((t, i) =>
                              t.ltv_pct === memeApiTiers[i].ltv_pct
                                && t.duration_days === memeApiTiers[i].duration_days
                                && t.fee_bps === memeApiTiers[i].fee_bps);
                          // Color picker matches the previous ladder semantics:
                          // Express = highest LTV / shortest term / highest fee → bad
                          // Quick = mid → warn
                          // Standard = lowest LTV / longest term / lowest fee → accent
                          const colorForIdx = (idx: number, total: number) =>
                            idx === 0 ? "var(--d-bad)" :
                            idx === total - 1 ? "var(--d-accent)" :
                            "var(--d-warn)";
                          // Truthful tag text derived from real API values
                          // rather than the prior memecoin/RWA fork which
                          // hardcoded 15d/30d copy that didn't match what
                          // V2 actually delivered. Derives "days" labels
                          // from the live tier data so it can never drift.
                          const tagForIdx = (idx: number, total: number, t: { duration_days: number }) =>
                            idx === 0 ? `Fast cash, ${t.duration_days}-day term`
                              : idx === total - 1 ? `Best rate, ${t.duration_days}-day term`
                              : `Balanced speed & value, ${t.duration_days}-day term`;
                          const tiers = apiTiers
                            ? apiTiers.map((t, idx) => ({
                                // When ladders are unified, use the plain tier
                                // names (Express/Quick/Standard). When divergent
                                // (v3+), preserve the "RWA" prefix that the API
                                // label naturally provides.
                                name: isUnifiedLadder
                                  ? (["Express","Quick","Standard"][idx] ?? "Tier")
                                  : (t.label.split("(").pop()?.replace(")", "") || (isRwa ? `RWA ${["Express","Quick","Standard"][idx] ?? "Tier"}` : ["Express","Quick","Standard"][idx] ?? "Tier")),
                                tag: tagForIdx(idx, apiTiers.length, t),
                                ltv: t.ltv_pct / 100,
                                days: t.duration_days,
                                fee: t.fee_bps / 10_000,
                                color: colorForIdx(idx, apiTiers.length),
                              }))
                            : isRwa
                              ? [
                                  // 2026-06-13 realigned to V2 on-chain LTV ladder (30/25/20%)
                                  // — see bot mig 056. Truly higher RWA LTVs require V3.
                                  { name: "RWA Express", tag: "Fast cash, premium rate", ltv: 0.30, days: 2, fee: 0.030, color: "var(--d-warn)" },
                                  { name: "RWA Quick", tag: "Balanced speed & value", ltv: 0.25, days: 3, fee: 0.020, color: "var(--d-accent)" },
                                  { name: "RWA Standard", tag: "Best rate, more time to repay", ltv: 0.20, days: 7, fee: 0.015, color: "var(--d-accent)" },
                                ]
                              : [
                                  { name: "Express", tag: "Fast cash, premium rate", ltv: 0.30, days: 2, fee: 0.03, color: "var(--d-bad)" },
                                  { name: "Quick", tag: "Balanced speed & value", ltv: 0.25, days: 3, fee: 0.02, color: "var(--d-warn)" },
                                  { name: "Standard", tag: "Best rate, more time to repay", ltv: 0.20, days: 7, fee: 0.015, color: "var(--d-accent)" },
                                ];
                          return (
                            <div key={h.mint} data-holding-mint={h.mint}>
                              {/* Row */}
                              <button
                                onClick={() => setExpandedMint(isExpanded ? null : h.mint)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--d-surface-hover)]/40 ${i % 2 === 1 && !isExpanded ? "bg-[var(--d-surface)]/20" : ""} ${isExpanded ? "bg-[var(--d-accent-dim)]/20" : ""}`}
                              >
                                <TokenIcon mint={h.mint} symbol={h.symbol} size={32} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{h.symbol}</span>
                                    {/* Category badge — makes the asset type
                                        visible at a glance so users can't
                                        confuse a memecoin with the same
                                        ticker as a tokenized stock (and
                                        vice versa). Operator-mandated
                                        2026-06-14 collision defense. */}
                                    {h.category === "stock" && (
                                      <span className="rounded-full bg-[var(--d-accent-dim)] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wider text-[var(--d-accent-deep)]" title="Tokenized stock — v3 RWA tiers">Stock</span>
                                    )}
                                    {h.category === "etf" && (
                                      <span className="rounded-full bg-[var(--d-accent-dim)] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wider text-[var(--d-accent-deep)]" title="Tokenized ETF — v3 RWA tiers">ETF</span>
                                    )}
                                    {h.category === "metal" && (
                                      <span className="rounded-full bg-[var(--d-accent-dim)] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wider text-[var(--d-accent-deep)]" title="Tokenized metal — v3 RWA tiers">Metal</span>
                                    )}
                                    {h.category === "memecoin" && (
                                      <span className="rounded-full bg-[var(--d-warn-dim)] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wider text-[var(--d-warn-deep)]" title="Memecoin — v1 tiers (2/3/7-day)">Memecoin</span>
                                    )}
                                    <span className="text-[10px] text-[var(--d-ink-faint)] hidden sm:inline">{h.name}</span>
                                  </div>
                                  <div className="text-[11px] text-[var(--d-ink-soft)] flex flex-wrap items-center gap-x-2">
                                    <span>{formatTokenAmount(h.amount, h.decimals)} tokens
                                    {h.approved.priceUsd ? ` · $${h.approved.priceUsd < 0.01 ? h.approved.priceUsd.toPrecision(4) : h.approved.priceUsd.toFixed(4)}` : ""}</span>
                                    {/* Mint suffix — disambiguates two tokens
                                        with the same ticker. Truncated for
                                        readability; full mint is on hover. */}
                                    <span className="text-[10px] text-[var(--d-ink-faint)] font-mono" title={h.mint}>{h.mint.slice(0, 4)}…{h.mint.slice(-4)}</span>
                                  </div>
                                  {/* Risk-preview strip — surfaces token
                                      fundamentals before the user commits
                                      to a borrow. Liquidity depth + 24h
                                      change are the two cleanest signals
                                      for "is this safe to collateralize?"
                                      Renders only when DexScreener returned
                                      data (most approved tokens) so it
                                      doesn't show a fake "deep" tier for
                                      tokens we can't price. */}
                                  {(h.approved.liquidity != null || h.approved.priceChange24h != null) && (
                                    <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                      {h.approved.liquidity != null && (() => {
                                        const liq = h.approved.liquidity!;
                                        const tier = liq >= 250_000 ? "Deep" : liq >= 50_000 ? "Mid" : "Thin";
                                        const color = liq >= 250_000
                                          ? "var(--d-accent-deep)"
                                          : liq >= 50_000
                                            ? "var(--d-warn)"
                                            : "var(--d-bad)";
                                        const liqLabel = liq >= 1_000_000
                                          ? `$${(liq / 1_000_000).toFixed(1)}M`
                                          : liq >= 1_000
                                            ? `$${(liq / 1_000).toFixed(0)}k`
                                            : `$${liq.toFixed(0)}`;
                                        return (
                                          <span style={{ color }}>
                                            ●&nbsp;{tier} liquidity · {liqLabel}
                                          </span>
                                        );
                                      })()}
                                      {h.approved.priceChange24h != null && (
                                        <span style={{
                                          color: h.approved.priceChange24h >= 0
                                            ? "var(--d-accent-deep)"
                                            : "var(--d-bad)",
                                        }}>
                                          {h.approved.priceChange24h >= 0 ? "▲" : "▼"}&nbsp;
                                          {h.approved.priceChange24h >= 0 ? "+" : ""}
                                          {h.approved.priceChange24h.toFixed(1)}% 24h
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-semibold">
                                    {h.valueUsd > 0 ? `$${h.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                                  </div>
                                  <div className="text-[10px] text-[var(--d-accent-deep)] font-medium">
                                    up to ${(h.valueUsd * 0.30).toLocaleString(undefined, { maximumFractionDigits: 2 })} loan
                                  </div>
                                </div>
                                <svg
                                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round"
                                  className="shrink-0 transition-transform duration-200"
                                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>

                              {/* Expanded loan simulator */}
                              {isExpanded && (
                                <div className="border-t border-[var(--d-border)] bg-[var(--d-surface)]/30 px-4 py-5 sm:px-6">
                                  {/* Collateral slider — was being missed
                                      by users because the visual was too
                                      subtle (small "Collateral amount"
                                      label, thin track). Users defaulted
                                      to 100% without realizing they could
                                      pledge less. Redesigned with an
                                      explicit question heading, prominent
                                      live amount, hint copy, and chip-
                                      style quick-pick buttons so the
                                      interaction is unmistakable. */}
                                  <div className="mb-5 rounded-xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-3.5">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-semibold text-[var(--d-ink)]">How much do you want to pledge?</span>
                                      <span className="text-xs font-bold tabular-nums" style={{ color: "var(--d-accent-deep)" }}>
                                        {pct}%
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-[var(--d-ink-soft)] mb-2.5">
                                      Using <span className="font-semibold text-[var(--d-ink)]">{(uiAmount * pct / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} {h.symbol}</span> of your {uiAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {h.symbol} — drag or pick a preset to change.
                                    </div>
                                    <input
                                      type="range"
                                      min={10}
                                      max={100}
                                      step={5}
                                      value={pct}
                                      onChange={(e) => setLoanPercent((prev) => ({ ...prev, [h.mint]: Number(e.target.value) }))}
                                      className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, var(--d-accent) 0%, var(--d-accent) ${pct}%, var(--d-border) ${pct}%, var(--d-border) 100%)`,
                                      }}
                                    />
                                    <div className="flex gap-2 mt-2.5">
                                      {[25, 50, 75, 100].map((v) => (
                                        <button
                                          key={v}
                                          onClick={() => setLoanPercent((prev) => ({ ...prev, [h.mint]: v }))}
                                          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition border ${
                                            pct === v
                                              ? "bg-[var(--d-accent)] text-[var(--d-accent-ink)] border-[var(--d-accent)]"
                                              : "text-[var(--d-ink-soft)] border-[var(--d-border)] hover:border-[var(--d-accent)] hover:text-[var(--d-ink)]"
                                          }`}
                                        >
                                          {v}%
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Tier + per-token cap info strip.
                                      Tells the user up front what tier
                                      this token is in and how much
                                      borrowing capacity is left across
                                      the whole protocol — so they don't
                                      sign a borrow and then get rejected
                                      by gate 0 (per_token_cap) at the
                                      bot's anti-exploit layer. The tier
                                      labels mirror the bot's
                                      computeTokenTier output. */}
                                  {(() => {
                                    const tier = h.approved.tier as string | undefined;
                                    if (!tier) return null;
                                    const capSol = h.approved.capSol ?? null;
                                    const openSol = h.approved.openSol ?? 0;
                                    const remaining = h.approved.remainingSol;
                                    const isUnlimited = tier === "unlimited" || capSol === null;
                                    const utilization = !isUnlimited && capSol > 0 ? openSol / capSol : 0;
                                    const tierLabel = {
                                      bluechip: "Bluechip",
                                      large: "Large",
                                      mid: "Mid",
                                      small: "Small",
                                      override: "Pinned",
                                      unlimited: "Unlimited",
                                    }[tier] || tier;
                                    const tierColor = tier === "bluechip"
                                      ? "var(--d-accent-deep)"
                                      : tier === "large"
                                        ? "var(--d-accent-deep)"
                                        : tier === "mid"
                                          ? "var(--d-warn)"
                                          : tier === "unlimited" || tier === "override"
                                            ? "var(--d-accent-deep)"
                                            : "var(--d-ink-soft)";
                                    return (
                                      <div className="mb-3 rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold" style={{ color: tierColor }}>
                                            Tier · {tierLabel}
                                          </span>
                                          <span className="text-[var(--d-ink-soft)]">
                                            {isUnlimited
                                              ? "no protocol cap"
                                              : `${openSol.toFixed(2)} of ${capSol.toFixed(0)} SOL borrowed protocol-wide`}
                                          </span>
                                        </div>
                                        {!isUnlimited && utilization >= 0.75 && (
                                          <span className="font-semibold" style={{ color: utilization >= 0.95 ? "var(--d-bad)" : "var(--d-warn)" }}>
                                            {remaining != null ? `${remaining.toFixed(2)} SOL left` : ""}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Thin-liquidity caution. Renders only
                                      when DexScreener data is available
                                      AND liquidity is genuinely shallow
                                      ($50k threshold matches the
                                      protocol's borrow-time liquidity
                                      floor in services/anti-exploit.js).
                                      Same idea on extreme 24h moves —
                                      if a token is pumping or dumping
                                      hard right now, the user should
                                      pause and think about liquidation
                                      risk before signing. */}
                                  {h.approved.liquidity != null && h.approved.liquidity < 50_000 && (
                                    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
                                      <span className="font-semibold">⚠ Thin liquidity</span> · only ${Math.round(h.approved.liquidity).toLocaleString()} across DEX pools. A repay-time sell could move price more than usual — consider borrowing a smaller % or picking a different token.
                                    </div>
                                  )}
                                  {h.approved.priceChange24h != null && Math.abs(h.approved.priceChange24h) >= 25 && (
                                    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
                                      <span className="font-semibold">⚠ High volatility</span> · {h.approved.priceChange24h >= 0 ? "+" : ""}{h.approved.priceChange24h.toFixed(1)}% in 24h. If price reverses, your loan could approach the liquidation threshold faster than usual.
                                    </div>
                                  )}

                                  {/* Pre-borrow take-profit toggle.
                                      The user picks a multiplier here BEFORE clicking a tier;
                                      handleBorrow auto-arms the take-profit the moment the
                                      borrow tx confirms. Zero extra clicks, one signed message
                                      total (the borrow + the arm both come from the same wallet
                                      session). */}
                                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)]/40 px-3 py-2">
                                    <span className="text-[11px] font-semibold text-[var(--d-ink)]">Auto take-profit:</span>
                                    {[null, 1.5, 2, 3, 5].map((m) => {
                                      const selected = autoTakeProfitMultiplier === m;
                                      const label = m === null ? "Off" : `${m}x`;
                                      return (
                                        <button
                                          key={String(m)}
                                          type="button"
                                          onClick={() => setAutoTakeProfitMultiplier(m)}
                                          className={`px-2 py-1 rounded-md text-[10px] font-semibold transition border ${selected ? "border-[var(--d-accent)] bg-[var(--d-accent)] text-[var(--d-accent-ink)]" : "border-[var(--d-border)] text-[var(--d-ink-faint)] hover:text-[var(--d-ink)]"}`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })}
                                    {autoTakeProfitMultiplier != null && (
                                      <span className="text-[10px] text-[var(--d-ink-faint)] ml-auto">
                                        Will arm at {autoTakeProfitMultiplier}x right after the borrow lands.
                                      </span>
                                    )}
                                  </div>

                                  {/* Tier cards */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {tiers.map((tier, tierIdx) => {
                                      const loanUsd = collateralUsd * tier.ltv;
                                      const feeUsd = loanUsd * tier.fee;
                                      const netUsd = loanUsd - feeUsd;
                                      // "Best value" is the longest-term safest
                                      // tier — last in the ladder for both
                                      // memecoin and RWA paths.
                                      const isBestValue = tierIdx === tiers.length - 1;
                                      return (
                                        <div
                                          key={tier.name}
                                          className={`rounded-xl border bg-[var(--d-bg-card)] p-4 flex flex-col transition hover:shadow-sm ${isBestValue ? "border-[var(--d-accent)]/50 ring-1 ring-[var(--d-accent)]/20" : "border-[var(--d-border)] hover:border-[var(--d-accent)]"}`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tier.color }}>{tier.name}</span>
                                              {isBestValue && (
                                                <span className="inline-flex items-center text-[10px] font-semibold tracking-wide leading-none whitespace-nowrap px-2 py-1 rounded-full bg-[var(--d-accent)] text-[var(--d-accent-ink)]">Best value</span>
                                              )}
                                            </div>
                                            <span className="text-[10px] font-semibold" style={{ color: tier.color }}>{(tier.fee * 100).toFixed(1)}%</span>
                                          </div>
                                          <div className="text-[10px] text-[var(--d-ink-faint)] mb-3 italic">{tier.tag}</div>
                                          <div className="flex-1">
                                            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)]">You receive</div>
                                            <div className="font-display text-xl font-bold tracking-tight mt-0.5">
                                              ${netUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[10px] text-[var(--d-ink-faint)] mt-0.5">
                                              {(tier.ltv * 100).toFixed(0)}% LTV &middot; ${feeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} fee
                                            </div>
                                          </div>
                                          <div className="mt-3 pt-3 border-t border-[var(--d-border)] grid grid-cols-3 gap-2 text-[10px]">
                                            <div>
                                              <div className="text-[var(--d-ink-faint)]">Duration</div>
                                              <div className="font-medium">{tier.days} days</div>
                                            </div>
                                            <div>
                                              <div className="text-[var(--d-ink-faint)]">Collateral</div>
                                              <div className="font-medium">{(uiAmount * pct / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })} {h.symbol}</div>
                                            </div>
                                            <div>
                                              <div className="text-[var(--d-ink-faint)]">Risk</div>
                                              <div className="font-medium">{tierIdx === 0 ? "Higher" : tierIdx === 1 ? "Mid" : "Lower"}</div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleBorrow(h, tierIdx, pct)}
                                            disabled={borrowing || !connected}
                                            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{
                                              background: tier.name === "Standard" ? "var(--d-accent)" : "var(--d-surface)",
                                              color: tier.name === "Standard" ? "var(--d-accent-ink)" : "var(--d-ink)",
                                              border: tier.name === "Standard" ? "none" : "1px solid var(--d-border)",
                                            }}
                                          >
                                            {borrowing ? (
                                              <>
                                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                                                Signing...
                                              </>
                                            ) : (
                                              <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                                                Borrow {tier.name}
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Borrow status messages */}
                                  {borrowTx && (
                                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                                      <div className="text-[11px] text-green-400 leading-relaxed">
                                        <span className="font-semibold">Loan executed!</span> SOL has been sent to your wallet.{" "}
                                        <a href={`https://solscan.io/tx/${borrowTx}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">View transaction</a>
                                        {autoArmedAfterBorrow && (
                                          <>
                                            {" · "}
                                            <span className="font-semibold">Take-profit armed at {autoArmedAfterBorrow.multiplier}x.</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {borrowError && (
                                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                      <p className="text-[11px] text-red-400 leading-relaxed">{borrowError}</p>
                                    </div>
                                  )}

                                  {/* Post-borrow take-profit prompt — appears right after a successful
                                      borrow so the user can lock in upside in one tap, without leaving
                                      the dashboard. Matches the mental model: "I want SOL now AND if it
                                      moons to 2x/4x I want to lock that in — without babysitting a chart." */}
                                  {postBorrowTakeProfit && borrowTx && (
                                    <div className="mt-3 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)]/60 px-3 py-3">
                                      <div className="flex items-start gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M12 2v20M2 12h20" /></svg>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[11px] text-[var(--d-ink)] font-semibold">Protect this loan?</div>
                                          <div className="text-[10px] text-[var(--d-ink-faint)] mt-0.5 leading-relaxed">
                                            Auto-close + sell {postBorrowTakeProfit.collateralSymbol} when price hits your floor or ceiling. Each row signs independently — tap one or both.
                                          </div>
                                          {/* Take-profit row */}
                                          <div className="mt-2.5">
                                            <div className="text-[10px] text-[var(--d-ink-faint)] mb-1 font-medium">Take-profit</div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {[1.5, 2, 3, 5].map((m) => (
                                                <button
                                                  key={`tp-${m}`}
                                                  type="button"
                                                  disabled={postBorrowTpBusy}
                                                  onClick={() => armPostBorrowTakeProfit(m)}
                                                  className="px-2.5 py-1 rounded-md border border-[var(--d-border)] text-[10px] font-semibold hover:bg-[var(--d-surface)] disabled:opacity-50"
                                                  style={{ color: "rgb(34,197,94)" }}
                                                >
                                                  {postBorrowTpBusy ? "Signing..." : `Sell at ${m}×`}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          {/* Stop-loss row */}
                                          <div className="mt-2.5">
                                            <div className="text-[10px] text-[var(--d-ink-faint)] mb-1 font-medium">Stop-loss</div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {[0.9, 0.8, 0.7, 0.5].map((m) => (
                                                <button
                                                  key={`sl-${m}`}
                                                  type="button"
                                                  disabled={postBorrowTpBusy}
                                                  onClick={() => armPostBorrowStopLoss(m)}
                                                  className="px-2.5 py-1 rounded-md border border-[var(--d-border)] text-[10px] font-semibold hover:bg-[var(--d-surface)] disabled:opacity-50"
                                                  style={{ color: "rgb(220,38,38)" }}
                                                >
                                                  {postBorrowTpBusy ? "Signing..." : `Floor at ${m}×`}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="mt-2.5">
                                            <button
                                              type="button"
                                              disabled={postBorrowTpBusy}
                                              onClick={() => { setPostBorrowTakeProfit(null); setPostBorrowTpError(null); }}
                                              className="px-2.5 py-1 rounded-md text-[10px] text-[var(--d-ink-faint)] hover:text-[var(--d-ink)] disabled:opacity-50"
                                            >
                                              {/* Once at least one slot is armed the order list updates and the LimitSlot under the loan handles the rest. */}
                                              Done — close this prompt
                                            </button>
                                          </div>
                                          {postBorrowTpError && (
                                            <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{postBorrowTpError}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Help text */}
                                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--d-surface)]/60 px-3 py-2.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <p className="text-[11px] text-[var(--d-ink-soft)] leading-relaxed">
                                      Click &ldquo;Borrow&rdquo; to sign the transaction with your wallet. Your {h.symbol} is locked as collateral and you receive SOL instantly.
                                      Repay before the deadline to reclaim your tokens — manage everything from the active-loans panel above, or from the <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--d-accent-deep)] font-medium hover:underline">Telegram bot</a> if you prefer.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="border-t border-[var(--d-border)] bg-[var(--d-surface)]/40 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] text-[var(--d-ink-faint)]">
                          Estimates based on live prices. Actual loan amounts in SOL.
                        </span>
                        <Link href="/calculate" className="text-[11px] font-medium text-[var(--d-accent-deep)] hover:underline">
                          Full calculator &rarr;
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* HOLDINGS TABLE */}
                {prefs.holdings && (
                  <div id="section-holdings">
                    <SectionHeader title="Holdings" count={holdings.length} />
                    {holdingsLoading ? (
                      <SkeletonRows count={4} />
                    ) : holdings.length === 0 ? (
                      <EmptyState message="No SPL tokens found in this wallet" />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--d-border)] bg-[var(--d-surface)]/60">
                              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Token</th>
                              <th className="hidden sm:table-cell px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Amount</th>
                              <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Value</th>
                              <th className="hidden md:table-cell px-4 py-3 text-right text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] font-medium">Mint</th>
                            </tr>
                          </thead>
                          <tbody>
                            {holdings.map((h, i) => (
                              <tr key={h.mint} className={`border-b border-[var(--d-border)] last:border-0 transition hover:bg-[var(--d-surface-hover)]/40 ${i % 2 === 1 ? "bg-[var(--d-surface)]/20" : ""}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <TokenIcon mint={h.mint} symbol={h.symbol} size={28} />
                                    <div>
                                      <div className="font-medium text-[13px]">{h.symbol}</div>
                                      <div className="text-[10px] text-[var(--d-ink-faint)]">{h.mint.slice(0, 4)}...{h.mint.slice(-4)}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="hidden sm:table-cell px-4 py-3 text-right text-xs text-[var(--d-ink-soft)]">{formatTokenAmount(h.amount, h.decimals)}</td>
                                <td className="px-4 py-3 text-right text-[13px] text-[var(--d-ink-faint)]">&mdash;</td>
                                <td className="hidden md:table-cell px-4 py-3 text-right">
                                  <span className="font-mono text-[10px] text-[var(--d-ink-faint)]">{h.mint.slice(0, 8)}...{h.mint.slice(-4)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* LOAN HISTORY */}
                {prefs.loanHistory && (
                  <div id="section-loanHistory">
                    <SectionHeader title="Loan History" count={loanHistory.length} />
                    {loansLoading && loanHistory.length === 0 ? (
                      <SkeletonRows count={3} />
                    ) : loanHistory.length === 0 ? (
                      <EmptyState message="No loan history yet" />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)]">
                        <div className="divide-y divide-[var(--d-border)]">
                          {loanHistory.map((l) => {
                            const owedSol = Number(BigInt(l.loan.original_amount_lamports ?? "0")) / LAMPORTS_PER_SOL;
                            const closedAt = new Date(l.timestamps.updated_at);
                            const statusBadge =
                              l.status === "repaid"
                                ? { label: "Repaid", color: "text-emerald-500" }
                                : l.status === "liquidated"
                                  ? { label: "Liquidated", color: "text-red-500" }
                                  : { label: l.status, color: "text-[var(--d-ink-soft)]" };
                            return (
                              <div key={l.loan_pda} className="flex items-center gap-3 px-4 py-3">
                                <TokenIcon mint={l.collateral.mint} symbol={l.collateral.symbol || "?"} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-[13px]">{l.collateral.symbol || l.collateral.mint.slice(0, 6)}</span>
                                    <span className={`text-[10px] ${statusBadge.color}`}>{statusBadge.label}</span>
                                  </div>
                                  <div className="text-[10px] text-[var(--d-ink-faint)]">
                                    {closedAt.toLocaleDateString()} · {l.loan.ltv_percentage}% LTV
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[12px] font-medium">{owedSol.toFixed(4)} SOL</div>
                                  {l.tx_signature && (
                                    <a
                                      href={`https://solscan.io/tx/${l.tx_signature}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-[var(--d-ink-faint)] hover:underline"
                                    >
                                      view tx
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Holder Distribution — shows the connected wallet's
                    expected SOL for the current/upcoming distribution
                    round + the tx link once sent. Hides if wallet not
                    in the active distribution. Sits ABOVE Governance
                    per operator-stated layout order. */}
                {connected && publicKey && <DistributionCard />}

                {/* Governance — always renders SOMETHING visible when
                    the wallet is connected so clicking the side-nav
                    "Governance" entry doesn't scroll into an empty div.
                    GovernanceCard returns null when there's no active
                    vote; in that case we render the empty-state below
                    with a clear CTA to the full /governance page. */}
                {connected && publicKey && (
                  <div id="section-governance" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Governance" compact />
                    <GovernanceCard />
                    {/* Empty-state fallback — visible when GovernanceCard
                        renders nothing (no active proposals OR still
                        loading). Keeps the section non-empty so users
                        always have a click target. */}
                    <div className="mt-3 text-[12px] text-[var(--d-ink-soft)]">
                      $MAGPIE holders vote on protocol changes (fee splits,
                      tier params, supported collateral). Your voting weight
                      = held $MAGPIE + collateralized $MAGPIE at the snapshot.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href="/governance"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--d-ink)] hover:bg-[var(--d-surface-hover)]"
                      >
                        View all proposals
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                      </Link>
                      <Link
                        href="/governance/proposal/MGP-001"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--d-accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--d-accent-ink)] hover:opacity-90"
                      >
                        Vote on MGP-001
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                      </Link>
                    </div>
                  </div>
                )}

              </div>
              </DashboardProvider>

              {/* ─── RIGHT COLUMN (4/12) ───
                  User-flagged 2026-06-12: the right column "stops scrolling
                  at a certain point" because the left column is much taller —
                  once the user scrolls past the right column's last card,
                  the right side appears empty. Fix: when the right column
                  is shorter than the viewport on xl, pin its top to the
                  scroll container with self-start + sticky. Empty space
                  below it remains scrollable (the left column still has
                  more content) without the user feeling like they've hit
                  a dead end.

                  Constraints:
                  - `self-start` so the column doesn't stretch
                    vertically alongside the (taller) left column.
                  - `top-6` matches the main padding.
                  - `xl:` only — on mobile the columns stack and stickying
                    breaks the natural flow. */}
              <div className="xl:col-span-4 flex flex-col gap-6 xl:self-start xl:sticky xl:top-6">

                {/* CREDIT SCORE CARD */}
                {prefs.credit && (
                  <div id="section-credit" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Credit Score" compact />
                    {liveCredit ? (
                      <>
                        <div className="flex flex-col items-center">
                          <CreditGauge score={liveCredit.score} tier={creditTier} />
                          {liveCredit.change !== undefined && liveCredit.change !== 0 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-xs font-semibold" style={{ color: "var(--d-accent-deep)" }}>
                                {liveCredit.change > 0 ? "+" : ""}{liveCredit.change}
                              </span>
                              <span className="text-[11px] text-[var(--d-ink-faint)]">this month</span>
                            </div>
                          )}
                        </div>
                        {/* Factors */}
                        {liveCredit.factors && (
                          <div className="mt-5 flex flex-col gap-2.5">
                            {liveCredit.factors.repaymentHistory !== undefined && <FactorBar label="Repayment" value={liveCredit.factors.repaymentHistory} />}
                            {liveCredit.factors.loanVolume !== undefined && <FactorBar label="Volume" value={liveCredit.factors.loanVolume} />}
                            {liveCredit.factors.accountAge !== undefined && <FactorBar label="Account Age" value={liveCredit.factors.accountAge} />}
                            {liveCredit.factors.diversity !== undefined && <FactorBar label="Diversity" value={liveCredit.factors.diversity} />}
                            {liveCredit.factors.liquidations !== undefined && <FactorBar label="Liquidations" value={liveCredit.factors.liquidations} />}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-6">
                        <CreditGauge score={0} tier="Unranked" />
                        <p className="mt-4 text-center text-sm text-[var(--d-ink-soft)]">
                          No credit score yet — take your first loan to start building credit
                        </p>
                      </div>
                    )}
                    <Link href="/credit" className="mt-4 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                      How credit scoring works &rarr;
                    </Link>
                  </div>
                )}

                {/* $MAGPIE HOLDERS CARD */}
                <div id="section-holders" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                  <SectionHeader title="$MAGPIE Holders" compact />
                  {holders ? (
                    <>
                      <div className="rounded-xl border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">
                          Est. next payout
                        </div>
                        <div className="mt-1 font-mono text-xl font-semibold text-[var(--d-ink)]">
                          ~{(Number(holders.estimated_next_payout_lamports) / 1e9).toFixed(6)} SOL
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">
                          Auto-sent · snapshots happen periodically
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Held</div>
                          <div className="mt-0.5 font-mono text-sm font-semibold text-[var(--d-ink)]">
                            {(() => {
                              const n = Number(holders.magpie_balance_raw) / 1e6;
                              if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
                              if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
                              return n.toFixed(2);
                            })()}
                          </div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Distributions</div>
                          <div className="mt-0.5 text-sm font-semibold text-[var(--d-ink)]">{holders.distributions_count}</div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2 col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Lifetime received</div>
                          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">{(Number(holders.paid_lamports) / 1e9).toFixed(6)} SOL</div>
                        </div>
                      </div>
                      {!holders.has_balance && (
                        <p className="mt-3 text-xs text-[var(--d-ink-soft)]">
                          Connected wallet doesn't hold $MAGPIE. Grab some to start earning a share of every loan fee.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--d-ink-soft)]">
                      Hold $MAGPIE → earn <span className="font-semibold text-[var(--d-accent-deep)]">10%</span> of every loan fee, paid automatically each week.
                    </p>
                  )}
                  <Link href="/holders" className="mt-4 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                    How holder rewards work &rarr;
                  </Link>
                </div>

                {/* Activity feed — moved here from the left column per
                    operator-stated layout. The side nav's "Activity"
                    entry scrolls to this same id so the link still
                    works without changes. */}
                {connected && publicKey && (
                  <div id="section-activity">
                    <ActivityFeed
                      botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                    />
                  </div>
                )}

{/* LP POSITION CARD — Top of right column so LPs see their position first */}
                <div id="section-lp" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                  <SectionHeader title="LP Position" compact />
                  {lpPosition && lpPosition.depositedAmount > 0 ? (
                    <>
                      <div className="rounded-xl border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">
                          Current value
                        </div>
                        <div className="mt-1 font-mono text-xl font-semibold text-[var(--d-ink)]">
                          {(lpPosition.currentValue / LAMPORTS_PER_SOL).toFixed(6)} SOL
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">
                          {lpPosition.yieldEarned >= 0 ? "+" : ""}
                          {(lpPosition.yieldEarned / LAMPORTS_PER_SOL).toFixed(6)} SOL earned
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Deposited</div>
                          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">
                            {(lpPosition.depositedAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Time in pool</div>
                          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">
                            {lpLoyalty?.days_held != null ? `${lpLoyalty.days_held.toFixed(1)}d` : "—"}
                          </div>
                        </div>
                      </div>
                      {lpLoyalty && (
                        <div className="mt-3 rounded-xl border border-[var(--d-accent)]/15 bg-[var(--d-bg)] p-3">
                          <div className="flex items-baseline justify-between">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">
                              Loyalty bonus
                            </div>
                            <div className="text-[10px] text-[var(--d-accent-deep)]">+{lpLoyalty.reward_pct}% of fees</div>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Lifetime received</div>
                              <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">
                                {(Number(lpLoyalty.paid_lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Distributions</div>
                              <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">
                                {lpLoyalty.distributions_received}
                              </div>
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] text-[var(--d-ink-faint)]">
                            Post-MGP-001 LP yield. 10% of every loan fee, distributed by shares × time held on the 5–10 day snapshot cadence. Auto-paid in SOL.
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--d-ink-soft)]">
                      No LP position yet. Deposit SOL → earn the <span className="font-semibold text-[var(--d-accent-deep)]">10% LP loyalty share</span> of every loan fee per MGP-001. Distributed in SOL on the snapshot cadence, weighted by shares × time held — long-tenured LPs earn proportionally more.
                    </p>
                  )}
                  <Link href="/earn" className="mt-4 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                    {lpPosition && lpPosition.depositedAmount > 0 ? "Manage position →" : "Deposit SOL →"}
                  </Link>
                </div>

                                {/* REFERRAL CARD */}
                <div id="section-referrals" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                  <SectionHeader title="Referrals" compact />
                  {referrals?.linked ? (
                    <>
                      <div className="rounded-xl border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">
                          Claimable
                        </div>
                        <div className="mt-1 font-mono text-xl font-semibold text-[var(--d-ink)]">
                          {(Number(referrals.claimable_lamports) / 1e9).toFixed(6)} SOL
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Invited</div>
                          <div className="mt-0.5 text-sm font-semibold text-[var(--d-ink)]">{referrals.referred_count}</div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Borrowed</div>
                          <div className="mt-0.5 text-sm font-semibold text-[var(--d-ink)]">{referrals.borrowed_count}</div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Lifetime</div>
                          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">{(Number(referrals.lifetime_lamports) / 1e9).toFixed(4)}</div>
                        </div>
                        <div className="rounded-lg bg-[var(--d-bg)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)]">Paid</div>
                          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink)]">{(Number(referrals.paid_lamports) / 1e9).toFixed(4)}</div>
                        </div>
                      </div>
                      {referrals.share_link && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(referrals.share_link!).catch(() => {});
                          }}
                          className="mt-3 w-full break-all rounded-lg bg-[var(--d-bg)] px-3 py-2 text-left text-[11px] font-mono text-[var(--d-ink-soft)] hover:bg-[var(--d-border)]"
                          title="Click to copy"
                        >
                          {referrals.share_link}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--d-ink-soft)]">
                      Earn <span className="font-semibold text-[var(--d-accent-deep)]">5%</span> of every loan fee from friends you refer. Open the bot to get your link.
                    </p>
                  )}
                  <Link href="/refer" className="mt-4 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                    How referrals work &rarr;
                  </Link>
                </div>

                {/* POINTS CARD */}
                {prefs.points && (
                  <div id="section-points" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Points" compact />
                    <div className="flex items-end gap-3">
                      <div className="font-display text-3xl font-bold tracking-tight">{animatedPoints.toLocaleString()}</div>
                    </div>
                    <p className="mt-3 text-xs text-[var(--d-ink-soft)]">
                      Earn points by repaying loans on time
                    </p>
                    <Link href="/points" className="mt-3 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                      Points calculator &rarr;
                    </Link>
                  </div>
                )}

                {/* Auto-Protect + notification prefs — linked users only. */}
                {connected && publicKey && (
                  <PrefsPanel
                    botApiUrl={process.env.NEXT_PUBLIC_BOT_API_URL || ""}
                  />
                )}

                {/* (The dashboard's user-visible activity feed is the
                    unified <ActivityFeed/> rendered higher in the tree
                    — see ~line 2152. A second inline activity section
                    used to live here gated by prefs.activity, but it
                    fetched the wrong URL and always showed "No activity
                    yet" — confusing dual-feed UX. The local activity[]
                    state still powers totalPoints; only the duplicate
                    JSX was removed.) */}

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
                  Magpie also lives in <span className="italic" style={{ color: "var(--d-accent)" }}>Telegram</span>
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--d-cta-muted)" }}>
                  Borrow, repay, extend, and top up — same protocol, same wallet, two front doors. Use whichever fits the moment.
                </p>
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--d-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] transition hover:bg-[var(--d-accent-hover)]">
                  Open @magpie_capital_bot
                  <span aria-hidden>&rarr;</span>
                </a>
              </div>
            </div>

            {/* Footer — community + resource links. Operator-flagged
                2026-06-12 that the previous mini-footer only had Home /
                Docs / Telegram (the wallet bot) — no community surface
                from the dashboard. Replaced with the full link set:
                Community group, X, GitHub plus the resource links. All
                use real <a>/<Link> hyperlinks. */}
            <div className="mt-8 border-t border-[var(--d-border)] pt-6 pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-3 text-[11px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)] mb-1.5">Community</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--d-ink-soft)]">
                      <a href="https://t.me/magpietalk" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Telegram — @magpietalk</a>
                      <a href="https://x.com/MagpieLoans" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">X — @MagpieLoans</a>
                      <a href="https://github.com/magpiecapital" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">GitHub</a>
                      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Wallet bot — @magpie_capital_bot</a>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--d-ink-faint)] mb-1.5">Resources</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--d-ink-soft)]">
                      <Link href="/" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Home</Link>
                      <Link href="/docs" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Docs</Link>
                      <Link href="/governance" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Governance</Link>
                      <Link href="/stats" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Protocol Stats</Link>
                      <Link href="/security" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Security</Link>
                      <Link href="/privacy" className="font-medium hover:text-[var(--d-ink)] underline-offset-2 hover:underline">Privacy</Link>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--d-ink-faint)] md:text-right">
                  &copy; {new Date().getFullYear()} Magpie · Built on Solana
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* (Floating AI chat now lives in ClientProviders → renders
          on every page, available regardless of connection state.) */}
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

/**
 * Link the connected wallet to a Telegram account so the user can use both
 * surfaces interchangeably. The bot generates a short code; user pastes it
 * in @magpie_capital_bot as /link <code>; site polls /link/status to detect
 * the redeem and updates the UI.
 *
 * Phantom-first users can skip this — the site already serves the full
 * loan lifecycle without it. Linking adds value only when the user wants
 * to (a) see their TG-tied referral code / holder history on the site,
 * or (b) sign actions in TG against a wallet they connected via Phantom.
 */
function LinkToTelegram({ wallet, botApiUrl }: { wallet: string; botApiUrl: string }) {
  // `linked` = wallet has a Magpie account (always true after the
  // bot's auto-bootstrap). `telegram_linked` = real TG bond (positive
  // telegram_id). We only treat the latter as "linked to TG" in the UI.
  const [status, setStatus] = useState<{ linked: boolean; telegram_linked?: boolean } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [requesting, setRequesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Poll status — fast cadence when a code is open (user might redeem any
  // moment), slow when not.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/link/status?wallet=${wallet}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setStatus(j);
          if (j.linked) setCode(null);
        }
      } catch { /* silent */ }
    }
    check();
    const interval = code ? 5_000 : 60_000;
    const id = setInterval(check, interval);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; clearInterval(id); clearInterval(tick); };
  }, [wallet, botApiUrl, code]);

  async function requestCode() {
    setRequesting(true);
    setErr(null);
    try {
      const r = await fetch(`${botApiUrl}/api/v1/link/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCode(j.code);
      setCodeExpiresAt(Date.now() + (j.expires_in_seconds * 1000));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRequesting(false);
    }
  }

  if (!status) return null; // still loading

  // Only show "✓ Linked to Telegram" when the user actually has a
  // real TG bond. Site-native auto-bootstrap users have `linked:
  // true` (Magpie account exists) but `telegram_linked: false` (no
  // real TG handle attached). Showing them as TG-linked would be a
  // misleading status badge.
  if (status.telegram_linked) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
        <span className="font-semibold text-emerald-600">✓ Telegram connected</span>
      </div>
    );
  }

  if (code && codeExpiresAt && codeExpiresAt > now) {
    const secondsLeft = Math.max(0, Math.floor((codeExpiresAt - now) / 1000));
    const mm = Math.floor(secondsLeft / 60);
    const ss = secondsLeft % 60;
    return (
      <div className="rounded-lg border border-[var(--d-accent)]/30 bg-[var(--d-accent-dim)]/30 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--d-accent-deep)]">Code generated</div>
        <div className="mt-1.5 font-mono text-lg font-bold tabular text-[var(--d-ink)]">{code}</div>
        <p className="mt-2 text-xs text-[var(--d-ink-soft)] leading-relaxed">
          Paste{" "}
          <code className="rounded bg-[var(--d-bg-card)] px-1 py-0.5 text-[var(--d-ink)]">/link {code}</code>{" "}
          in{" "}
          <a href="https://t.me/magpie_capital_bot" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--d-accent-deep)] underline hover:text-[var(--d-accent)]">
            @magpie_capital_bot
          </a>{" "}
          to finish linking.
        </p>
        <div className="mt-2 text-[10px] text-[var(--d-ink-faint)]">
          Expires in {mm}:{String(ss).padStart(2, "0")} · auto-detects once you redeem
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 flex items-center justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold text-[var(--d-ink)]">Connect Telegram (optional)</div>
        <div className="text-[10px] text-[var(--d-ink-soft)]">Backup auth surface + emergency lock + unified loans across surfaces</div>
      </div>
      <button
        onClick={requestCode}
        disabled={requesting}
        className="rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)] disabled:opacity-50"
      >
        {requesting ? "…" : "Connect"}
      </button>
      {err && <span className="text-[10px] text-red-500">{err}</span>}
    </div>
  );
}
