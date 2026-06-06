"use client";

/**
 * Floating AI chat for linked users.
 *
 * Fixed bottom-right button that opens a slide-up chat panel. Each user
 * message is signed with Phantom and routed to /api/v1/ai/chat — the
 * same agent that powers /support in TG and the dashboard's ticket
 * widget, but without creating a ticket.
 *
 * Hidden for non-linked users (there's no Magpie account to chat
 * against yet — the LinkToTelegram component prompts them first).
 */
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteAiChat, siteAiReset } from "@/lib/solana/site-ai-chat";

type Turn = { role: "user" | "agent"; text: string };

export default function FloatingAiChat({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey, signMessage } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [linked, setLinked] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Resolve linked status once the wallet is connected.
  useEffect(() => {
    if (!walletStr || !botApiUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/link/status?wallet=${walletStr}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setLinked(!!j.linked);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletStr, botApiUrl]);

  // Auto-scroll to the latest message when turns change.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !walletStr || !signMessage) return;
    setError(null);
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text }]);
    setInput("");
    try {
      const r = await siteAiChat({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        message: text,
      });
      setTurns((t) => [...t, { role: "agent", text: r.response }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // Roll back the optimistic user turn so they can edit & retry.
      setTurns((t) => t.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!walletStr || !signMessage) return;
    setError(null);
    setBusy(true);
    try {
      await siteAiReset({ botApiUrl, signerPubkey: walletStr, signMessage });
      setTurns([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (linked !== true) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI chat"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--d-accent-deep)] text-white shadow-lg hover:bg-[var(--d-accent)] hover:scale-105 transition-all"
        style={{
          // Respect iOS home indicator + Android nav bar safe areas.
          bottom: "max(env(safe-area-inset-bottom, 1rem), 1rem)",
        }}
      >
        {open ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40 flex w-[calc(100vw-2rem)] max-w-[400px] flex-col rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] shadow-2xl"
          style={{
            bottom: "max(env(safe-area-inset-bottom, 4.5rem), 4.5rem)",
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--d-border)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--d-ink)]">Ask Magpie</div>
              <div className="text-[10px] text-[var(--d-ink-faint)]">
                AI agent · doesn't open a ticket
              </div>
            </div>
            {turns.length > 0 && (
              <button
                onClick={handleReset}
                disabled={busy}
                className="text-[10px] text-[var(--d-ink-faint)] hover:text-[var(--d-accent-deep)] underline disabled:opacity-50"
              >
                Reset
              </button>
            )}
          </div>

          <div ref={scrollRef} className="max-h-[420px] min-h-[180px] overflow-y-auto px-4 py-3 space-y-3">
            {turns.length === 0 && (
              <div className="text-xs text-[var(--d-ink-faint)] leading-relaxed">
                Ask anything about your loans, credit score, $MAGPIE rewards, or how the protocol works. Each message is signed with your wallet.
              </div>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
                  t.role === "user"
                    ? "ml-6 border border-[var(--d-border)] bg-[var(--d-bg-card)] text-[var(--d-ink)]"
                    : "mr-6 border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 text-[var(--d-ink)]"
                }`}
              >
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            ))}
            {busy && (
              <div className="mr-6 rounded-md border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 px-3 py-2 text-xs text-[var(--d-ink-faint)]">
                Thinking…
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-[var(--d-border)] px-4 py-2 text-[11px] text-red-500">
              {error}
            </div>
          )}

          <div className="border-t border-[var(--d-border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a question…"
                rows={2}
                maxLength={2800}
                disabled={busy}
                className="flex-1 resize-none rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-xs text-[var(--d-ink)] placeholder:text-[var(--d-ink-faint)] disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={busy || input.trim().length === 0}
                className="shrink-0 rounded-md bg-[var(--d-accent-deep)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--d-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <div className="mt-1 text-[10px] text-[var(--d-ink-faint)]">
              Enter to send · Shift+Enter for newline
            </div>
          </div>
        </div>
      )}
    </>
  );
}
