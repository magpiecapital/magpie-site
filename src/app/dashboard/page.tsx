"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

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
          <div className="mt-2 text-lg font-semibold">{solBalance.toFixed(2)} SOL</div>
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

  // ── Wallet integration ──
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [liveCredit, setLiveCredit] = useState<any>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  const walletDisplay = connected && publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const walletFull = connected && publicKey ? publicKey.toBase58() : "";

  // Fetch real SOL balance
  useEffect(() => {
    if (!connected || !publicKey) { setSolBalance(0); return; }
    let cancelled = false;
    const fetchBalance = () => {
      connection.getBalance(publicKey)
        .then((lamports) => {
          if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
        })
        .catch(() => {
          if (!cancelled) setSolBalance(0);
        });
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, connection]);

  // Fetch real SPL token holdings
  useEffect(() => {
    if (!connected || !publicKey) { setHoldings([]); return; }
    let cancelled = false;
    setHoldingsLoading(true);
    connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
      .then((result) => {
        if (cancelled) return;
        const tokens: TokenHolding[] = result.value
          .map((account) => {
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
          .filter((t): t is TokenHolding => t !== null)
          .sort((a, b) => {
            const aNum = Number(a.amount) / Math.pow(10, a.decimals);
            const bNum = Number(b.amount) / Math.pow(10, b.decimals);
            return bNum - aNum;
          });
        setHoldings(tokens);
        setHoldingsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHoldings([]);
          setHoldingsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [connected, publicKey, connection]);

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
    return (
      <div
        className="flex h-screen items-center justify-center transition-colors duration-300"
        style={{ ...THEMES[theme] as React.CSSProperties, background: "var(--d-bg)", color: "var(--d-ink)" }}
      >
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <Link href="/">
            <Wordmark size={32} />
          </Link>
          <div className="mt-2">
            <h1 className="font-display text-2xl font-medium tracking-tight">Connect your wallet</h1>
            <p className="mt-2 max-w-sm text-sm text-[var(--d-ink-soft)]">
              Connect a Solana wallet to view your dashboard, balances, and credit score.
            </p>
          </div>
          <ConnectWallet />
          <div className="mt-4 flex items-center gap-4">
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
              <span className="font-semibold text-[var(--d-ink)]">{solBalance.toFixed(2)} SOL</span>
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Wallet connect */}
            <ConnectWallet variant="ghost" className="hidden sm:flex text-xs" />
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
                { label: "SOL Balance", value: solBalance.toFixed(2), sub: "SOL", accent: false },
                { label: "Holdings", value: `${holdings.length}`, sub: "SPL tokens", accent: false },
                { label: "Active Loans", value: "0", sub: "No active loans", accent: false },
                { label: "Total Owed", value: "0 SOL", sub: "No debt", accent: false },
                { label: "Collateral Locked", value: "0", sub: "No collateral", accent: false },
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

                {/* ACTIVE LOANS */}
                {prefs.activeLoans && (
                  <div id="section-activeLoans">
                    <SectionHeader title="Active Loans" count={0} />
                    <EmptyState
                      message="No active loans — start borrowing on Telegram"
                      cta={{ label: "Open Telegram Bot", href: TELEGRAM_URL }}
                    />
                  </div>
                )}

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
