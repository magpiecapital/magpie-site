"use client";

/**
 * Site-wide floating AI chat — meet Pip.
 *
 * Pip is Magpie's resident agent: warm, conversational, sharp on
 * protocol mechanics, world-aware enough to be human. Renders on
 * every page; works for not-connected / not-linked / linked users
 * with progressively more functionality.
 *
 * Backed by /api/v1/ai/chat (signed message per question) — same
 * AI service the bot uses for /support, so behavior is unified.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteAiChat, siteAiReset } from "@/lib/solana/site-ai-chat";

type Turn = { role: "user" | "agent"; text: string };

const AGENT_NAME = "Pip";

function PipAvatar({ size = 28 }: { size?: number }) {
  // Stylized magpie silhouette — black + white bird with a touch of
  // amber for the brand accent. Inline SVG so it's instant.
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--accent,#f7c948)] text-[var(--accent-ink,#1a1500)] shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 7c-.7-1.1-2.3-1-3 0l-1.4 1.8c-.6-.5-1.3-.8-2.1-.8-.7 0-1.4.2-2 .5L5.7 5.2c-.4-.3-1 .1-.8.6L7 11c-1.2.7-2 2-2 3.5C5 16.4 6.5 18 8.4 18h7.1c2.5 0 4.5-2 4.5-4.5 0-1.2-.5-2.3-1.2-3.1L19.5 9c.4-.5.4-1.5 0-2zm-3.4 5.8c-.5 0-1-.4-1-1s.5-1 1-1 1 .4 1 1-.5 1-1 1z" />
      </svg>
    </span>
  );
}

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  }, [turns, busy]);

  // Focus textarea when panel opens.
  useEffect(() => {
    if (open && linked === true) {
      const t = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, linked]);

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
        aria-label={open ? `Close ${AGENT_NAME}` : `Open ${AGENT_NAME}`}
        className="fixed right-4 sm:right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        style={{
          bottom: "max(env(safe-area-inset-bottom, 1rem), 1rem)",
          background: "var(--accent, #f7c948)",
          color: "var(--accent-ink, #1a1500)",
          boxShadow: "var(--shadow-amber, 0 16px 40px -16px rgba(247, 201, 72, 0.6))",
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <PipAvatar size={42} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed right-4 sm:right-6 z-[60] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            bottom: "max(env(safe-area-inset-bottom, 5.5rem), 5.5rem)",
            // Mobile: nearly full width. Tablet+: a comfortable chat-app size.
            width: "calc(100vw - 2rem)",
            maxWidth: "min(480px, calc(100vw - 2rem))",
            height: "min(640px, calc(100vh - 8rem))",
            background: "var(--bg-elevated, var(--bg, #fff))",
            borderColor: "var(--hairline, rgba(0,0,0,0.1))",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{
              borderColor: "var(--hairline, rgba(0,0,0,0.1))",
              background: "var(--surface, rgba(0,0,0,0.02))",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <PipAvatar size={36} />
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                  {AGENT_NAME}
                </div>
                <div className="text-[11px] leading-tight" style={{ color: "var(--ink-soft)" }}>
                  Magpie's resident agent · always here
                </div>
              </div>
            </div>
            {linked === true && turns.length > 0 && (
              <button
                onClick={handleReset}
                disabled={busy}
                className="text-[11px] underline hover:opacity-80 disabled:opacity-50"
                style={{ color: "var(--ink-soft)" }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Body */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ background: "var(--bg, #fff)" }}
          >
            {!connected && (
              <div
                className="rounded-xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--surface)",
                  color: "var(--ink-soft)",
                }}
              >
                <p style={{ color: "var(--ink)" }}>
                  Hi! I'm <span className="font-semibold">{AGENT_NAME}</span>. 👋
                </p>
                <p className="mt-2">
                  Connect a Solana wallet to chat. I can help with loans, repayments, the protocol — or just shoot the breeze.
                </p>
                <p className="mt-2 text-xs">
                  Each message is signed with your wallet for security.
                </p>
              </div>
            )}

            {connected && linked === false && (
              <div
                className="rounded-xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--surface)",
                  color: "var(--ink-soft)",
                }}
              >
                <p style={{ color: "var(--ink)" }} className="font-semibold">
                  Wallet connected — one more step.
                </p>
                <p className="mt-2">
                  Link your wallet to a Magpie account so I know who I'm talking to:
                </p>
                <ol className="mt-2 list-decimal pl-5 space-y-1 text-xs">
                  <li>
                    Go to{" "}
                    <Link href="/dashboard" className="font-medium underline" style={{ color: "var(--accent-deep)" }}>
                      magpie.capital/dashboard
                    </Link>{" "}
                    and tap <em>Link to Telegram</em>
                  </li>
                  <li>
                    Paste the code in{" "}
                    <a
                      href="https://t.me/magpie_capital_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                      style={{ color: "var(--accent-deep)" }}
                    >
                      @magpie_capital_bot
                    </a>{" "}
                    as{" "}
                    <code
                      className="rounded px-1"
                      style={{ background: "var(--hairline)", color: "var(--ink)" }}
                    >
                      /link &lt;code&gt;
                    </code>
                  </li>
                </ol>
              </div>
            )}

            {connected && linked === null && (
              <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Checking your account…
              </div>
            )}

            {connected && linked === true && turns.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2.5">
                  <PipAvatar size={28} />
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed max-w-[85%]"
                    style={{
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  >
                    Hey! 👋 I'm <span className="font-semibold">{AGENT_NAME}</span>, Magpie's resident agent.
                    <br />
                    <br />
                    Ask me anything — your loans, credit score, $MAGPIE, how the protocol works, or just chat. I speak whatever language you write in, and broken English is totally fine, I'll figure out what you mean.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    "What's my credit score?",
                    "Why did my loan get liquidated?",
                    "How do referral rewards work?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="rounded-full border px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
                      style={{
                        borderColor: "var(--hairline)",
                        color: "var(--ink-soft)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={`flex gap-2.5 ${t.role === "user" ? "flex-row-reverse" : ""}`}>
                {t.role === "agent" && <PipAvatar size={28} />}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%] ${
                    t.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"
                  }`}
                  style={
                    t.role === "user"
                      ? {
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                        }
                      : {
                          background: "var(--surface)",
                          color: "var(--ink)",
                        }
                  }
                >
                  <div className="whitespace-pre-wrap">{t.text}</div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex gap-2.5">
                <PipAvatar size={28} />
                <div
                  className="rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--ink-faint)", animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--ink-faint)", animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: "var(--ink-faint)", animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              className="border-t px-4 py-2 text-xs"
              style={{
                borderColor: "var(--hairline)",
                background: "rgba(184, 58, 58, 0.08)",
                color: "var(--bad)",
              }}
            >
              {error}
            </div>
          )}

          {/* Composer */}
          {linked === true && (
            <div
              className="border-t p-3"
              style={{
                borderColor: "var(--hairline)",
                background: "var(--bg-elevated, var(--bg))",
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${AGENT_NAME}…`}
                  rows={1}
                  maxLength={2800}
                  disabled={busy}
                  className="flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                  style={{
                    borderColor: "var(--hairline)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    minHeight: "44px",
                    maxHeight: "120px",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={busy || input.trim().length === 0}
                  aria-label="Send message"
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
              <div className="mt-1.5 text-[10px] px-1" style={{ color: "var(--ink-faint)" }}>
                Enter to send · Shift+Enter for newline · Signed with your wallet
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
