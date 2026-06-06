"use client";

/**
 * Unified activity feed for linked users.
 *
 * Pulls /api/v1/activity (a time-merged stream of borrows, repays,
 * auto-protect actions, site withdraws, referral payouts, holder
 * rewards) and renders the latest few inline so users get a clear
 * "what's happened on my account lately" view without bouncing to
 * TG history.
 *
 * Hidden for non-linked users or accounts with no activity yet.
 */
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface ActivityEvent {
  kind:
    | "borrow"
    | "repaid"
    | "liquidated"
    | "auto_protect"
    | "site_withdraw"
    | "referral_paid"
    | "holder_reward_paid"
    | "lock_set"
    | "lock_cleared"
    | string;
  at: string;
  loan_id?: string | null;
  collateral_mint?: string;
  amount_lamports?: string | null;
  raw_amount?: string | null;
  decimals?: number;
  ltv_percentage?: number;
  duration_days?: number;
  asset?: string;
  from?: string;
  to?: string;
  action_type?: string;
  health_before?: number | null;
  health_after?: number | null;
  status?: string;
  tx_signature?: string | null;
  hours?: number | null;
  set_by?: string;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

function fmtSol(lamports: string | null | undefined): string {
  if (!lamports) return "—";
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4);
}

function fmtRaw(raw: string | null | undefined, decimals: number | undefined): string {
  if (!raw || decimals == null) return "—";
  return (Number(raw) / 10 ** decimals).toLocaleString(undefined, {
    maximumFractionDigits: Math.min(decimals, 6),
  });
}

function ageStr(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

function shortAddr(addr: string | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function renderEvent(e: ActivityEvent): { icon: string; title: React.ReactNode; sub?: React.ReactNode } {
  switch (e.kind) {
    case "borrow":
      return {
        icon: "↗",
        title: (
          <>
            Borrowed <span className="font-mono">{fmtSol(e.amount_lamports)} SOL</span>
            {e.loan_id && <span className="text-[var(--d-ink-faint)]"> · loan #{e.loan_id}</span>}
          </>
        ),
        sub: e.ltv_percentage != null && (
          <>
            {e.ltv_percentage}% LTV · {e.duration_days}d
          </>
        ),
      };
    case "repaid":
      return {
        icon: "✓",
        title: (
          <>
            Repaid loan {e.loan_id && <span className="text-[var(--d-ink-faint)]">#{e.loan_id}</span>}
          </>
        ),
        sub: <>Closed for {fmtSol(e.amount_lamports)} SOL</>,
      };
    case "liquidated":
      return {
        icon: "⚠",
        title: (
          <>
            Liquidated loan {e.loan_id && <span className="text-[var(--d-ink-faint)]">#{e.loan_id}</span>}
          </>
        ),
      };
    case "auto_protect": {
      let title: React.ReactNode = "Auto-Protect";
      let sub: React.ReactNode = null;
      if (e.action_type === "partial_repay") {
        title = (
          <>
            Auto-Protect paid <span className="font-mono">{fmtSol(e.amount_lamports)} SOL</span> on loan{" "}
            #{e.loan_id}
          </>
        );
        sub = e.health_before != null && e.health_after != null && (
          <>
            health {e.health_before}→{e.health_after}x
          </>
        );
      } else if (e.action_type === "insufficient_funds_warning") {
        title = <>Auto-Protect skipped loan #{e.loan_id} — not enough idle SOL</>;
      } else if (e.action_type === "partial_repay_failed") {
        title = <>Auto-Protect retrying on loan #{e.loan_id}</>;
      } else {
        title = <>Auto-Protect: {e.action_type}</>;
      }
      return { icon: "🛡", title, sub };
    }
    case "site_withdraw":
      return {
        icon: "→",
        title: (
          <>
            Withdrew{" "}
            <span className="font-mono">
              {e.asset === "SOL"
                ? `${fmtSol(e.raw_amount)} SOL`
                : `${fmtRaw(e.raw_amount, e.decimals)} ${shortAddr(e.asset)}`}
            </span>
          </>
        ),
        sub: (
          <>
            to <span className="font-mono">{shortAddr(e.to)}</span>
            {e.status === "failed" && <span className="text-red-500"> · failed</span>}
          </>
        ),
      };
    case "referral_paid":
      return {
        icon: "★",
        title: (
          <>
            Referral payout <span className="font-mono">{fmtSol(e.amount_lamports)} SOL</span>
          </>
        ),
      };
    case "holder_reward_paid":
      return {
        icon: "◆",
        title: (
          <>
            $MAGPIE holder reward <span className="font-mono">{fmtSol(e.amount_lamports)} SOL</span>
          </>
        ),
      };
    case "lock_set": {
      const who = e.set_by === "self" || e.set_by === "callback" ? "you" : e.set_by || "?";
      return {
        icon: "🔒",
        title: (
          <>
            Site lock set {e.hours ? <span className="text-[var(--d-ink-faint)]">· {e.hours}h</span> : null}
          </>
        ),
        sub: <>by {who}</>,
      };
    }
    case "lock_cleared": {
      const who = e.set_by === "self" || e.set_by === "callback" ? "you" : e.set_by || "?";
      return {
        icon: "🔓",
        title: <>Site lock cleared</>,
        sub: <>by {who}</>,
      };
    }
    default:
      return { icon: "•", title: e.kind };
  }
}

export default function ActivityFeed({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!walletStr || !botApiUrl) return;
    try {
      const r = await fetch(`${botApiUrl}/api/v1/activity?wallet=${walletStr}&limit=30`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setLinked(!!j.linked);
      setEvents(Array.isArray(j.events) ? j.events : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [walletStr, botApiUrl]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (linked === null) return null;
  if (linked === false) return null;
  if (!events || events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, 6);

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
          Activity · {events.length} recent
        </div>
        {events.length > 6 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-[var(--d-ink-faint)] hover:text-[var(--d-accent-deep)] underline"
          >
            {expanded ? "Show recent" : `Show all ${events.length}`}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {visible.map((e, i) => {
          const r = renderEvent(e);
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 text-center text-sm text-[var(--d-ink-faint)]">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--d-ink)]">{r.title}</div>
                {r.sub && (
                  <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">{r.sub}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] text-[var(--d-ink-faint)]">{ageStr(e.at)}</div>
                {e.tx_signature && (
                  <a
                    href={`https://solscan.io/tx/${e.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block font-mono text-[10px] text-[var(--d-accent-deep)] underline"
                  >
                    tx
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
