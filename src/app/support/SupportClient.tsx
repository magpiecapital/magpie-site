"use client";

/**
 * Public support page. The single URL on the site for opening a
 * support ticket — discoverable from the top nav so non-TG users
 * (and any user landing fresh) don't have to dig into the dashboard
 * to find help.
 *
 * Two states:
 *   - Wallet connected → in-place composer that posts a signed ticket
 *     to /api/v1/support/ask. Pip answers inline; the team takes over
 *     if Pip escalates.
 *   - Wallet NOT connected → "Connect your wallet" CTA plus fallback
 *     contact options (X DM, TG bot) for users who can't connect right
 *     now or just want to read first.
 *
 * Existing tickets live on the dashboard (Support panel there). This
 * page is the FRONT DOOR for opening a new one.
 */
import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteSupportAsk } from "@/lib/solana/site-support";

const BOT_API_URL =
  process.env.NEXT_PUBLIC_BOT_API_URL ||
  "https://magpie-bot-production.up.railway.app";

const MAX_LEN = 3500;

interface AiResponse {
  ticketId: number;
  text: string;
}

export default function SupportClient() {
  const { publicKey, signMessage, connected } = useWallet();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!publicKey || !signMessage) {
      setError("Wallet not ready — please connect a wallet that supports signMessage.");
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < 4) {
      setError("Add a few more details so we can actually help.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await siteSupportAsk({
        botApiUrl: BOT_API_URL,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        action: "open",
        message: trimmed,
      });
      if (result.aiResponse) {
        setAiResponse({ ticketId: result.ticketId, text: result.aiResponse });
        setMessage("");
      } else {
        setAiResponse({
          ticketId: result.ticketId,
          text:
            result.aiError ||
            `Ticket #${result.ticketId} opened. The team will follow up shortly.`,
        });
        setMessage("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Support</h1>
          <p className="mt-3 text-base text-[var(--ink-soft)] leading-relaxed">
            Got a question or hit something weird? Open a ticket below and
            Pip — our AI agent — will answer first. If Pip can&apos;t resolve
            it, the team takes over and you&apos;ll get a reply on the
            dashboard or wherever you opened the ticket.
          </p>
        </div>

        {/* Composer: connected state */}
        {connected && publicKey ? (
          <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
              Open a ticket
            </div>
            <div className="mb-2 text-xs text-[var(--ink-soft)]">
              Signing as <span className="font-mono">{publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}</span>.
              You&apos;ll sign a short message so we can verify it&apos;s you — no on-chain transaction, no gas.
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
              placeholder="What do you need help with? The more detail the better — token, loan ID, what you tried, what happened."
              rows={6}
              maxLength={MAX_LEN}
              className="w-full rounded-md border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent-deep)]"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ink-faint)]">
              <span>{message.length} / {MAX_LEN}</span>
              <span>We respond fastest when you include specifics.</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < 4}
              className="mt-3 w-full rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent-deep)",
                color: "var(--accent-ink, #1a1500)",
              }}
            >
              {submitting ? "Signing & sending…" : "Sign & open ticket"}
            </button>
            {error && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            {aiResponse && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-3">
                <div className="mb-1 text-xs font-semibold text-emerald-700">
                  ✓ Sent · ticket #{aiResponse.ticketId}
                </div>
                <div className="whitespace-pre-wrap text-sm text-[var(--ink)] leading-relaxed">
                  {aiResponse.text}
                </div>
                <div className="mt-3 text-xs text-[var(--ink-soft)]">
                  Follow-ups and the full conversation are on your{" "}
                  <Link href="/dashboard" className="underline text-[var(--accent-deep)]">
                    dashboard
                  </Link>{" "}
                  under <em>Support</em>.
                </div>
              </div>
            )}
          </section>
        ) : (
          /* Connect-wallet state */
          <section className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-2">
              Connect to open a ticket
            </div>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
              Connect any Solana wallet to file a ticket — no Telegram or
              email required. We use a quick message signature (not a
              transaction, no gas) to verify it&apos;s you so the team can
              reply privately. The ticket and any responses show up on your
              dashboard.
            </p>
            <div className="mt-4">
              <WalletMultiButton />
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="mb-8 rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            How it works
          </div>
          <ol className="space-y-3 text-sm text-[var(--ink-soft)]">
            <li>
              <span className="font-semibold text-[var(--ink)]">1. You write the ticket.</span>{" "}
              Sign a short message to verify your wallet. No on-chain transaction.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">2. Pip answers immediately.</span>{" "}
              Pip is the protocol&apos;s AI agent. It can read your loan
              history, holder balance, credit score, and recent activity to
              answer right away.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">3. The team takes over if needed.</span>{" "}
              If Pip can&apos;t resolve it, the ticket auto-escalates to the
              team and you&apos;ll get a reply on your dashboard. Critical
              categories (security, refunds, bug reports) skip Pip and go
              straight to the team.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">4. Reply on your dashboard.</span>{" "}
              The full conversation lives under <em>Support</em> on{" "}
              <Link href="/dashboard" className="underline text-[var(--accent-deep)]">
                /dashboard
              </Link>{" "}
              — same composer, with all replies.
            </li>
          </ol>
        </section>

        {/* Alt contact */}
        <section className="rounded-2xl border border-[var(--hairline)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-3">
            Can&apos;t open a ticket? Other ways to reach us
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://x.com/MagpieLoans"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-deep)] underline"
              >
                DM @MagpieLoans on X ↗
              </a>{" "}
              <span className="text-[var(--ink-soft)]">— general questions, public requests</span>
            </li>
            <li>
              <a
                href="https://t.me/magpie_capital_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-deep)] underline"
              >
                Use @magpie_capital_bot on Telegram ↗
              </a>{" "}
              <span className="text-[var(--ink-soft)]">— Pip + tickets are also available in the bot</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-[var(--ink-faint)]">
            For anything time-sensitive — funds, loan health, suspected
            exploit — opening a ticket above gets the fastest response since
            we can see your account state directly.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
