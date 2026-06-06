"use client";

/**
 * Site-wide floating AI chat.
 *
 * Renders the same chat button on every page. Has three states based
 * on user context:
 *
 *   1. No wallet connected     → button still visible. Panel prompts to
 *                                connect Phantom.
 *   2. Connected, not linked   → button visible. Panel explains /link.
 *   3. Connected + linked      → full chat experience, signs each
 *                                message via Phantom.
 *
 * Lives at the root layout so no per-page wrapper / transform / overflow
 * can hide it. Positioned with safe-area-inset so it clears iOS home
 * indicators and Android nav bars.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteAiChat, siteAiReset } from "@/lib/solana/site-ai-chat";

type Turn = { role: "user" | "agent"; text: string };

export default function FloatingAiChatGlobal() {
  const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";
  const { publicKey, signMessage, connected } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [linked, setLinked] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Resolve linked status when the wallet is connected.
  useEffect(() => {
    if (!walletStr || !botApiUrl) {
      setLinked(null);
      return;
    }
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

  // Auto-scroll on new messages.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !walletStr || !signMessage || linked !== true) return;
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
      setTurns((t) => t.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }, [input, walletStr, signMessage, linked, botApiUrl]);

  const handleReset = useCallback(async () => {
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
  }, [walletStr, signMessage, botApiUrl]);

  return (
    <>
      {/* Button — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        className="fixed right-4 sm:right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent,#7a5cff)] text-white shadow-lg hover:scale-105 transition-all"
        style={{
          bottom: "max(env(safe-area-inset-bottom, 1rem), 1rem)",
          backgroundColor: "var(--accent, #7a5cff)",
        }}
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed right-4 sm:right-6 z-[60] flex w-[calc(100vw-2rem)] max-w-[400px] flex-col rounded-2xl border border-[var(--hairline,rgba(255,255,255,0.1))] bg-[var(--bg,#fff)] shadow-2xl"
          style={{
            bottom: "max(env(safe-area-inset-bottom, 4.5rem), 4.5rem)",
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--hairline,rgba(255,255,255,0.1))] px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Ask Magpie</div>
              <div className="text-[10px] text-[var(--ink-soft,#888)]">
                AI agent · doesn't open a ticket
              </div>
            </div>
            {linked === true && turns.length > 0 && (
              <button
                onClick={handleReset}
                disabled={busy}
                className="text-[10px] text-[var(--ink-soft,#888)] hover:opacity-80 underline disabled:opacity-50"
              >
                Reset
              </button>
            )}
          </div>

          {/* Body */}
          <div ref={scrollRef} className="max-h-[420px] min-h-[180px] overflow-y-auto px-4 py-3 space-y-3">
            {!connected && (
              <div className="text-xs leading-relaxed text-[var(--ink-soft,#666)]">
                <p>Connect a Solana wallet (Phantom etc.) to chat with the Magpie AI agent.</p>
                <p className="mt-2">
                  Each message is signed with your wallet for security — you'll see a sign prompt for every question.
                </p>
              </div>
            )}

            {connected && linked === false && (
              <div className="text-xs leading-relaxed text-[var(--ink-soft,#666)]">
                <p className="font-semibold text-[var(--ink,inherit)]">
                  Wallet connected, but not linked to a Magpie account.
                </p>
                <p className="mt-2">
                  Link your wallet to chat:
                </p>
                <ol className="mt-2 list-decimal pl-5 space-y-1">
                  <li>
                    Open{" "}
                    <Link href="/dashboard" className="font-medium text-[var(--accent,#7a5cff)] underline">
                      magpie.capital/dashboard
                    </Link>{" "}
                    and tap <em>Link to Telegram</em>
                  </li>
                  <li>
                    Paste the code into{" "}
                    <a
                      href="https://t.me/magpie_capital_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--accent,#7a5cff)] underline"
                    >
                      @magpie_capital_bot
                    </a>{" "}
                    as <code className="rounded bg-black/5 px-1">/link &lt;code&gt;</code>
                  </li>
                </ol>
              </div>
            )}

            {connected && linked === null && (
              <div className="text-xs text-[var(--ink-soft,#666)]">Checking your account…</div>
            )}

            {connected && linked === true && turns.length === 0 && (
              <div className="text-xs text-[var(--ink-soft,#666)] leading-relaxed">
                Ask anything about your loans, credit score, $MAGPIE rewards, or how the protocol works. Each message is signed with your wallet.
              </div>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
                  t.role === "user"
                    ? "ml-6 border border-[var(--hairline,rgba(0,0,0,0.1))] bg-black/[0.02]"
                    : "mr-6 border border-[var(--accent,#7a5cff)]/25 bg-[var(--accent,#7a5cff)]/10"
                }`}
              >
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            ))}

            {busy && (
              <div className="mr-6 rounded-md border border-[var(--accent,#7a5cff)]/25 bg-[var(--accent,#7a5cff)]/10 px-3 py-2 text-xs text-[var(--ink-soft,#666)]">
                Thinking…
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-[var(--hairline,rgba(0,0,0,0.1))] px-4 py-2 text-[11px] text-red-500">
              {error}
            </div>
          )}

          {/* Composer */}
          {linked === true && (
            <div className="border-t border-[var(--hairline,rgba(0,0,0,0.1))] p-3">
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
                  className="flex-1 resize-none rounded-md border border-[var(--hairline,rgba(0,0,0,0.1))] bg-white/5 px-3 py-2 text-xs placeholder:text-[var(--ink-soft,#aaa)] disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={busy || input.trim().length === 0}
                  className="shrink-0 rounded-md bg-[var(--accent,#7a5cff)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <div className="mt-1 text-[10px] text-[var(--ink-soft,#aaa)]">
                Enter to send · Shift+Enter for newline
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
