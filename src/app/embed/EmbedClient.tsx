"use client";

import { useState } from "react";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const DEFAULT_SYMBOL = "MAGPIE";

export default function EmbedClient() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [refCode, setRefCode] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const snippet =
    `<div data-magpie-borrow="${symbol}"` +
    (refCode ? ` data-magpie-ref="${refCode}"` : "") +
    (theme !== "light" ? ` data-magpie-theme="${theme}"` : "") +
    `></div>\n<script src="https://magpie.capital/embed/borrow-button.js" defer></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen">
      <Header />

      {/* Load the actual widget so the preview below renders */}
      <Script src="/embed/borrow-button.js" strategy="afterInteractive" />

      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="chip mb-5">For token communities</div>
          <h1 className="fade-up font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Embed Magpie
          </h1>
          <p className="fade-up fade-up-1 mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Drop a &quot;Borrow against $X&quot; button on your project&apos;s site or
            community page. Two lines of code. You earn 5% of every fee from
            users who join through your widget — forever.
          </p>
        </div>
      </section>

      {/* Builder */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Controls */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-medium tracking-[-0.01em]">
              Configure
            </h2>

            <label className="mt-6 block">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">Token symbol</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="WIF"
                className="mt-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-base focus:border-[var(--ink)] focus:outline-none"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">Your referral code <span className="normal-case opacity-60">(optional — earn 5%)</span></span>
              <input
                type="text"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                placeholder="WIFCOMM"
                className="mt-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-base focus:border-[var(--ink)] focus:outline-none"
              />
              <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                Get your code by running /refer in the bot.
              </span>
            </label>

            <div className="mt-5">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">Theme</span>
              <div className="mt-2 inline-flex gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-1">
                <button
                  onClick={() => setTheme("light")}
                  className={`rounded-md px-4 py-1.5 text-sm transition ${theme === "light" ? "bg-[var(--ink)] text-[var(--bg-elevated)]" : "hover:bg-[var(--surface)]"}`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`rounded-md px-4 py-1.5 text-sm transition ${theme === "dark" ? "bg-[var(--ink)] text-[var(--bg-elevated)]" : "hover:bg-[var(--surface)]"}`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="mt-7">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">Copy-paste snippet</span>
              <div className="mt-2 rounded-lg border border-[var(--hairline)] bg-[var(--ink)] p-4 font-mono text-xs text-[var(--bg-elevated)] overflow-x-auto whitespace-pre">{snippet}</div>
              <button
                onClick={copy}
                className="btn-accent mt-3 text-sm"
              >
                {copied ? "Copied ✓" : "Copy snippet"}
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-medium tracking-[-0.01em]">
              Live preview
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              This is exactly what visitors will see when you paste the snippet.
            </p>
            <div className="mt-6 flex items-center justify-center rounded-2xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface)] p-10 min-h-[200px]">
              {/* Force remount on changes via key */}
              <div
                key={`${symbol}-${refCode}-${theme}`}
                data-magpie-borrow={symbol}
                {...(refCode ? { "data-magpie-ref": refCode } : {})}
                {...(theme === "dark" ? { "data-magpie-theme": "dark" } : {})}
              />
            </div>

            <div className="mt-6 space-y-2 text-xs text-[var(--ink-soft)]">
              <div>• Loads asynchronously — won&apos;t block your page</div>
              <div>• ~3KB minified, no dependencies</div>
              <div>• Fetches live max-LTV from /api/v1/tokens</div>
              <div>• Falls back gracefully if API unreachable</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why use it */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em] md:text-4xl">
            Why embed
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="font-display text-4xl font-medium tracking-[-0.03em]">5%</div>
              <div className="mt-2 text-sm font-semibold">Lifetime referral fees</div>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Every user who joins through your widget pays Magpie fees on every loan, forever. You get 5% of those fees flowing to your wallet.
              </p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium tracking-[-0.03em]">2 lines</div>
              <div className="mt-2 text-sm font-semibold">Integration time</div>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                One <code>{`<div>`}</code>, one <code>{`<script>`}</code>. Drop into your site, Linktree, Notion, Discord landing page — anywhere.
              </p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium tracking-[-0.03em]">0</div>
              <div className="mt-2 text-sm font-semibold">Custodial risk</div>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Your community keeps their bag. Magpie is non-custodial, on-chain, and the live liquidation rate is verifiable on /stats.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
