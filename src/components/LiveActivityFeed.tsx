"use client";

/**
 * LiveActivityFeed — anonymized streaming feed of recent loans / repays.
 *
 * Renders on the /stats page. Auto-refreshes every 15s. Each event is
 * a single line: "[wallet stub] [verb] [amount] SOL [token] [time]"
 * with a subtle entrance animation when new events appear at the top.
 *
 * Social proof + the protocol-is-alive feel.
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

function verb(type: Event["type"]) {
  switch (type) {
    case "borrow": return { word: "borrowed", emoji: "💰", color: "text-[var(--accent-deep)]" };
    case "repay": return { word: "repaid", emoji: "✅", color: "text-green-700" };
    case "liquidation": return { word: "liquidated", emoji: "⚠️", color: "text-red-600" };
    default: return { word: "updated", emoji: "🔄", color: "text-[var(--ink-soft)]" };
  }
}

export function LiveActivityFeed() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/activity/public?limit=15");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.events)) {
          setEvents(json.events);
          setLoading(false);
        }
      } catch { /* silent */ }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="text-center text-sm text-[var(--ink-faint)] py-8">
        Loading activity…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--ink-faint)] py-8">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
      <div className="divide-y divide-[var(--hairline)]">
        {events.map((e, i) => {
          const v = verb(e.type);
          return (
            <div
              key={`${e.loan_id}-${e.timestamp}`}
              className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-[var(--surface)] fade-up"
              style={{ animationDelay: `${Math.min(i * 0.02, 0.4)}s` }}
            >
              {/* emoji + wallet */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg leading-none" aria-hidden>{v.emoji}</span>
                <span className="font-mono text-xs text-[var(--ink-faint)] shrink-0">
                  {e.wallet_stub}
                </span>
                <span className={`font-medium ${v.color} shrink-0`}>
                  {v.word}
                </span>
                <span className="tabular font-display text-base shrink-0">
                  {fmtSol(e.loan_amount_sol)} SOL
                </span>
                {e.type === "borrow" && e.collateral_amount != null && (
                  <span className="text-[var(--ink-soft)] truncate">
                    against <span className="tabular">{fmtAmount(e.collateral_amount)}</span> ${e.symbol}
                  </span>
                )}
                {e.type === "repay" && (
                  <span className="text-[var(--ink-soft)] truncate">
                    on ${e.symbol} loan · kept the bag
                  </span>
                )}
                {e.type === "liquidation" && (
                  <span className="text-[var(--ink-soft)] truncate">
                    on ${e.symbol}
                  </span>
                )}
              </div>
              {/* time */}
              <span className="text-xs text-[var(--ink-faint)] shrink-0 tabular">
                {relTime(e.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[var(--hairline)] px-5 py-2 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        Anonymized · refreshes every 15s
      </div>
    </div>
  );
}
