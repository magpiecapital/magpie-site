"use client";

/**
 * Pip — Magpie's resident AI agent.
 *
 * Site-wide floating chat. Polished to feel like a real chat app:
 *
 *   • Markdown in agent responses (bullets, bold, links, code)
 *   • Chat history persists across page navigation + sessions
 *     (per linked-wallet pubkey, scoped via localStorage)
 *   • Keyboard shortcuts: Cmd/Ctrl+K to open, Esc to close
 *   • Smooth open/close + message-arrival animations
 *   • Auto-grow textarea
 *   • Avatar pulses while Pip is thinking
 *   • Graceful states for not-connected and not-linked users
 *
 * Backed by /api/v1/ai/chat (signed Ed25519 per message). The
 * agent's tools, knowledge, and persona live in the bot's
 * src/services/ai-support.js system prompt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  siteAiChat,
  siteAiReset,
  clearCachedSession,
  getCachedSessionExpiry,
} from "@/lib/solana/site-ai-chat";

type Turn = {
  role: "user" | "agent";
  text: string;
  at: number;
  /** When true, the bubble animates the text in word-by-word (used
   *  for freshly-arrived agent responses to feel like streaming). */
  streaming?: boolean;
};

const AGENT_NAME = "Pip";
const STORAGE_PREFIX = "magpie-pip-chat:";
const MAX_PERSISTED_TURNS = 50;

/* ─────────────── Avatar ─────────────── */
function PipAvatar({ size = 32, pulsing = false }: { size?: number; pulsing?: boolean }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden ${pulsing ? "pip-avatar-pulse" : ""}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)",
        color: "var(--accent-ink)",
        boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)",
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 32 32" fill="currentColor">
        {/* Stylized magpie head — distinctive silhouette */}
        <path d="M22 6c-3 0-5.5 2-6.5 4.7L13 11c-3.5-.3-7 2-7 5.7 0 2.5 1.7 4.7 4 5.5v1.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-1h6.5c4.1 0 7.5-3.4 7.5-7.5 0-1 .8-1.7 1.7-1.7.2 0 .5-.2.5-.5s-.2-.5-.5-.5C25.6 12 24 10.4 24 8.5c0-1.4 1-2.5 2.3-2.5h.2c.3 0 .5-.2.5-.5s-.2-.5-.5-.5L22 6zm-3 3.5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z" />
      </svg>
      <style jsx>{`
        @keyframes pip-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        :global(.pip-avatar-pulse) {
          animation: pip-pulse 1.4s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}

/* ─────────────── Streaming bubble ───────────────
   Animates an agent response in word-by-word, then swaps to full
   markdown rendering once complete. Gives the "feels-like-streaming"
   UX without requiring real SSE on the backend. */
function StreamingBubble({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    setVisibleChars(0);
    if (!text) return;
    // ~16ms per char gives a snappy stream that finishes a 200-char
    // response in ~3s. Short messages still feel fast.
    const interval = setInterval(() => {
      setVisibleChars((c) => {
        // Speed up gradually so long messages don't drag.
        const step = Math.max(2, Math.ceil(c / 50));
        const next = c + step;
        if (next >= text.length) {
          clearInterval(interval);
          // Defer the onComplete callback to the next tick so we
          // don't dispatch a state update during render.
          setTimeout(onComplete, 0);
          return text.length;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  const partial = text.slice(0, visibleChars);
  return (
    <div className="whitespace-pre-wrap">
      {partial}
      {visibleChars < text.length && (
        <span
          className="inline-block w-[2px] h-[1em] align-middle ml-0.5 animate-pulse"
          style={{ background: "var(--ink-soft)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ─────────────── Slash-command pill ───────────────
   Pip frequently mentions bot commands like /repay or /borrow. We
   turn those into tappable pills: tap = copy command + open the TG
   bot so the user can paste in one motion. */
function SlashCommandPill({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(command).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (typeof window !== "undefined") {
      window.open("https://t.me/magpie_capital_bot", "_blank", "noopener,noreferrer");
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied! Opening @magpie_capital_bot…" : `Copy ${command} + open Telegram bot`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.88em] font-medium transition-colors hover:opacity-80 active:scale-95"
      style={{
        background: "var(--accent-dim)",
        color: "var(--accent-deep)",
        border: "1px solid var(--accent-deep)",
      }}
    >
      {copied ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : null}
      {command}
    </button>
  );
}

const SLASH_COMMAND_RE = /^\/[a-z][a-z0-9_-]{1,30}$/i;

/* ─────────────── Markdown bubble ─────────────── */
function MarkdownBubble({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Inline + block styling that matches Pip's bubble. We keep
        // the bubble div outside; this just styles the content within.
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-5 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-snug">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
            style={{ color: "var(--accent-deep)" }}
          >
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => {
          // If the code content is a slash command, render it as a
          // tappable pill instead of inert mono text. Makes "use
          // /repay to close your loan" actionable in one tap.
          const text = String(children ?? "").trim();
          if (SLASH_COMMAND_RE.test(text)) {
            return <SlashCommandPill command={text} />;
          }
          return (
            <code
              className="rounded px-1 py-0.5 font-mono text-[0.9em]"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre
            className="my-2 overflow-x-auto rounded-md p-2 font-mono text-[0.85em] leading-snug"
            style={{ background: "rgba(0,0,0,0.06)" }}
          >
            {children}
          </pre>
        ),
        h1: ({ children }) => <div className="font-semibold text-base mb-1">{children}</div>,
        h2: ({ children }) => <div className="font-semibold text-sm mb-1">{children}</div>,
        h3: ({ children }) => <div className="font-semibold text-sm mb-1">{children}</div>,
        hr: () => <hr className="my-2 opacity-30" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ─────────────── Main ─────────────── */
// Hard-coded fallback so the floating chat works even if the
// NEXT_PUBLIC_BOT_API_URL env var isn't inlined into a given build
// (this kept happening on Vercel for client-only components — the
// dashboard widgets work because they receive the URL as a prop
// from page.tsx, which is built differently). The env var still
// wins when set so test/staging deploys can override.
const DEFAULT_BOT_API = "https://magpie-bot-production.up.railway.app";

export default function FloatingAiChatGlobal() {
  const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || DEFAULT_BOT_API;
  const { publicKey, signMessage, connected } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;
  const pathname = usePathname();

  // linked: null = checking, true/false = resolved, "error" = network failure
  const [linked, setLinked] = useState<boolean | "error" | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkCheckCount, setLinkCheckCount] = useState(0); // bump to retry
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  /* ── Storage key scoped to wallet pubkey ── */
  const storageKey = useMemo(
    () => (walletStr ? `${STORAGE_PREFIX}${walletStr}` : null),
    [walletStr],
  );

  /* ── Load persisted history when wallet connects ── */
  useEffect(() => {
    if (!storageKey) {
      setTurns([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTurns(parsed.slice(-MAX_PERSISTED_TURNS));
      }
    } catch {
      /* corrupt entry — ignore */
    }
  }, [storageKey]);

  /* ── Persist on changes ── */
  useEffect(() => {
    if (!storageKey) return;
    try {
      // Strip the in-flight `streaming` flag before persisting — we
      // never want to re-stream messages from disk on reload.
      const sanitized = turns.slice(-MAX_PERSISTED_TURNS).map((t) =>
        t.streaming ? { ...t, streaming: false } : t,
      );
      localStorage.setItem(storageKey, JSON.stringify(sanitized));
    } catch {
      /* quota / blocked — silently skip */
    }
  }, [turns, storageKey]);

  /* ── Resolve linked status (with timeout + error state + retry) ── */
  useEffect(() => {
    if (!walletStr) {
      setLinked(null);
      setLinkError(null);
      return;
    }
    if (!botApiUrl) {
      setLinked("error");
      setLinkError("NEXT_PUBLIC_BOT_API_URL not configured");
      return;
    }
    let cancelled = false;
    setLinked(null);
    setLinkError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/link/status?wallet=${walletStr}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!r.ok) {
          if (!cancelled) {
            setLinked("error");
            setLinkError(`HTTP ${r.status} from ${botApiUrl}`);
          }
          return;
        }
        const j = await r.json();
        if (!cancelled) setLinked(!!j.linked);
      } catch (e) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("[pip] link/status fetch failed:", e, "url:", botApiUrl);
          setLinked("error");
          setLinkError(`${msg} (url: ${botApiUrl || "<empty>"})`);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [walletStr, botApiUrl, linkCheckCount]);

  const retryLinkCheck = useCallback(() => {
    setLinkCheckCount((n) => n + 1);
  }, []);

  /* ── Auto-scroll, but only when already at the bottom ──
     Common chat pattern: don't yank the user back down if they've
     scrolled up to re-read something. If they ARE at the bottom,
     new messages do auto-scroll. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Auto-scroll if user is within 80px of the bottom.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    } else {
      // User is reading older messages — surface the scroll-down hint.
      setShowScrollDown(true);
    }
  }, [turns, busy]);

  /* ── Track scroll position so we can hide the scroll-down button
        when the user reaches the bottom naturally ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom >= 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollDown(false);
  }, []);

  /* ── Focus textarea when panel opens ── */
  useEffect(() => {
    if (open && linked === true) {
      const t = setTimeout(() => textareaRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open, linked]);

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const t = textareaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
  }, [input]);

  /* ── Keyboard shortcuts: Cmd/Ctrl+K to open, Esc to close ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ── Send + reset ── */
  // Core send logic, accepts the message text directly. Used by:
  //   - handleSend (typed message from the textarea)
  //   - suggestion chips (one-click send without going through input)
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !walletStr || !signMessage || linked !== true || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    setTurns((t) => [...t, { role: "user", text: trimmed, at: Date.now() }]);
    try {
      const r = await siteAiChat({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        message: trimmed,
        pageContext: pathname || undefined,
      });
      setTurns((t) => [...t, { role: "agent", text: r.response, at: Date.now(), streaming: true }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns((t) => t.slice(0, -1));
      setInput(trimmed);
    } finally {
      setBusy(false);
    }
  }, [walletStr, signMessage, linked, busy, botApiUrl, pathname]);

  const handleSend = useCallback(() => sendMessage(input), [sendMessage, input]);

  const handleReset = useCallback(async () => {
    if (!walletStr || !signMessage) return;
    setError(null);
    setBusy(true);
    try {
      await siteAiReset({ botApiUrl, signerPubkey: walletStr, signMessage });
      setTurns([]);
      if (storageKey) localStorage.removeItem(storageKey);
      // Also clear the Pip session token so the next message uses a
      // fresh sign-in. Optional but matches user expectation of
      // "Clear = everything resets".
      clearCachedSession(walletStr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [walletStr, signMessage, botApiUrl, storageKey]);

  /* ── Track cached Pip session for UI status ── */
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  useEffect(() => {
    if (!walletStr) {
      setSessionExpiry(null);
      return;
    }
    setSessionExpiry(getCachedSessionExpiry(walletStr));
    // Re-check every minute so the indicator stays fresh.
    const id = setInterval(() => setSessionExpiry(getCachedSessionExpiry(walletStr)), 60_000);
    return () => clearInterval(id);
  }, [walletStr, turns.length]); // also bumps after each send

  /* ── Copy-to-clipboard for agent messages ── */
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const handleCopy = useCallback((idx: number, text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
      },
      () => { /* clipboard blocked */ },
    );
  }, []);

  /* ── Suggestions adapt to the current page ── */
  const suggestions = useMemo(() => {
    const path = pathname || "/";
    // Per-page starter prompts. Picked to be specific enough to feel
    // smart but generic enough to work for any user. Pip's tool
    // access fills in the personal details.
    if (path.startsWith("/credit")) {
      return [
        "What's my credit score?",
        "How do I improve it?",
        "What does my tier unlock?",
      ];
    }
    if (path.startsWith("/tokens")) {
      return [
        "Which tokens have the lowest fees?",
        "How do tokenized stocks work as collateral?",
        "What's a safe LTV for memecoins?",
      ];
    }
    if (path.startsWith("/earn") || path.startsWith("/vault")) {
      return [
        "What's the LP APY right now?",
        "How does LP loyalty work?",
        "Is it safe to deposit?",
      ];
    }
    if (path.startsWith("/refer")) {
      return [
        "How much have I earned from referrals?",
        "How do payouts work?",
        "Share my code",
      ];
    }
    if (path.startsWith("/holders")) {
      return [
        "How are $MAGPIE rewards calculated?",
        "When is the next distribution?",
        "Show me my pending payout",
      ];
    }
    if (path.startsWith("/dashboard")) {
      return [
        "Show me my active loans",
        "Why did my health drop?",
        "What can I borrow right now?",
      ];
    }
    if (path.startsWith("/leaderboard")) {
      return [
        "How do I get on the leaderboard?",
        "What's the highest possible score?",
        "Why is my score behind?",
      ];
    }
    if (path.startsWith("/status")) {
      return [
        "Is everything working?",
        "What does each check mean?",
        "When was the last outage?",
      ];
    }
    if (path.startsWith("/privacy") || path.startsWith("/security")) {
      return [
        "What data does Magpie store?",
        "How do I lock my account?",
        "Can I export my data?",
      ];
    }
    if (path.startsWith("/submit")) {
      return [
        "What does the token review check?",
        "How long does approval take?",
        "Why was a token declined?",
      ];
    }
    if (path.startsWith("/docs") || path.startsWith("/whitepaper")) {
      return [
        "How does liquidation work?",
        "What's the fee split?",
        "How is the credit score calculated?",
      ];
    }
    // Homepage + everything else: broadly useful prompts.
    return [
      "What's my credit score?",
      "How do referral rewards work?",
      "What can I borrow right now?",
      "Walk me through the protocol",
    ];
  }, [pathname]);

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Close ${AGENT_NAME}` : `Open ${AGENT_NAME}`}
        title={`${open ? "Close" : "Open"} ${AGENT_NAME} (⌘K)`}
        className="fixed right-4 sm:right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform hover:scale-105"
        style={{
          bottom: "max(env(safe-area-inset-bottom, 1rem), 1rem)",
          background: open ? "var(--ink)" : "transparent",
          color: open ? "var(--bg-elevated)" : "inherit",
          border: open ? "none" : "none",
          boxShadow: open ? "var(--shadow-md)" : "var(--shadow-amber, 0 16px 40px -16px rgba(247, 201, 72, 0.55))",
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <PipAvatar size={56} pulsing={busy && !open} />
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed right-4 sm:right-6 z-[60] flex flex-col rounded-2xl border shadow-2xl overflow-hidden pip-panel ${open ? "pip-panel-open" : ""}`}
        style={{
          bottom: "max(env(safe-area-inset-bottom, 5.5rem), 5.5rem)",
          width: "calc(100vw - 2rem)",
          maxWidth: "min(480px, calc(100vw - 2rem))",
          height: "min(640px, calc(100vh - 8rem))",
          background: "var(--bg-elevated, var(--bg))",
          borderColor: "var(--hairline)",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 shrink-0"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <PipAvatar size={36} pulsing={busy} />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                {AGENT_NAME}
              </div>
              <div className="text-[11px] leading-tight flex items-center gap-1" style={{ color: "var(--ink-soft)" }}>
                {busy ? (
                  <>
                    <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-deep)" }} />
                    thinking…
                  </>
                ) : (
                  <>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
                    {sessionExpiry
                      ? `signed in · ${(() => {
                          const hours = Math.max(0, Math.floor((sessionExpiry - Date.now()) / 3_600_000));
                          if (hours >= 1) return `${hours}h left`;
                          const mins = Math.max(1, Math.floor((sessionExpiry - Date.now()) / 60_000));
                          return `${mins}m left`;
                        })()}`
                      : "online · always here"}
                  </>
                )}
              </div>
            </div>
          </div>
          {linked === true && (turns.length > 0 || sessionExpiry) && (
            <button
              onClick={handleReset}
              disabled={busy}
              className="text-[11px] underline hover:opacity-80 disabled:opacity-50"
              style={{ color: "var(--ink-soft)" }}
              title="Clear chat history + sign out of Pip"
            >
              Clear
            </button>
          )}
        </div>

        {/* Body — iMessage-style tight stack with subtle background.
            Wrapped so the scroll-down button can absolute-position
            over the scroll region without affecting layout. */}
        <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-4 py-3"
          style={{ background: "var(--bg)" }}
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
                Hey, I'm <span className="font-semibold">{AGENT_NAME}</span>.
              </p>
              <p className="mt-2">
                Connect a Solana wallet to chat. I help with loans, repayments, the protocol — and I'll happily get sidetracked if you want.
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
                Each message is signed with your wallet.
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
                Almost there — link your wallet to chat.
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
                  <code className="rounded px-1" style={{ background: "var(--hairline)", color: "var(--ink)" }}>
                    /link &lt;code&gt;
                  </code>
                </li>
              </ol>
            </div>
          )}

          {connected && linked === null && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--ink-faint)" }} />
              Checking your account…
            </div>
          )}

          {connected && linked === "error" && (
            <div
              className="rounded-xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                borderColor: "var(--hairline)",
                background: "var(--surface)",
                color: "var(--ink-soft)",
              }}
            >
              <p style={{ color: "var(--ink)" }} className="font-semibold">
                Couldn&apos;t reach Magpie just now.
              </p>
              <p className="mt-2 text-xs">
                Looks like a network hiccup or the bot is restarting. Pip will be back in a second.
              </p>
              {linkError && (
                <p
                  className="mt-2 font-mono text-[10px] break-all"
                  style={{ color: "var(--ink-faint)" }}
                >
                  {linkError}
                </p>
              )}
              <button
                onClick={retryLinkCheck}
                className="mt-3 rounded-full border px-3 py-1.5 text-[11px] font-medium hover:opacity-80"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--bg-elevated)",
                  color: "var(--ink)",
                }}
              >
                Try again
              </button>
            </div>
          )}

          {connected && linked === true && turns.length === 0 && (
            <div className="space-y-3 pip-turn">
              <div className="flex gap-2 mt-2">
                <div className="w-7 shrink-0">
                  <PipAvatar size={26} />
                </div>
                <div
                  className="rounded-3xl rounded-bl-md px-3.5 py-2 text-[13.5px] leading-snug max-w-[82%]"
                  style={{
                    background: "var(--surface)",
                    color: "var(--ink)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  Hey, I&apos;m <span className="font-semibold">{AGENT_NAME}</span>. Here to help with anything Magpie — loans, your credit, $MAGPIE, the protocol. Got something specific?
                  <span className="mt-1.5 block text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    First message asks Phantom to sign in once · 24h session after that
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 ml-9">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    disabled={busy}
                    className="rounded-full border px-3 py-1 text-[11px] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: "var(--hairline)",
                      color: "var(--ink-soft)",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => {
            // iMessage-style grouping: consecutive messages from the
            // same sender stack tightly + only the first one shows
            // the avatar. Feels like real text threads.
            const prev = turns[i - 1];
            const isFirstOfGroup = !prev || prev.role !== t.role;
            const next = turns[i + 1];
            const isLastOfGroup = !next || next.role !== t.role;
            return (
              <div
                key={i}
                className={`pip-turn flex gap-2 group ${t.role === "user" ? "flex-row-reverse" : ""} ${
                  isFirstOfGroup ? "mt-2" : "mt-0.5"
                }`}
              >
                {t.role === "agent" && (
                  <div className="w-7 shrink-0">
                    {isFirstOfGroup && <PipAvatar size={26} />}
                  </div>
                )}
                <div className="relative max-w-[80%]">
                  <div
                    className={`px-3.5 py-2 text-[13.5px] leading-snug ${
                      t.role === "user"
                        ? `rounded-3xl ${isLastOfGroup ? "rounded-br-md" : ""}`
                        : `rounded-3xl ${isLastOfGroup ? "rounded-bl-md" : ""}`
                    }`}
                    style={
                      t.role === "user"
                        ? {
                            background: "var(--accent)",
                            color: "var(--accent-ink)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          }
                        : {
                            background: "var(--surface)",
                            color: "var(--ink)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          }
                    }
                  >
                    {t.role === "user" ? (
                      <div className="whitespace-pre-wrap">{t.text}</div>
                    ) : t.streaming ? (
                      <StreamingBubble
                        text={t.text}
                        onComplete={() => {
                          setTurns((arr) => {
                            const copy = arr.slice();
                            if (copy[i]?.streaming) copy[i] = { ...copy[i], streaming: false };
                            return copy;
                          });
                        }}
                      />
                    ) : (
                      <MarkdownBubble text={t.text} />
                    )}
                  </div>
                  {/* Copy button — appears on hover, only on Pip's messages */}
                  {t.role === "agent" && (
                    <button
                      onClick={() => handleCopy(i, t.text)}
                      aria-label="Copy message"
                      title={copiedIdx === i ? "Copied!" : "Copy"}
                      className="absolute -right-1 -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-6 w-6 flex items-center justify-center text-[10px]"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--ink-soft)",
                        border: "1px solid var(--hairline)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      {copiedIdx === i ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="pip-turn flex gap-2 mt-2">
              <div className="w-7 shrink-0">
                <PipAvatar size={26} pulsing />
              </div>
              <div
                className="rounded-3xl rounded-bl-md px-4 py-2.5"
                style={{
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full pip-dot-1" style={{ background: "var(--ink-faint)" }} />
                  <span className="h-1.5 w-1.5 rounded-full pip-dot-2" style={{ background: "var(--ink-faint)" }} />
                  <span className="h-1.5 w-1.5 rounded-full pip-dot-3" style={{ background: "var(--ink-faint)" }} />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Scroll-to-bottom — only shown when user is scrolled up */}
        {showScrollDown && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            className="absolute right-3 bottom-3 h-8 w-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-90 active:scale-95"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--ink-soft)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
        </div>

        {error && (
          <div
            className="border-t px-4 py-2 text-xs flex items-center justify-between gap-2"
            style={{
              borderColor: "var(--hairline)",
              background: "rgba(184, 58, 58, 0.08)",
              color: "var(--bad)",
            }}
          >
            <span className="truncate">{error}</span>
            <button onClick={() => setError(null)} className="underline shrink-0">dismiss</button>
          </div>
        )}

        {/* Composer */}
        {linked === true && (
          <div
            className="border-t p-3 shrink-0"
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
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-95"
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
            <div
              className="mt-1.5 flex items-center justify-between text-[10px] px-1"
              style={{ color: "var(--ink-faint)" }}
            >
              <span>Signed with your wallet</span>
              <span>Enter to send · ⌘K to toggle</span>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        .pip-panel {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
          transition: opacity 180ms ease, transform 180ms ease;
        }
        .pip-panel.pip-panel-open {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        @keyframes pip-turn-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pip-turn {
          animation: pip-turn-in 200ms ease-out;
        }
        @keyframes pip-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .pip-dot-1, .pip-dot-2, .pip-dot-3 {
          animation: pip-bounce 1.2s ease-in-out infinite;
        }
        .pip-dot-2 { animation-delay: 0.15s; }
        .pip-dot-3 { animation-delay: 0.30s; }
      `}</style>
    </>
  );
}
