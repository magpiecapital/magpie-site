import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Submit a Token | Magpie",
  description:
    "Submit any Solana token for collateral approval on Magpie. Three outcomes: Instant Approval, Submission Needs Review, or Declined — full criteria explained.",
  openGraph: {
    title: "Submit a token to Magpie",
    description:
      "Get any Solana token approved as borrow collateral. Auto-evaluated against a 6-layer safety audit + market thresholds. Three outcomes explained.",
  },
};

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-6 md:pt-24 md:pb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--ink-soft)]">
            <span>➕</span>
            <span>Submit a token</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Submit any Solana token for{" "}
            <span className="italic text-[var(--accent-deep)]">collateral approval.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
            Open the bot, type{" "}
            <span className="font-mono">/submit &lt;mint or symbol&gt;</span>, and within
            seconds the screener runs a 6-layer audit + market evaluation. Three possible
            outcomes — explained below.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent shimmer text-sm sm:text-base"
            >
              Submit in Telegram →
            </a>
            <Link href="/tokens" className="btn-ghost text-sm sm:text-base">
              See approved tokens
            </Link>
          </div>
        </div>
      </section>

      {/* THE THREE OUTCOMES */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Three possible outcomes
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* INSTANT APPROVAL */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-2 text-emerald-500">
                <span className="text-2xl">✅</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Instant Approval
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
                Live as collateral, immediately.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                Token cleared every safety audit AND hit the auto-approve bar. Inserted
                into <span className="font-mono">supported_mints</span> with{" "}
                <span className="font-mono">enabled=TRUE</span> within seconds — anyone
                on Magpie can borrow against it the moment your submission completes.
              </p>
              <div className="mt-5 rounded-xl bg-[var(--bg)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Auto-approve bar
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[var(--ink-soft)]">
                  <li>≥ $75K liquidity</li>
                  <li>≥ $50K 24h volume</li>
                  <li>≥ $100K market cap</li>
                  <li>≥ 300 holders</li>
                  <li>≥ 24 hours old</li>
                  <li>Top-10 holders own ≤ 40%</li>
                  <li>LP burned ✓</li>
                  <li>No mint authority ✓</li>
                  <li>No freeze authority ✓</li>
                </ul>
              </div>
            </div>

            {/* NEEDS REVIEW */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
              <div className="flex items-center gap-2 text-amber-500">
                <span className="text-2xl">🟡</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Submission Needs Review
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
                Safe — but team takes a look.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                Token passed every security audit, so it's safe — but it doesn't yet hit
                the auto-approve bar. Queued for human review. Typically evaluated within
                an hour. If approved, it goes live with the same protections as
                auto-approved tokens.
              </p>
              <div className="mt-5 rounded-xl bg-[var(--bg)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Common reasons safe tokens land here
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[var(--ink-soft)]">
                  <li>Liquidity between $5K and $75K</li>
                  <li>Fewer than 300 holders</li>
                  <li>Less than 24 hours old</li>
                  <li>24h volume below $50K</li>
                  <li>Recently graduated from a launchpad</li>
                </ul>
              </div>
            </div>

            {/* DECLINED */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
              <div className="flex items-center gap-2 text-rose-500">
                <span className="text-2xl">❌</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Declined
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
                Failed a safety check.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                Token failed one of our hard safety gates. We don't list tokens that fail
                these because borrowers could end up with collateral that's manipulable
                or unsellable. Fix the underlying issue and resubmit — the screener
                re-evaluates from scratch every time.
              </p>
              <div className="mt-5 rounded-xl bg-[var(--bg)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Most common decline reasons
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[var(--ink-soft)]">
                  <li>Failed sellability test (honeypot)</li>
                  <li>Active mint or freeze authority</li>
                  <li>Top-10 holders own &gt; 40% of supply</li>
                  <li>LP not burned</li>
                  <li>Flagged by RugCheck risk feed</li>
                  <li>Symbol impersonation of an existing approved token</li>
                  <li>Below minimum thresholds ($5K liq, $1K mcap, 4h age, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE 6-LAYER AUDIT */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            The 6-layer safety audit
          </div>
          <h2 className="max-w-3xl font-display text-3xl font-medium tracking-[-0.03em] sm:text-5xl">
            Every submission runs against the same gates.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[var(--ink-soft)]">
            All six checks run in parallel within seconds of your <span className="font-mono">/submit</span>.
            If any single one fails, the token is declined — no exceptions.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <AuditStep
              n={1}
              title="Sellability test"
              detail="We simulate a small swap on-chain. If the swap fails or transfer hooks block it, the token is a honeypot — instantly declined."
            />
            <AuditStep
              n={2}
              title="Token-2022 extension audit"
              detail="For Token-2022 mints, we check every extension (transfer fee, transfer hook, permanent delegate, etc.) to make sure none can be weaponized against borrowers."
            />
            <AuditStep
              n={3}
              title="Holder concentration"
              detail="Top-10 holders must own ≤ 40% of supply. Heavy concentration means a single wallet can crash the market by selling — too risky as collateral."
            />
            <AuditStep
              n={4}
              title="RugCheck risk score"
              detail="Third-party aggregated risk feed. Tokens flagged as high-risk by RugCheck are declined automatically."
            />
            <AuditStep
              n={5}
              title="Symbol impersonation guard"
              detail="If your token has the same symbol or name as an already-approved token but a different mint, it's blocked. Stops scam variants like fake 'BONK' or 'WIF'."
            />
            <AuditStep
              n={6}
              title="Cooldown + minimums"
              detail="Token must be at least 4 hours old with $5K+ liquidity and $500+ 24h volume to even be considered. Stops brand-new launches with no track record."
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            FAQ
          </div>
          <div className="space-y-6">
            <Faq q="Is there a fee to submit?">
              No. Submission is free. There's a 60-second cooldown between submissions
              per user to prevent spam.
            </Faq>
            <Faq q="My token was declined. Can I resubmit?">
              Yes. The screener re-evaluates every submission from scratch — so if you
              fix the underlying issue (burn LP, renounce authority, etc.), resubmit and
              it'll be re-checked with fresh data. After 3 declines in 24h though,
              you'll hit a temporary cooldown.
            </Faq>
            <Faq q="How long does 'Needs Review' usually take?">
              Typically under an hour. The team reviews queued submissions on a regular
              cadence. You'll get a Telegram DM when it's evaluated.
            </Faq>
            <Faq q="Can my token get removed after approval?">
              Yes — the token-health watcher sweeps every 4 hours. If a token drops below
              $10K liquidity or $500 daily volume, it gets a strike. Two strikes → auto-
              disabled (existing loans against it play out normally, but no new ones).
            </Faq>
            <Faq q="What if I'm submitting my own project's token?">
              Same process. We don't give projects shortcuts — every submission goes
              through the same audit + thresholds. Make sure your LP is burned and
              authority is renounced before submitting.
            </Faq>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Submit your token →
            </a>
            <Link href="/tokens" className="btn-ghost text-base">
              Browse approved tokens
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function AuditStep({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/15 font-mono text-sm text-[var(--accent-deep)]">
        {n}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{detail}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="font-medium text-[var(--ink)]">{q}</div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}
