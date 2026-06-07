"use client";

/**
 * Support surface on the dashboard.
 *
 * Privacy note: the list endpoint deliberately returns METADATA ONLY
 * (id, status, timestamps, has_admin_reply boolean) because wallet
 * pubkeys are public on-chain and the list is not signature-gated.
 * To read a ticket's message body + admin reply, we fetch from the
 * signed /api/v1/support/ticket-details endpoint — Phantom prompts
 * the user to sign once per expansion.
 *
 * Renders only for linked users.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  siteSupportAsk,
  siteSupportTicketDetails,
  siteSupportDeleteTicket,
  type TicketDetails,
  type SupportAskResult,
} from "@/lib/solana/site-support";

interface TicketMeta {
  id: number;
  status: "open" | "awaiting_user" | "closed" | string;
  has_admin_reply: boolean;
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
  const { publicKey, signMessage } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [tickets, setTickets] = useState<TicketMeta[] | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-ticket details cache (id → full content). Loaded lazily when
  // the user expands a ticket so each Phantom signature only buys read
  // access to the ticket they actually want to see.
  const [detailsCache, setDetailsCache] = useState<Record<number, TicketDetails>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null);
  const [detailsError, setDetailsError] = useState<{ id: number; msg: string } | null>(null);

  // Compose-new state
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState("");

  // Per-ticket follow-up state
  const [followupFor, setFollowupFor] = useState<number | null>(null);
  const [followupText, setFollowupText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    ticketId: number;
    text: string;
  } | null>(null);

  const loadTickets = useCallback(async () => {
    if (!walletStr || !botApiUrl) return;
    try {
      const r = await fetch(`${botApiUrl}/api/v1/support/tickets?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setLinked(!!j.linked);
      setTickets(Array.isArray(j.tickets) ? j.tickets : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [walletStr, botApiUrl]);

  useEffect(() => {
    loadTickets();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadTickets();
    }, 45_000);
    return () => clearInterval(id);
  }, [loadTickets]);

  const sorted = useMemo(() => {
    if (!tickets) return [];
    const rank = (s: string) => (s === "awaiting_user" ? 0 : s === "open" ? 1 : 2);
    return [...tickets].sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets]);

  async function fetchDetails(ticketId: number) {
    if (!walletStr || !signMessage) {
      setDetailsError({ id: ticketId, msg: "Connect a wallet that supports signMessage." });
      return;
    }
    if (detailsCache[ticketId]) return; // already loaded
    setDetailsLoadingId(ticketId);
    setDetailsError(null);
    try {
      const d = await siteSupportTicketDetails({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        ticketId,
      });
      setDetailsCache((c) => ({ ...c, [ticketId]: d }));
    } catch (e) {
      setDetailsError({
        id: ticketId,
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDetailsLoadingId(null);
    }
  }

  async function handleExpandToggle(ticketId: number) {
    const next = expandedId === ticketId ? null : ticketId;
    setExpandedId(next);
    if (next !== null && !detailsCache[next]) {
      fetchDetails(next);
    }
  }

  async function doSubmit(
    action: "open" | "follow_up" | "close",
    extra: { ticketId?: number; message?: string },
  ): Promise<SupportAskResult | null> {
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage to use support actions.");
      return null;
    }
    setSubmitting(true);
    setError(null);
    setAiResponse(null);
    try {
      const r = await siteSupportAsk({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        action,
        ...extra,
      });
      if (r.aiResponse) {
        setAiResponse({ ticketId: r.ticketId, text: r.aiResponse });
      } else if (r.aiError) {
        setError(`Submitted, but AI agent was unavailable: ${r.aiError}`);
      }
      await loadTickets();
      // Invalidate cached details for this ticket so we refetch the
      // freshly-appended message + AI reply next time it's expanded.
      setDetailsCache((c) => {
        if (!c[r.ticketId]) return c;
        const { [r.ticketId]: _drop, ...rest } = c;
        void _drop;
        return rest;
      });
      setExpandedId(r.ticketId);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpen() {
    const text = composeText.trim();
    if (text.length < 4) {
      setError("Type at least a few words about what you need help with.");
      return;
    }
    const r = await doSubmit("open", { message: text });
    if (r) {
      setComposeText("");
      setComposing(false);
    }
  }

  async function handleFollowUp(ticketId: number) {
    const text = followupText.trim();
    if (text.length < 2) {
      setError("Type your follow-up.");
      return;
    }
    const r = await doSubmit("follow_up", { ticketId, message: text });
    if (r) {
      setFollowupText("");
      setFollowupFor(null);
    }
  }

  async function handleClose(ticketId: number) {
    await doSubmit("close", { ticketId });
  }

  async function handleDelete(ticketId: number) {
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage.");
      return;
    }
    const confirmed = typeof window !== "undefined"
      ? window.confirm("Permanently delete this ticket and its messages? This can't be undone.")
      : false;
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await siteSupportDeleteTicket({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        ticketId,
      });
      setDetailsCache((c) => {
        const { [ticketId]: _drop, ...rest } = c;
        void _drop;
        return rest;
      });
      if (expandedId === ticketId) setExpandedId(null);
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (linked === null) return null;
  if (linked === false) return null;

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
          Support {sorted.length > 0 && `· ${sorted.length} ticket${sorted.length !== 1 ? "s" : ""}`}
        </div>
        <button
          onClick={() => {
            setComposing((v) => !v);
            setError(null);
            setAiResponse(null);
          }}
          className="rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
        >
          {composing ? "Cancel" : "Ask a question"}
        </button>
      </div>

      {composing && (
        <div className="mt-3 space-y-2">
          <textarea
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="What do you need help with? The AI agent will answer first, and the team will take over if it can't."
            rows={4}
            maxLength={3500}
            className="w-full rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-sm text-[var(--d-ink)] placeholder:text-[var(--d-ink-faint)]"
          />
          <button
            onClick={handleOpen}
            disabled={submitting || composeText.trim().length < 4}
            className="w-full rounded-md bg-[var(--d-accent-deep)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing & sending…" : "Sign & send"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {aiResponse && (
        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
          <div className="mb-1 font-semibold text-emerald-700">
            ✓ Sent · ticket #{aiResponse.ticketId}
          </div>
          <div className="whitespace-pre-wrap text-[var(--d-ink)]">{aiResponse.text}</div>
        </div>
      )}

      {sorted.length === 0 && !composing && (
        <div className="mt-3 text-xs text-[var(--d-ink-faint)]">
          No tickets yet. Hit “Ask a question” to chat with the team.
        </div>
      )}

      <div className="mt-3 divide-y divide-[var(--d-border)]">
        {sorted.map((t) => {
          const badge = statusBadge(t.status);
          const expanded = expandedId === t.id;
          const details = detailsCache[t.id];
          const loadingDetails = detailsLoadingId === t.id;
          const detailErr = detailsError && detailsError.id === t.id ? detailsError.msg : null;
          return (
            <div key={t.id} className="py-2.5">
              <button
                onClick={() => handleExpandToggle(t.id)}
                className="block w-full text-left hover:bg-[var(--d-surface-hover)]/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-[var(--d-ink-soft)]">
                      #{t.id}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {t.has_admin_reply && (
                      <span className="text-[10px] text-[var(--d-ink-faint)]">team replied</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--d-ink-faint)]">
                    {ageStr(t.created_at)}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="mt-2 space-y-2 pl-2">
                  {loadingDetails && (
                    <div className="text-[11px] text-[var(--d-ink-faint)]">
                      Sign in your wallet to view this ticket…
                    </div>
                  )}
                  {detailErr && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
                      {detailErr}
                      <button
                        onClick={() => fetchDetails(t.id)}
                        className="ml-2 underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {details && (
                    <>
                      <div className="rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)]">
                          Your message
                        </div>
                        <div className="whitespace-pre-wrap text-xs text-[var(--d-ink-soft)]">
                          {details.message}
                        </div>
                      </div>
                      {details.admin_reply && (
                        <div className="rounded-md border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 px-3 py-2">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--d-accent-deep)]">
                              Team reply
                              {details.auto_resolved_at && (
                                <span className="ml-1 normal-case text-[var(--d-ink-faint)]">
                                  · AI agent
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--d-ink-faint)]">
                              {ageStr(details.admin_replied_at)}
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap text-xs text-[var(--d-ink)]">
                            {details.admin_reply.replace(/^\[auto-resolved by agent[^\]]*\]\n?\n?/, "")}
                          </div>
                        </div>
                      )}
                      {details.followup_count > 0 && (
                        <div className="text-[10px] text-[var(--d-ink-faint)]">
                          Your follow-ups: {details.followup_count}
                        </div>
                      )}
                    </>
                  )}

                  {t.status !== "closed" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setFollowupFor(followupFor === t.id ? null : t.id);
                          setFollowupText("");
                          setError(null);
                        }}
                        className="rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                      >
                        {followupFor === t.id ? "Cancel follow-up" : "Follow up"}
                      </button>
                      <button
                        onClick={() => handleClose(t.id)}
                        disabled={submitting}
                        className="rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)] disabled:opacity-50"
                      >
                        Mark resolved
                      </button>
                    </div>
                  )}

                  {t.status === "closed" && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={submitting}
                      className="text-[10px] text-[var(--d-ink-faint)] hover:text-red-500 underline disabled:opacity-50"
                    >
                      Delete this ticket
                    </button>
                  )}

                  {followupFor === t.id && (
                    <div className="space-y-2">
                      <textarea
                        value={followupText}
                        onChange={(e) => setFollowupText(e.target.value)}
                        placeholder="Add to this ticket — the AI agent will take another look."
                        rows={3}
                        maxLength={3500}
                        className="w-full rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-xs text-[var(--d-ink)] placeholder:text-[var(--d-ink-faint)]"
                      />
                      <button
                        onClick={() => handleFollowUp(t.id)}
                        disabled={submitting || followupText.trim().length < 2}
                        className="w-full rounded-md bg-[var(--d-accent-deep)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--d-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? "Signing & sending…" : "Sign & send follow-up"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
