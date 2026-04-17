"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ─── Types ─── */
type Line = {
  text: string;
  bold?: boolean;
  muted?: boolean;
  mono?: boolean;
  accent?: boolean;
};

type ChatButton = {
  text: string;
  accent: boolean;
};

type Message = {
  from: "user" | "bot";
  text?: string;
  lines?: Line[];
  buttons?: ChatButton[];
  highlight?: boolean;
};

type Step = {
  id: string;
  label: string;
  caption: string;
  messages: Message[];
};

/* ─── Flow steps ─── */
const STEPS: Step[] = [
  {
    id: "start",
    label: "Open the bot",
    caption: "Search @magpie_capital_bot on Telegram and tap Start.",
    messages: [
      {
        from: "user",
        text: "/start",
      },
      {
        from: "bot",
        lines: [
          { bold: true, text: "Welcome to Magpie" },
          { text: "Borrow SOL against your memecoin bags." },
          { text: "" },
          { text: "I've created a secure wallet for you." },
          { muted: true, text: "You can export your keys anytime with /export" },
        ],
      },
    ],
  },
  {
    id: "deposit",
    label: "Get your address",
    caption: "Use /deposit to see where to send your tokens.",
    messages: [
      {
        from: "user",
        text: "/deposit",
      },
      {
        from: "bot",
        lines: [
          { bold: true, text: "Your deposit address" },
          { mono: true, accent: true, text: "5fh2K8...xP3q8Qz1" },
          { text: "" },
          { text: "Send any supported memecoin to this address." },
          { muted: true, text: "I'll notify you when the deposit confirms." },
        ],
      },
    ],
  },
  {
    id: "detected",
    label: "Deposit detected",
    caption: "Send tokens. Magpie watches on-chain and notifies you instantly.",
    messages: [
      {
        from: "bot",
        highlight: true,
        lines: [
          { bold: true, accent: true, text: "✓ Deposit detected" },
          { text: "" },
          {
            text: "8,000 WIF",
            bold: true,
          },
          { muted: true, text: "Worth ~$1,760 at current price" },
          { text: "" },
          { muted: true, text: "Confirmed in 8.4s · sig 4k2p...9mNz" },
        ],
      },
    ],
  },
  {
    id: "borrow",
    label: "Get a quote",
    caption: "Pick your tier. See exact payout, fee, and liquidation price before you commit.",
    messages: [
      {
        from: "user",
        text: "/borrow",
      },
      {
        from: "bot",
        lines: [
          { bold: true, text: "Loan quote for 8,000 WIF" },
          { text: "" },
          { text: "Express · 30% LTV · 2 days" },
          {
            text: "You receive: 3.25 SOL",
            bold: true,
          },
          { muted: true, text: "Fee: 0.05 SOL (1.5%)" },
          { muted: true, text: "Repay: 3.30 SOL" },
          { muted: true, text: "Liq. price: $0.156 per WIF" },
        ],
        buttons: [
          { text: "✓ Confirm", accent: true },
          { text: "Change tier", accent: false },
        ],
      },
    ],
  },
  {
    id: "funded",
    label: "SOL received",
    caption: "Confirm the loan. SOL hits your wallet in under 10 seconds.",
    messages: [
      {
        from: "bot",
        highlight: true,
        lines: [
          { bold: true, accent: true, text: "✓ Loan funded" },
          { text: "" },
          {
            text: "3.25 SOL sent to your wallet",
            bold: true,
          },
          { text: "" },
          { muted: true, text: "Due: April 19, 2026 at 4:32 PM" },
          { muted: true, text: "Repay anytime with /repay" },
          { text: "" },
          { muted: true, text: "Funded in 8.2s · sig 7xBm...2pKq" },
        ],
      },
    ],
  },
  {
    id: "manage",
    label: "Manage your loan",
    caption: "Top-up, partial-repay, extend, or repay in full. All from the chat.",
    messages: [
      {
        from: "user",
        text: "/positions",
      },
      {
        from: "bot",
        lines: [
          { bold: true, text: "Your active loans" },
          { text: "" },
          { text: "WIF · Express · 30% LTV" },
          { text: "Borrowed: 3.25 SOL" },
          { text: "Owed: 3.30 SOL" },
          { text: "Health: ████████░░ 78%" },
          { muted: true, text: "Due in 1.3 days" },
        ],
        buttons: [
          { text: "Repay", accent: false },
          { text: "Top-up", accent: false },
          { text: "Extend", accent: false },
          { text: "Partial", accent: false },
        ],
      },
    ],
  },
];

const AUTO_ADVANCE_MS = 5000;

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  const step = STEPS[activeStep];
  const totalMessages = step.messages.length;

  const goToStep = useCallback(
    (idx: number) => {
      setActiveStep(idx);
      setMessageIndex(0);
      setIsPaused(false);
    },
    [],
  );

  // Reveal messages one at a time within a step
  useEffect(() => {
    if (messageIndex >= totalMessages - 1) return;
    const t = setTimeout(
      () => setMessageIndex((i) => Math.min(i + 1, totalMessages - 1)),
      800,
    );
    return () => clearTimeout(t);
  }, [messageIndex, totalMessages, activeStep]);

  // Auto-advance steps
  useEffect(() => {
    if (isPaused) return;
    if (messageIndex < totalMessages - 1) return;
    const t = setTimeout(() => {
      const next = (activeStep + 1) % STEPS.length;
      goToStep(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [activeStep, isPaused, messageIndex, totalMessages, goToStep]);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/"><Wordmark size={28} /></Link>
          </div>
          <nav className="flex items-center gap-8">
            <Link
              href="/"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline"
            >
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">
              Launch
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        {/* Header */}
        <div className="text-center">
          <div className="chip mx-auto mb-5">How it works</div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.04em] md:text-7xl">
            From zero to <span className="italic text-[var(--accent-deep)]">funded</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
            Watch the full loan flow, step by step. Everything happens inside a
            Telegram chat.
          </p>
        </div>

        {/* Main demo area */}
        <div className="mt-16 grid grid-cols-1 items-start gap-12 md:grid-cols-2 md:gap-20">
          {/* Left: step list */}
          <div className="order-2 md:order-1">
            <div className="flex flex-col gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goToStep(i)}
                  className={`group flex items-start gap-4 rounded-2xl px-5 py-4 text-left transition ${
                    i === activeStep
                      ? "bg-[var(--bg-elevated)] border border-[var(--ink)] shadow-sm"
                      : "border border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--hairline)]"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition ${
                      i === activeStep
                        ? "bg-[var(--accent)] text-[var(--ink)]"
                        : i < activeStep
                          ? "bg-[var(--ink)] text-[var(--bg-elevated)]"
                          : "bg-[var(--surface)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {i < activeStep ? "✓" : String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div
                      className={`text-base font-semibold tracking-tight ${
                        i === activeStep ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                      }`}
                    >
                      {s.label}
                    </div>
                    {i === activeStep && (
                      <div className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                        {s.caption}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="mt-8 flex items-center gap-4 px-5">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold transition hover:border-[var(--ink)]"
              >
                {isPaused ? "▶ Play" : "❚❚ Pause"}
              </button>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeStep
                        ? "w-6 bg-[var(--accent)]"
                        : "w-1.5 bg-[var(--hairline-strong)] hover:bg-[var(--ink-soft)]"
                    }`}
                  />
                ))}
              </div>
              <div className="ml-auto text-xs tabular text-[var(--ink-faint)]">
                {activeStep + 1} / {STEPS.length}
              </div>
            </div>
          </div>

          {/* Right: phone mockup */}
          <div className="order-1 md:order-2 md:sticky md:top-28">
            <div className="phone-frame mx-auto w-full max-w-[360px]">
              <div className="phone-screen aspect-[9/19.5] w-full flex flex-col">
                {/* TG Header */}
                <div className="flex items-center gap-3 border-b border-white/5 bg-[#17212b] px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]">
                    <Mark size={26} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-white">Magpie</div>
                    <div className="text-[10px] text-white/50">bot · online</div>
                  </div>
                </div>

                {/* Chat body */}
                <div className="flex-1 flex flex-col gap-3 overflow-hidden bg-[#0e1621] px-3 py-4 text-[12px] leading-relaxed">
                  {step.messages.map((msg, mi) => (
                    <div
                      key={`${activeStep}-${mi}`}
                      className={`transition-all duration-500 ${
                        mi <= messageIndex
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-4"
                      }`}
                    >
                      {msg.from === "user" && msg.text ? (
                        <UserBubble text={msg.text} />
                      ) : msg.lines ? (
                        <BotBubble
                          lines={msg.lines}
                          buttons={msg.buttons}
                          highlight={msg.highlight}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-2 border-t border-white/5 bg-[#17212b] px-3 py-2.5">
                  <div className="flex-1 rounded-full bg-[#242f3d] px-3 py-2 text-[11px] text-white/30">
                    Message...
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="black"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative mt-24 overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--ink)] p-10 text-center text-white md:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-5xl">
              Ready to try it <span className="italic text-[var(--accent)]">yourself</span>?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/70">
              The whole flow takes under 30 seconds. Open the bot, pledge your
              bag, get SOL.
            </p>
            <a href={TELEGRAM_URL} className="btn-accent mt-10 text-lg">
              Open @magpie_capital_bot
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex items-center gap-8 text-sm text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--ink)]">
              Home
            </Link>
            <Link href="/dashboard" className="transition hover:text-[var(--ink)]">
              Dashboard
            </Link>
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--ink)]">
              Telegram
            </a>
            <a href="https://x.com/MagpieLending" target="_blank" rel="noopener noreferrer" className="transition hover:text-[var(--ink)]">
              X
            </a>
          </div>
          <div className="text-xs text-[var(--ink-soft)]">
            © {new Date().getFullYear()} Magpie
          </div>
        </div>
      </footer>
    </div>
  );
}

function BotBubble({
  lines,
  buttons,
  highlight,
}: {
  lines: Line[];
  buttons?: ChatButton[];
  highlight?: boolean;
}) {
  return (
    <div className="max-w-[85%]">
      <div
        className={`rounded-2xl rounded-bl-md px-3 py-2.5 ${
          highlight
            ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30"
            : "bg-[#182533]"
        }`}
      >
        {lines.map((line, i) =>
          line.text === "" ? (
            <div key={i} className="h-2" />
          ) : (
            <div
              key={i}
              className={`${line.bold ? "font-semibold" : ""} ${
                line.muted ? "text-white/45 text-[10px]" : "text-white/85"
              } ${line.mono ? "font-mono text-[11px] rounded bg-black/30 px-1.5 py-1 mt-1 break-all" : ""} ${
                line.accent ? "text-[var(--accent)]" : ""
              }`}
            >
              {line.text}
            </div>
          ),
        )}
      </div>
      {buttons && buttons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {buttons.map((btn) => (
            <div
              key={btn.text}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                btn.accent
                  ? "bg-[var(--accent)] text-black"
                  : "bg-white/10 text-white"
              }`}
            >
              {btn.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[78%]">
      <div className="rounded-2xl rounded-br-md bg-[#2b5278] px-3 py-2 text-white">
        {text}
      </div>
    </div>
  );
}
