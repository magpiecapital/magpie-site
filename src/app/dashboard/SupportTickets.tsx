"use client";

/**
 * Read-only support tickets viewer on the dashboard.
 *
 * Linked users see their open / awaiting / recently-closed tickets and the
 * latest team reply for each. No write actions yet (follow-up & close are
 * still TG-only); those will land alongside the signed-action endpoint.
 *
 * Renders nothing if the connected wallet isn't linked yet, or if the
 * user has no tickets at all.
 */
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Ticket {
  id: number;
  message: string;
  status: "open" | "awaiting_user" | "closed" | string;
  admin_reply: string | null;
  admin_replied_at: string | null;
  auto_resolved_at: string | null;
  last_user_followup_at: string | null;
  followup_count: number;
  closed_at: string | null;
  created_at: string;
}

function statusBadge(status: string): { label: string; cls: string } {
  if (status === "open")
    return {
      label: "Awaiting team",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    };
  if (status === "awaiting_user")
    return {
      label: "Team replied · your turn",
      cls: "border-[var(--d-accent)]/30 bg-[var(--d-accent-dim)]/40 text-[var(--d-accent-deep)]",
    };
  if (status === "closed")
    return {
      label: "Closed",
      cls: "border-[var(--d-border)] bg-[var(--d-bg-card)] text-[var(--d-ink-faint)]",
    };
  return {
    label: status,
    cls: "border-[var(--d-border)] bg-[var(--d-bg-card)] text-[var(--d-ink-faint)]",
  };
}

function ageStr(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

export default function SupportTickets({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletStr || !botApiUrl) return;
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/support/tickets?wallet=${walletStr}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setLinked(!!j.linked);
        setTickets(Array.isArray(j.tickets) ? j.tickets : []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    // Poll every 45s while the tab is visible — fresh enough to show
    // new replies without hammering the API.
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletStr, botApiUrl]);

  const sorted = useMemo(() => {
    if (!tickets) return [];
    const rank = (s: string) => (s === "awaiting_user" ? 0 : s === "open" ? 1 : 2);
    return [...tickets].sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets]);

  if (linked === null) return null;
  if (linked === false) return null;
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
          Support · {sorted.length} ticket{sorted.length !== 1 ? "s" : ""}
        </div>
        <a
          href="https://t.me/magpie_capital_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[var(--d-ink-faint)] hover:text-[var(--d-accent-deep)] underline"
        >
          /mytickets in TG
        </a>
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="mt-3 divide-y divide-[var(--d-border)]">
        {sorted.map((t) => {
          const badge = statusBadge(t.status);
          const expanded = expandedId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setExpandedId(expanded ? null : t.id)}
              className="block w-full py-2.5 text-left hover:bg-[var(--d-surface-hover)]/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-[var(--d-ink-soft)]">#{t.id}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="truncate text-xs text-[var(--d-ink-soft)]">
                    {t.message.split("\n")[0].slice(0, 80)}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--d-ink-faint)]">
                  {ageStr(t.created_at)}
                </span>
              </div>

              {expanded && (
                <div className="mt-2 space-y-2 pl-2">
                  <div className="rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)]">
                      Your message
                    </div>
                    <div className="whitespace-pre-wrap text-xs text-[var(--d-ink-soft)]">
                      {t.message}
                    </div>
                  </div>
                  {t.admin_reply && (
                    <div className="rounded-md border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--d-accent-deep)]">
                          Team reply
                          {t.auto_resolved_at && (
                            <span className="ml-1 text-[var(--d-ink-faint)] normal-case">
                              · AI agent
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--d-ink-faint)]">
                          {ageStr(t.admin_replied_at)}
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap text-xs text-[var(--d-ink)]">
                        {t.admin_reply.replace(/^\[auto-resolved by agent\]\n?\n?/, "")}
                      </div>
                    </div>
                  )}
                  {t.followup_count > 0 && (
                    <div className="text-[10px] text-[var(--d-ink-faint)]">
                      Your follow-ups: {t.followup_count}
                    </div>
                  )}
                  {t.status !== "closed" && (
                    <div className="text-[10px] text-[var(--d-ink-faint)]">
                      To follow up or close, use{" "}
                      <code className="rounded bg-[var(--d-bg-card)] px-1 text-[var(--d-ink-soft)]">
                        /mytickets
                      </code>{" "}
                      in the Telegram bot.
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
