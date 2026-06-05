"use client";

/**
 * LiveActivityFeed — anonymized streaming feed of recent loans / repays.
 *
 * Renders on the /stats page. Auto-refreshes every 15s. Each event is
 * a single line: [icon] [wallet stub] [verb] [amount] SOL [token] [time]
 * with a subtle entrance animation when new events appear at the top.
 *
 * Designed to sit on a public-facing trust surface — uses custom
 * stroke-only line icons (no emoji), restrained copy, and a skeleton
 * loading state so the panel feels solid before any data lands.
 */
import { useEffect, useState } from "react";

interface Event {
  type: "borrow" | "repay" | "liquidation" | "update";
  loan_id: string;
  wallet_stub: string;
  symbol: string;
  loan_amount_sol: number;
  collateral_amount: number | null;
  ltv_pct: number;
  duration_days: number;
  timestamp: string;
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtSol(n: number) {
  if (n < 0.001) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  if (n < 100) return n.toFixed(2);
  return n.toFixed(1);
}

function fmtAmount(n: number | null) {
  if (n == null) return "?";
  if (n < 1) return n.toFixed(3);
  if (n < 1_000) return n.toFixed(0);
  if (n < 1_000_000) return (n / 1_000).toFixed(1) + "K";
  return (n / 1_000_000).toFixed(2) + "M";
}

// ─── Custom line icons — replace 💰 ✅ ⚠️ 🔄 emojis ───
// All stroke-only, inherit currentColor, sized for inline use.
function ArrowDownRight({ className = "" }: { className?: string }) {
  // "Loan disbursed" — direction-into-wallet arrow.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 7 L17 17" />
      <path d="M17 9 L17 17 L9 17" />
    </svg>
  );
}
function CheckIcon({ className = "" }: { className?: string }) {
  // "Repaid" — clean checkmark.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}
function TriangleAlert({ className = "" }: { className?: string }) {
  // "Liquidated" — refined warning triangle.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4 L21 19 L3 19 Z" />
      <path d="M12 10 L12 14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PulseIcon({ className = "" }: { className?: string }) {
  // "Update" — neutral activity pulse.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12 H8 L10 7 L14 17 L16 12 H21" />
    </svg>
  );
}

interface EventStyle {
  Icon: ({ className }: { className?: string }) => React.JSX.Element;
  word: string;
  // Tailwind classes for the icon's surrounding chip + the icon color
  iconWrap: string;
  iconColor: string;
  // Tailwind classes for the verb text
  verb: string;
}

function styleFor(type: Event["type"]): EventStyle {
  switch (type) {
    case "borrow":
      return {
        Icon: ArrowDownRight,
        word: "borrowed",
        iconWrap: "bg-[var(--accent)]/10 border border-[var(--accent)]/20",
        iconColor: "text-[var(--accent-deep)]",
        verb: "text-[var(--ink)] font-medium",
      };
    case "repay":
      return {
        Icon: CheckIcon,
        word: "repaid",
        iconWrap: "bg-emerald-500/10 border border-emerald-500/20",
        iconColor: "text-emerald-600",
        verb: "text-emerald-700 font-medium",
      };
    case "liquidation":
      return {
        Icon: TriangleAlert,
        word: "liquidated",
        iconWrap: "bg-red-500/10 border border-red-500/20",
        iconColor: "text-red-600",
        verb: "text-red-700 font-medium",
      };
    default:
      return {
        Icon: PulseIcon,
        word: "updated",
        iconWrap: "bg-[var(--surface)] border border-[var(--hairline)]",
        iconColor: "text-[var(--ink-soft)]",
        verb: "text-[var(--ink-soft)] font-medium",
      };
  }
}

// ─── Skeleton row — replaces plain "Loading…" text ───
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="h-8 w-8 rounded-full bg-[var(--hairline)] animate-pulse shrink-0" />
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="h-3 w-16 rounded bg-[var(--hairline)] animate-pulse" />
        <div className="h-3 w-20 rounded bg-[var(--hairline)] animate-pulse" />
        <div className="h-3 w-24 rounded bg-[var(--hairline)] animate-pulse" />
      </div>
      <div className="h-3 w-12 rounded bg-[var(--hairline)] animate-pulse" />
    </div>
  );
}

export function LiveActivityFeed() {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/activity/public?limit=15");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.events)) {
          setEvents(json.events);
        }
      } catch { /* silent — non-critical */ }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Initial loading — skeleton rows feel like a solid container before
  // data arrives, instead of a blank "Loading…" text on a bare page.
  if (events === null) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="divide-y divide-[var(--hairline)]">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
        <div className="border-t border-[var(--hairline)] px-5 py-2.5 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Anonymized · auto-refresh every 15s
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <PulseIcon className="h-8 w-8 text-[var(--ink-faint)]" />
          <div className="mt-4 text-sm font-medium text-[var(--ink)]">No recent activity yet</div>
          <div className="mt-1 text-xs text-[var(--ink-soft)]">New loans and repayments will stream in here as they happen.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
      <div className="divide-y divide-[var(--hairline)]">
        {events.map((e, i) => {
          const s = styleFor(e.type);
          return (
            <div
              key={`${e.loan_id}-${e.timestamp}`}
              className="group flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-[var(--surface)] fade-up sm:px-5"
              style={{ animationDelay: `${Math.min(i * 0.02, 0.4)}s` }}
            >
              {/* Icon chip */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.iconWrap}`}>
                <s.Icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>

              {/* Body: wallet · verb · amount · context */}
              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                <span className="font-mono text-[11px] text-[var(--ink-faint)] shrink-0">
                  {e.wallet_stub}
                </span>
                <span className={`shrink-0 ${s.verb}`}>{s.word}</span>
                <span className="font-display tabular text-[15px] font-medium text-[var(--ink)] shrink-0">
                  {fmtSol(e.loan_amount_sol)} <span className="text-[var(--ink-soft)] font-normal text-[12px]">SOL</span>
                </span>
                {e.type === "borrow" && e.collateral_amount != null && (
                  <span className="text-[12px] text-[var(--ink-soft)] truncate">
                    against <span className="tabular text-[var(--ink)]">{fmtAmount(e.collateral_amount)}</span> ${e.symbol}
                  </span>
                )}
                {e.type === "repay" && (
                  <span className="text-[12px] text-[var(--ink-soft)] truncate">
                    on ${e.symbol} — collateral returned
                  </span>
                )}
                {e.type === "liquidation" && (
                  <span className="text-[12px] text-[var(--ink-soft)] truncate">
                    on ${e.symbol}
                  </span>
                )}
              </div>

              {/* Time */}
              <span className="text-[11px] text-[var(--ink-faint)] shrink-0 tabular tracking-tight">
                {relTime(e.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[var(--hairline)] px-5 py-2.5 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        Anonymized · auto-refresh every 15s
      </div>
    </div>
  );
}
