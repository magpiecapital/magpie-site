"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { buildBorrowTransaction } from "@/lib/solana/borrow";

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

/* ───────────────────────── TYPES: TOKEN HOLDING ───────────────────────── */

interface TokenHolding {
  symbol: string;
  name: string;
  mint: string;
  amount: string;
  decimals: number;
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
}

interface EligibleHolding extends TokenHolding {
  approved: ApprovedToken;
  valueUsd: number;
}

/* ───────────────────────── ACTIVE LOAN TYPES ─────────────────────────── */

// 2026-06-16 — Active Loans dashboard render with V4 exit positions
// (operator non-negotiable rule). API: GET /api/v1/loans?include=orders.

interface LoanOrderTrigger {
  kind: "mc_usd" | "price_usd" | "price_sol" | null;
  value_micro: string | null;
}

interface LoanOrderExecution {
  tx_signature: string | null;
  proceeds_lamports: string | null;
  protocol_fee_lamports: string | null;
  net_to_user_lamports: string | null;
}

interface LoanOrder {
  id: number;
  loan_id: string | null;
  kind: "tp" | "sl" | "trailing_tp" | "trailing_sl" | "ladder_tp" | "ladder_sl";
  direction: "above" | "below";
  status: "armed" | "firing" | "twap_in_progress" | "awaiting_user" | "fired" | "failed" | "cancelled";
  trigger: LoanOrderTrigger;
  slice_pct_bps: number;
  slippage_bps: number;
  max_slippage_bps_cap: number | null;
  ladder_group_id: number | null;
  trailing: { distance_bps: number; peak_price_micros: string | null } | null;
  timestamps: {
    armed_at: string | null;
    firing_started_at: string | null;
    fired_at: string | null;
    expires_at: string | null;
  };
  execution: LoanOrderExecution | null;
  failure: { count: number; reason: string | null } | null;
  intervention: { state: string; suggested_slippage_bps: number | null } | null;
  source: string | null;
}

interface ActiveLoan {
  loan_id: string | null;
  loan_pda: string | null;
  status: string;
  health_ratio: number | null;
  collateral: {
    mint: string;
    symbol: string | null;
    name: string | null;
    decimals: number;
    image: string | null;
    category: string;
    amount: string | null;
    current_amount: string | null;
    sol_proceeds_lamports: string;
    auto_sells_fired: number;
  };
  loan: {
    amount_lamports: string | null;
    actual_received_lamports: string | null;
    original_amount_lamports: string | null;
    ltv_percentage: number;
    duration_days: number;
  };
  timestamps: {
    started_at: string | null;
    due_at: string | null;
    updated_at: string | null;
  };
  tx_signature: string | null;
  // Present when API called with ?include=orders. V4 loans have the
  // attached exits here; V1/V2/V3 loans have an empty array (per the
  // V4-is-exit-only rule).
  orders?: LoanOrder[];
  // Synthesized on the client: which program the loan landed on.
  // We use the env-injected V4 program id (NEXT_PUBLIC_PROGRAM_ID_V4)
  // to decide whether to render the exit-positions panel.
  program_id?: string;
}

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
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
            <button onClick={onCopy} className="flex h-5 w-5 items-center justify-center rounded text-[var(--d-ink-faint)]">
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
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

function EmptyState({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--d-border-strong)] bg-[var(--d-surface)]/50 p-10 text-center">
      <div className="text-sm text-[var(--d-ink-soft)]">{message}</div>
      {cta && (
        <a href={cta.href} className="mt-3 inline-block text-sm font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
          {cta.label} &rarr;
        </a>
      )}
    </div>
  );
}

/* ───────────────────────── ACTIVE LOAN COMPONENTS ───────────────────────── */
// 2026-06-16 — operator non-negotiable: every V4 loan must cleanly
// list all attached exit positions (TP/SL/Trailing/Ladder/Bracket).
// V1/V2/V3 loans render without ANY exit options per the V4-is-exit-
// only rule.

// V4 program id surfaces from the bot's loan API. We compare per-loan.
const V4_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID_V4 || "HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo";

function fmtSolLamports(lamports: string | number | null | undefined, digits = 4): string {
  const n = Number(lamports ?? 0);
  if (!Number.isFinite(n) || n === 0) return "0";
  return (n / 1e9).toFixed(digits);
}

function fmtCollateralAmount(rawAmount: string | null, decimals: number): string {
  if (!rawAmount) return "0";
  const n = Number(rawAmount) / Math.pow(10, decimals);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.001) return n.toFixed(4);
  return n.toExponential(2);
}

// Trigger value is stored as a fixed-point micro (6-decimal) BigInt
// string. Render per kind: price_usd → "$0.005", mc_usd → "$50M",
// price_sol → "0.00012 SOL".
function fmtTriggerValue(kind: string | null, valueMicro: string | null): string {
  if (!valueMicro || !kind) return "—";
  const v = Number(valueMicro) / 1_000_000;
  if (!Number.isFinite(v)) return "—";
  if (kind === "mc_usd") {
    if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B mc`;
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M mc`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K mc`;
    return `$${v.toFixed(2)} mc`;
  }
  if (kind === "price_usd") {
    if (v >= 1) return `$${v.toFixed(4)}`;
    if (v >= 0.0001) return `$${v.toFixed(6)}`;
    return `$${v.toExponential(2)}`;
  }
  if (kind === "price_sol") {
    return `${v.toFixed(8)} SOL`;
  }
  return `${v}`;
}

const STATUS_BADGE_STYLES: Record<string, { bg: string; ink: string; label: string }> = {
  armed: { bg: "var(--d-accent-dim)", ink: "var(--d-accent-deep)", label: "Armed" },
  firing: { bg: "#fef3c7", ink: "#92400e", label: "Firing now" },
  twap_in_progress: { bg: "#fef3c7", ink: "#92400e", label: "Filling…" },
  awaiting_user: { bg: "#fde68a", ink: "#854d0e", label: "Awaiting you" },
  fired: { bg: "#d1fae5", ink: "#065f46", label: "Filled" },
  failed: { bg: "#fee2e2", ink: "#991b1b", label: "Failed" },
  cancelled: { bg: "var(--d-surface)", ink: "var(--d-ink-soft)", label: "Cancelled" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.armed;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{ background: s.bg, color: s.ink }}
    >
      {s.label}
    </span>
  );
}

function exitKindLabel(kind: LoanOrder["kind"]): string {
  switch (kind) {
    case "tp": return "Take profit";
    case "sl": return "Stop loss";
    case "trailing_tp": return "Trailing TP";
    case "trailing_sl": return "Trailing SL";
    case "ladder_tp": return "Ladder leg";
    case "ladder_sl": return "Ladder leg";
    default: return "Exit";
  }
}

function ExitRow({ order }: { order: LoanOrder }) {
  const slicePct = (order.slice_pct_bps / 100).toFixed(0);
  const slip = (order.slippage_bps / 100).toFixed(2);
  const isTrailing = order.trailing != null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--d-border)] bg-[var(--d-surface)] px-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--d-ink)] truncate">{exitKindLabel(order.kind)}</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--d-ink-soft)] truncate">
            <span className="font-medium text-[var(--d-ink)]">{fmtTriggerValue(order.trigger.kind, order.trigger.value_micro)}</span>
            {isTrailing && (
              <span className="ml-2">· trail {(order.trailing!.distance_bps / 100).toFixed(0)}%</span>
            )}
            <span className="ml-2">· {slicePct}% slice</span>
            <span className="ml-2">· slip {slip}%</span>
          </div>
          {order.failure && order.failure.count > 0 && (
            <div className="mt-1 text-[10px] text-[#991b1b]">
              Retry {order.failure.count}{order.failure.reason ? ` — ${order.failure.reason}` : ""}
            </div>
          )}
          {order.execution && order.execution.tx_signature && (
            <div className="mt-1 text-[10px] text-[var(--d-ink-soft)]">
              Received {fmtSolLamports(order.execution.net_to_user_lamports)} SOL ·{" "}
              <a
                href={`https://solscan.io/tx/${order.execution.tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--d-accent-deep)] hover:underline"
              >
                receipt &rarr;
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LadderGroup({ legs }: { legs: LoanOrder[] }) {
  const fired = legs.filter((l) => l.status === "fired").length;
  const total = legs.length;
  const direction = legs[0]?.direction === "below" ? "Stop-loss" : "Take-profit";
  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-surface)]/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--d-ink)]">{direction} ladder</span>
          <span className="text-[10px] text-[var(--d-ink-soft)]">{fired}/{total} fired</span>
        </div>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--d-border)]">
          <div
            className="h-full rounded-full bg-[var(--d-accent)]"
            style={{ width: `${total > 0 ? (fired / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {legs.map((l) => <ExitRow key={l.id} order={l} />)}
      </div>
    </div>
  );
}

interface GroupedExits {
  brackets: { tp: LoanOrder; sl: LoanOrder }[];
  ladders: LoanOrder[][];
  singles: LoanOrder[];
}

function groupExits(orders: LoanOrder[]): GroupedExits {
  const result: GroupedExits = { brackets: [], ladders: [], singles: [] };
  // Bucket by ladder_group_id first
  const ladderBuckets = new Map<number, LoanOrder[]>();
  const remaining: LoanOrder[] = [];
  for (const o of orders) {
    if (o.ladder_group_id != null) {
      const arr = ladderBuckets.get(o.ladder_group_id) || [];
      arr.push(o);
      ladderBuckets.set(o.ladder_group_id, arr);
    } else {
      remaining.push(o);
    }
  }
  result.ladders = [...ladderBuckets.values()].map((arr) =>
    arr.slice().sort((a, b) => Number(a.trigger.value_micro || 0) - Number(b.trigger.value_micro || 0))
  );
  // Detect brackets: one TP and one SL co-existing armed/firing on same loan
  const activeTps = remaining.filter((o) =>
    (o.kind === "tp" || o.kind === "trailing_tp") &&
    ["armed", "firing", "twap_in_progress", "awaiting_user"].includes(o.status),
  );
  const activeSls = remaining.filter((o) =>
    (o.kind === "sl" || o.kind === "trailing_sl") &&
    ["armed", "firing", "twap_in_progress", "awaiting_user"].includes(o.status),
  );
  if (activeTps.length === 1 && activeSls.length === 1) {
    result.brackets.push({ tp: activeTps[0], sl: activeSls[0] });
    const usedIds = new Set([activeTps[0].id, activeSls[0].id]);
    result.singles = remaining.filter((o) => !usedIds.has(o.id));
  } else {
    result.singles = remaining;
  }
  return result;
}

function BracketCard({ pair }: { pair: { tp: LoanOrder; sl: LoanOrder } }) {
  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-surface)]/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--d-ink)]">Bracket</span>
        <span className="text-[10px] text-[var(--d-ink-soft)]">first side to trigger fills</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <ExitRow order={pair.tp} />
        <ExitRow order={pair.sl} />
      </div>
    </div>
  );
}

function ExitPositionsPanel({ orders }: { orders: LoanOrder[] }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--d-border-strong)] bg-[var(--d-surface)]/40 px-3 py-3 text-[11px] text-[var(--d-ink-soft)]">
        No auto-sell armed — set TP or SL via /borrow next time, or use the Telegram bot to attach to this loan.
      </div>
    );
  }
  const grouped = groupExits(orders);
  return (
    <div className="flex flex-col gap-2.5">
      {grouped.brackets.map((b) => <BracketCard key={`b-${b.tp.id}`} pair={b} />)}
      {grouped.ladders.map((legs) => <LadderGroup key={`l-${legs[0]?.ladder_group_id}`} legs={legs} />)}
      {grouped.singles.map((o) => <ExitRow key={o.id} order={o} />)}
    </div>
  );
}

function ActiveLoanCard({ loan }: { loan: ActiveLoan }) {
  const isV4 = loan.program_id === V4_PROGRAM_ID;
  const sym = loan.collateral.symbol || loan.collateral.mint.slice(0, 4);
  const due = loan.timestamps.due_at ? new Date(loan.timestamps.due_at) : null;
  const now = new Date();
  const daysRemaining = due ? Math.max(0, Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
  const health = loan.health_ratio;
  const healthColorVal = health == null ? "var(--d-ink-soft)" : healthColor(health);
  const healthLabelVal = health == null ? "—" : healthLabel(health);
  const owedSol = fmtSolLamports(loan.loan.amount_lamports);
  const receivedSol = fmtSolLamports(loan.loan.actual_received_lamports || loan.loan.amount_lamports);
  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4 transition hover:border-[var(--d-accent)]/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TokenIcon mint={loan.collateral.mint} symbol={sym} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--d-ink)] truncate">{sym}</span>
              {isV4 && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wider"
                  style={{ background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}
                >
                  V4
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--d-ink-soft)]">
              Loan #{loan.loan_id || "?"} · {loan.loan.ltv_percentage}% LTV · {loan.loan.duration_days}d
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-[var(--d-ink)]">{owedSol} SOL</div>
          <div className="text-[10px] text-[var(--d-ink-soft)]">repay by due</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-y border-[var(--d-border)]/60 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--d-ink-faint)]">Collateral</div>
          <div className="mt-0.5 text-xs font-medium text-[var(--d-ink)]">
            {fmtCollateralAmount(loan.collateral.current_amount, loan.collateral.decimals)} {sym}
          </div>
          {Number(loan.collateral.auto_sells_fired) > 0 && (
            <div className="text-[10px] text-[var(--d-ink-soft)]">
              + {fmtSolLamports(loan.collateral.sol_proceeds_lamports)} SOL in vault
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--d-ink-faint)]">Received</div>
          <div className="mt-0.5 text-xs font-medium text-[var(--d-ink)]">{receivedSol} SOL</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--d-ink-faint)]">Health</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: healthColorVal }}>{health != null ? health.toFixed(2) : "—"}</span>
            <span className="text-[10px]" style={{ color: healthColorVal }}>{healthLabelVal}</span>
          </div>
          {daysRemaining != null && (
            <div className="text-[10px] text-[var(--d-ink-soft)]">
              {daysRemaining === 0 ? "due today" : `${daysRemaining}d left`}
            </div>
          )}
        </div>
      </div>

      {/* V4-only: exit positions panel. V1/V2/V3 loans show no exit
          options at all per the V4-is-exit-only rule. */}
      {isV4 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--d-ink-faint)]">Auto-sells</div>
          <ExitPositionsPanel orders={loan.orders || []} />
        </div>
      )}

      {!isV4 && (
        <div className="mt-3 rounded-xl bg-[var(--d-surface)]/50 px-3 py-2 text-[11px] text-[var(--d-ink-soft)]">
          Legacy pool — manage via Telegram (/repay, /extend, /topup).
        </div>
      )}
    </div>
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
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMint, setExpandedMint] = useState<string | null>(null);
  const [loanPercent, setLoanPercent] = useState<Record<string, number>>({});

  // ── Wallet integration ──
  const { publicKey, connected, wallets, select, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const [liveCredit, setLiveCredit] = useState<any>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [approvedTokens, setApprovedTokens] = useState<ApprovedToken[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [activeLoansLoading, setActiveLoansLoading] = useState(false);

  // ── Borrow state ──
  const [borrowing, setBorrowing] = useState(false);
  const [borrowTx, setBorrowTx] = useState<string | null>(null);
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const { sendTransaction } = useWallet();

  const walletDisplay = connected && publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const walletFull = connected && publicKey ? publicKey.toBase58() : "";

  // Use a ref for connection to prevent effects re-firing when the
  // ConnectionProvider re-renders (which creates a new context value).
  const connRef = useRef(connection);
  connRef.current = connection;

  // Fetch real SOL balance — poll every 120s (was 30s, burning credits)
  useEffect(() => {
    if (!connected || !publicKey) { setSolBalance(0); return; }
    let cancelled = false;
    const fetchBalance = () => {
      connRef.current.getBalance(publicKey)
        .then((lamports) => {
          if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
        })
        .catch(() => {
          if (!cancelled) setSolBalance(0);
        });
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 120_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey]);

  // Fetch real SPL token holdings (both TOKEN_PROGRAM_ID and TOKEN_2022)
  // Only runs once when wallet connects — no polling, no connection dep.
  const [holdingsFetched, setHoldingsFetched] = useState(false);
  useEffect(() => {
    if (!connected || !publicKey) { setHoldings([]); setHoldingsFetched(false); return; }
    if (holdingsFetched) return; // already fetched for this wallet session
    let cancelled = false;
    setHoldingsLoading(true);
    setHoldingsFetched(true);

    const parseAccounts = (result: { value: any[] }): TokenHolding[] =>
      result.value
        .map((account: any) => {
          const info = account.account.data.parsed?.info;
          if (!info) return null;
          const mint = info.mint as string;
          const tokenAmount = info.tokenAmount;
          if (!tokenAmount || tokenAmount.uiAmount === 0) return null;
          return {
            symbol: mint.slice(0, 4).toUpperCase(),
            name: mint,
            mint,
            amount: tokenAmount.amount as string,
            decimals: tokenAmount.decimals as number,
          };
        })
        .filter((t: TokenHolding | null): t is TokenHolding => t !== null);

    Promise.all([
      connRef.current.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }).catch(() => ({ value: [] })),
      connRef.current.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => ({ value: [] })),
    ])
      .then(([splResult, token2022Result]) => {
        if (cancelled) return;
        const allTokens = [...parseAccounts(splResult), ...parseAccounts(token2022Result)]
          .sort((a, b) => {
            const aNum = Number(a.amount) / Math.pow(10, a.decimals);
            const bNum = Number(b.amount) / Math.pow(10, b.decimals);
            return bNum - aNum;
          });
        setHoldings(allTokens);
        setHoldingsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHoldings([]);
          setHoldingsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [connected, publicKey, holdingsFetched]);

  // Fetch approved collateral tokens
  useEffect(() => {
    if (!connected || !publicKey) { setApprovedTokens([]); return; }
    let cancelled = false;
    setApprovedLoading(true);
    fetch("/api/v1/tokens")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok && Array.isArray(d.data)) setApprovedTokens(d.data);
        setApprovedLoading(false);
      })
      .catch(() => {
        if (!cancelled) setApprovedLoading(false);
      });
    return () => { cancelled = true; };
  }, [connected, publicKey]);

  // 2026-06-16 — fetch active loans + attached exits (operator
  // non-negotiable rule). Auto-refresh every 20s so a fired exit or
  // newly-armed order shows up without a page reload.
  useEffect(() => {
    if (!connected || !publicKey) { setActiveLoans([]); return; }
    let cancelled = false;
    const walletStr = publicKey.toBase58();
    const load = async () => {
      try {
        const r = await fetch(`/api/v1/loans?wallet=${walletStr}&include=orders`);
        const d = await r.json();
        if (cancelled) return;
        if (Array.isArray(d?.active)) setActiveLoans(d.active as ActiveLoan[]);
      } catch {
        // swallow — keep last-good list; loading flag clears below
      } finally {
        if (!cancelled) setActiveLoansLoading(false);
      }
    };
    setActiveLoansLoading(true);
    load();
    const intervalId = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [connected, publicKey]);

  // Derive eligible collateral from holdings × approved tokens
  const eligibleCollateral: EligibleHolding[] = (() => {
    if (!holdings.length || !approvedTokens.length) return [];
    const approvedMap = new Map(approvedTokens.map((t) => [t.mint, t]));
    return holdings
      .filter((h) => approvedMap.has(h.mint))
      .map((h) => {
        const approved = approvedMap.get(h.mint)!;
        const uiAmount = Number(h.amount) / Math.pow(10, h.decimals);
        const valueUsd = approved.priceUsd ? uiAmount * approved.priceUsd : 0;
        return { ...h, symbol: approved.symbol, name: approved.name, approved, valueUsd };
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

      const { transaction, loanId, loanPda } = await buildBorrowTransaction({
        borrower: publicKey,
        collateralMint: holding.mint,
        collateralAmountRaw,
        collateralValueLamports,
        loanOption: tierOption,
        connection,
      });

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
      });

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      }, "confirmed");

      setBorrowTx(signature);

      // Refresh balances
      connection.getBalance(publicKey).then((lamports) => setSolBalance(lamports / LAMPORTS_PER_SOL)).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      // User rejected in Phantom
      if (msg.includes("User rejected")) {
        setBorrowError("Transaction cancelled");
      } else {
        setBorrowError(msg);
      }
    } finally {
      setBorrowing(false);
    }
  }, [publicKey, connected, connection, sendTransaction]);

  // Fetch live credit score when wallet connected
  useEffect(() => {
    if (!connected || !publicKey) { setLiveCredit(null); return; }
    fetch(`/api/v1/credit?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setLiveCredit(d.data); })
      .catch(() => {});
  }, [connected, publicKey]);

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

  const animatedPoints = useAnimatedCounter(mounted ? 0 : 0);

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

  /* ─── WALLET NOT CONNECTED: Show connect prompt ─── */
  if (!connected || !publicKey) {
    const installedWallets = wallets.filter((w) => w.readyState === "Installed");
    const otherWallets = wallets.filter((w) => w.readyState !== "Installed");

    return (
      <div
        className="flex h-screen items-center justify-center transition-colors duration-300"
        style={{ ...THEMES[theme] as React.CSSProperties, background: "var(--d-bg)", color: "var(--d-ink)" }}
      >
        <div className="flex flex-col items-center gap-6 text-center px-6 w-full max-w-sm">
          <Link href="/">
            <Wordmark size={32} />
          </Link>
          <div className="mt-2">
            <h1 className="font-display text-2xl font-medium tracking-tight">Connect your wallet</h1>
            <p className="mt-2 max-w-sm text-sm text-[var(--d-ink-soft)]">
              Connect a Solana wallet to view your dashboard, balances, and credit score.
            </p>
          </div>

          {/* Direct wallet buttons — no modal needed */}
          <div className="w-full flex flex-col gap-2">
            {installedWallets.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)] mb-1">Detected wallets</div>
                {installedWallets.map((wallet) => (
                  <button
                    key={wallet.adapter.name}
                    onClick={() => select(wallet.adapter.name)}
                    disabled={connecting}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--d-border)] px-4 py-3 text-sm font-medium transition hover:border-[var(--d-accent)] hover:bg-[var(--d-surface-hover)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={wallet.adapter.icon} alt={wallet.adapter.name} width={28} height={28} className="rounded-md" />
                    <span className="flex-1 text-left">{wallet.adapter.name}</span>
                    <span className="text-xs text-[var(--d-accent-deep)]">
                      {connecting ? "Connecting..." : "Connect"}
                    </span>
                  </button>
                ))}
              </>
            )}
            {installedWallets.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--d-border-strong)] bg-[var(--d-surface)] p-6 text-sm text-[var(--d-ink-soft)]">
                No wallet detected. Install{" "}
                <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-[var(--d-accent-deep)] underline underline-offset-2">Phantom</a>{" "}
                or{" "}
                <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" className="text-[var(--d-accent-deep)] underline underline-offset-2">Solflare</a>{" "}
                to continue.
              </div>
            )}
            {otherWallets.length > 0 && installedWallets.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)] hover:text-[var(--d-ink-soft)]">
                  More wallets
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {otherWallets.map((wallet) => (
                    <button
                      key={wallet.adapter.name}
                      onClick={() => { select(wallet.adapter.name); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--d-border)] px-4 py-3 text-sm font-medium transition hover:border-[var(--d-accent)] hover:bg-[var(--d-surface-hover)] opacity-60 hover:opacity-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={wallet.adapter.icon} alt={wallet.adapter.name} width={28} height={28} className="rounded-md" />
                      <span className="flex-1 text-left">{wallet.adapter.name}</span>
                      <span className="text-xs text-[var(--d-ink-soft)]">Install</span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4">
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
            <Link href="/" className="text-xs text-[var(--d-ink-faint)] hover:text-[var(--d-ink-soft)]">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── WALLET CONNECTED: Full dashboard ─── */
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

          {/* Left: wallet */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-[var(--d-surface)] px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--d-accent)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--d-accent)]" />
              </span>
              <span className="text-xs text-[var(--d-ink-soft)] tracking-wide">{walletDisplay}</span>
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
              <span className="font-semibold text-[var(--d-ink)]">{solBalance.toFixed(4)} SOL</span>
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Wallet disconnect */}
            <button
              onClick={() => disconnect()}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--d-border)] px-3 py-1.5 text-xs text-[var(--d-ink-soft)] transition hover:border-[var(--d-border-strong)] hover:bg-[var(--d-surface-hover)] hover:text-[var(--d-ink)]"
            >
              {walletDisplay}
            </button>
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

            {/* ─── KPI CARDS ROW ─── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "SOL Balance", value: solBalance.toFixed(4), sub: "SOL", accent: false },
                { label: "Holdings", value: `${holdings.length}`, sub: "SPL tokens", accent: false },
                { label: "Eligible Collateral", value: `${eligibleCollateral.length}`, sub: totalEligibleUsd > 0 ? `$${totalEligibleUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "No eligible tokens", accent: eligibleCollateral.length > 0 },
                { label: "Active Loans", value: "0", sub: "No active loans", accent: false },
                { label: "Total Owed", value: "0 SOL", sub: "No debt", accent: false },
                { label: "Credit Score", value: `${creditScore}`, sub: `${creditTier} tier`, accent: true },
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

                {/* ACTIVE LOANS — 2026-06-16 build per operator non-negotiable rule */}
                {prefs.activeLoans && (
                  <div id="section-activeLoans">
                    <SectionHeader title="Active Loans" count={activeLoans.length} />
                    {activeLoansLoading && activeLoans.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-10 text-center">
                        <div className="text-sm text-[var(--d-ink-soft)]">Loading your loans…</div>
                      </div>
                    ) : activeLoans.length === 0 ? (
                      <EmptyState
                        message="No active loans — start a new borrow below or on Telegram"
                        cta={{ label: "Open Telegram Bot", href: TELEGRAM_URL }}
                      />
                    ) : (
                      <div className="flex flex-col gap-3">
                        {activeLoans.map((loan) => (
                          <ActiveLoanCard key={loan.loan_pda || loan.loan_id || ""} loan={loan} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ELIGIBLE COLLATERAL */}
                <div id="section-eligible">
                  <SectionHeader title="Eligible Collateral" count={eligibleCollateral.length} />
                  {approvedLoading || holdingsLoading ? (
                    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-10 text-center">
                      <div className="text-sm text-[var(--d-ink-soft)]">Scanning wallet for eligible tokens...</div>
                    </div>
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
                          const tiers = [
                            { name: "Express", tag: "Fast cash, premium rate", ltv: 0.30, days: 2, fee: 0.03, color: "var(--d-bad)" },
                            { name: "Quick", tag: "Balanced speed & value", ltv: 0.25, days: 3, fee: 0.02, color: "var(--d-warn)" },
                            { name: "Standard", tag: "Best rate, more time to repay", ltv: 0.20, days: 7, fee: 0.015, color: "var(--d-accent)" },
                          ];
                          return (
                            <div key={h.mint}>
                              {/* Row */}
                              <button
                                onClick={() => setExpandedMint(isExpanded ? null : h.mint)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--d-surface-hover)]/40 ${i % 2 === 1 && !isExpanded ? "bg-[var(--d-surface)]/20" : ""} ${isExpanded ? "bg-[var(--d-accent-dim)]/20" : ""}`}
                              >
                                <TokenIcon mint={h.mint} symbol={h.symbol} size={32} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{h.symbol}</span>
                                    <span className="text-[10px] text-[var(--d-ink-faint)] hidden sm:inline">{h.name}</span>
                                  </div>
                                  <div className="text-[11px] text-[var(--d-ink-soft)]">
                                    {formatTokenAmount(h.amount, h.decimals)} tokens
                                    {h.approved.priceUsd ? ` · $${h.approved.priceUsd < 0.01 ? h.approved.priceUsd.toPrecision(4) : h.approved.priceUsd.toFixed(4)}` : ""}
                                  </div>
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
                                  {/* Collateral slider */}
                                  <div className="mb-5">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-[var(--d-ink-soft)]">Collateral amount</span>
                                      <span className="text-xs font-semibold">
                                        {(uiAmount * pct / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} {h.symbol}
                                        <span className="text-[var(--d-ink-faint)] font-normal ml-1">({pct}%)</span>
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={10}
                                      max={100}
                                      step={5}
                                      value={pct}
                                      onChange={(e) => setLoanPercent((prev) => ({ ...prev, [h.mint]: Number(e.target.value) }))}
                                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, var(--d-accent) 0%, var(--d-accent) ${pct}%, var(--d-border) ${pct}%, var(--d-border) 100%)`,
                                      }}
                                    />
                                    <div className="flex justify-between mt-1">
                                      {[25, 50, 75, 100].map((v) => (
                                        <button
                                          key={v}
                                          onClick={() => setLoanPercent((prev) => ({ ...prev, [h.mint]: v }))}
                                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition ${pct === v ? "bg-[var(--d-accent)] text-[var(--d-accent-ink)]" : "text-[var(--d-ink-faint)] hover:text-[var(--d-ink-soft)]"}`}
                                        >
                                          {v}%
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Tier cards */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {tiers.map((tier) => {
                                      const loanUsd = collateralUsd * tier.ltv;
                                      const feeUsd = loanUsd * tier.fee;
                                      const netUsd = loanUsd - feeUsd;
                                      return (
                                        <div
                                          key={tier.name}
                                          className={`rounded-xl border bg-[var(--d-bg-card)] p-4 flex flex-col transition hover:shadow-sm ${tier.name === "Standard" ? "border-[var(--d-accent)]/50 ring-1 ring-[var(--d-accent)]/20" : "border-[var(--d-border)] hover:border-[var(--d-accent)]"}`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tier.color }}>{tier.name}</span>
                                              {tier.name === "Standard" && (
                                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--d-accent)] text-[var(--d-accent-ink)]">Best value</span>
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
                                              <div className="text-[var(--d-ink-faint)]">Borrow more</div>
                                              <div className="font-medium">{tier.ltv > 0.20 ? "Higher risk" : "Lower risk"}</div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleBorrow(h, tier.name === "Express" ? 0 : tier.name === "Quick" ? 1 : 2, pct)}
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
                                      </div>
                                    </div>
                                  )}
                                  {borrowError && (
                                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                      <p className="text-[11px] text-red-400 leading-relaxed">{borrowError}</p>
                                    </div>
                                  )}

                                  {/* Help text */}
                                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--d-surface)]/60 px-3 py-2.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-ink-faint)" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <p className="text-[11px] text-[var(--d-ink-soft)] leading-relaxed">
                                      Click &ldquo;Borrow&rdquo; to sign the transaction with your wallet. Your {h.symbol} is locked as collateral and you receive SOL instantly.
                                      Repay before the deadline to reclaim your tokens. Manage loans via the <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--d-accent-deep)] font-medium hover:underline">Telegram bot</a>.
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
                      <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-10 text-center">
                        <div className="text-sm text-[var(--d-ink-soft)]">Loading token balances...</div>
                      </div>
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
                    <SectionHeader title="Loan History" count={0} />
                    <EmptyState message="No loan history yet" />
                  </div>
                )}
              </div>

              {/* ─── RIGHT COLUMN (4/12) ─── */}
              <div className="xl:col-span-4 flex flex-col gap-6">

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
                    </div>
                    <p className="mt-3 text-xs text-[var(--d-ink-soft)]">
                      Earn points by repaying loans on time
                    </p>
                    <Link href="/points" className="mt-3 block text-center text-xs font-medium text-[var(--d-accent-deep)] hover:underline underline-offset-4">
                      Points calculator &rarr;
                    </Link>
                  </div>
                )}

                {/* ACTIVITY FEED */}
                {prefs.activity && (
                  <div id="section-activity" className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-5">
                    <SectionHeader title="Activity" compact />
                    <div className="py-6 text-center text-sm text-[var(--d-ink-soft)]">
                      No activity yet
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
