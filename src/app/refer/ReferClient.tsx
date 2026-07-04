"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { GiftIcon } from "@/components/icons";
import { Header } from "@/components/Header";
import { siteSetReferralCode } from "@/lib/solana/site-referral";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const BOT_API_URL =
  process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
// Post-MGP-001 split, ratified 2026-06-13: 70/10/10/10.
// Referrer share is now 10% (up from pre-MGP-001 5%). When the borrower
// has no referrer, the slice rolls back into the holder pool.
const REWARD_PCT = 10;
const HOLDER_PCT = 70;
const LP_PCT = 10;
const PROTOCOL_PCT = 10;

interface ReferralData {
  linked: boolean;
  code: string | null;
  /** Backward-compat: TG-targeted share link (bot start command). */
  share_link: string | null;
  /** magpie.capital?ref=CODE — captured by RefCapture, attributed at auto-bootstrap. */
  site_share_link?: string | null;
  /** Explicit alias of share_link for the TG link. */
  tg_share_link?: string | null;
  referred_count: number;
  borrowed_count: number;
  lifetime_lamports: string;
  paid_lamports: string;
  claimable_lamports: string;
  min_claim_lamports: string;
  message?: string;
}

function fmtSol(lamports: string | number) {
  const n = typeof lamports === "string" ? Number(lamports) : lamports;
  return (n / 1e9).toFixed(6);
}

export default function ReferClient() {
  const { connected, publicKey, signMessage } = useWallet();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [settingCode, setSettingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSetCode() {
    if (!publicKey || !signMessage) {
      setCodeMsg({ ok: false, text: "Connect a wallet that supports message signing (e.g. Phantom)." });
      return;
    }
    const code = customInput.trim();
    if (code.length < 3) return;
    setSettingCode(true);
    setCodeMsg(null);
    try {
      const res = await siteSetReferralCode({
        botApiUrl: BOT_API_URL,
        signerPubkey: publicKey.toBase58(),
        signMessage,
        code,
      });
      setCodeMsg({ ok: true, text: `Done — your code is now “${res.code}”.` });
      setCustomInput("");
      // Refresh the displayed code + share links.
      const j = await fetch(`/api/v1/referrals?wallet=${publicKey.toBase58()}`)
        .then((r) => r.json())
        .catch(() => null);
      if (j?.data) setData(j.data);
    } catch (e) {
      setCodeMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSettingCode(false);
    }
  }

  useEffect(() => {
    if (!connected || !publicKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/referrals?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j?.data ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey]);

  const showStats = connected && data?.linked;
  const aboveMin = useMemo(() => {
    if (!data) return false;
    return BigInt(data.claimable_lamports || "0") >= BigInt(data.min_claim_lamports || "0");
  }, [data]);

  async function copyLink() {
    // Prefer the site share link (works for any audience) and fall
    // back to the TG share link if the bot doesn't return one yet.
    const link = data?.site_share_link || data?.share_link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard refused — user can long-press to copy manually */
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-6 md:pt-24 md:pb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            <GiftIcon className="h-3 w-3" />
            <span>New · referrals</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Earn <span className="text-[var(--accent)]">5%</span> of every
            <br className="hidden sm:inline" /> loan fee from anyone you refer.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
            Share your link. Friend borrows. You earn 5% of their fee, forever — paid in
            SOL, sourced from real protocol revenue. No vesting, no points, no airdrop
            theater.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent shimmer text-sm sm:text-base">
              Get your link in Telegram →
            </a>
            <a href="#how" className="btn-ghost text-sm sm:text-base">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* CONNECTED-WALLET STATS PANEL */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
          {!connected && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center sm:p-8">
              <p className="text-sm text-[var(--ink-soft)]">
                Connect your wallet to see your referral stats and share link.
              </p>
            </div>
          )}

          {connected && loading && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--ink-soft)]">
              Loading your referral stats…
            </div>
          )}

          {connected && !loading && data && !showStats && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
              <h2 className="mb-2 text-xl font-semibold">This wallet isn’t linked yet</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                {data.message ??
                  "Open the Telegram bot first — it’ll generate your referral code automatically."}
              </p>
              <div className="mt-4">
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-sm">
                  Open @magpie_capital_bot →
                </a>
              </div>
            </div>
          )}

          {showStats && data && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your share link
                </div>
                <div className="mt-3 break-all rounded-lg bg-[var(--surface)] p-3 font-mono text-sm">
                  {data.site_share_link || data.share_link}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={copyLink} className="btn-accent text-sm">
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Try @MagpieLoans — permissionless lending on Solana. Borrow SOL against your tokens in seconds: " + (data.site_share_link || data.share_link || ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-sm"
                  >
                    Share on X
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(data.tg_share_link || data.share_link || "")}&text=${encodeURIComponent("Try Magpie — borrow SOL against memecoins, instant approval: " + (data.tg_share_link || data.share_link || ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-sm"
                  >
                    Share to Telegram
                  </a>
                </div>
                {data.tg_share_link && data.site_share_link && (
                  <div className="mt-3 text-[11px] text-[var(--ink-faint)] leading-relaxed">
                    Prefer the TG-targeted variant? <span className="font-mono break-all text-[var(--ink-soft)]">{data.tg_share_link}</span>
                  </div>
                )}
                <div className="mt-4 text-xs text-[var(--ink-faint)]">
                  Code: <span className="font-mono text-[var(--ink-soft)]">{data.code}</span>
                </div>
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs text-[var(--ink-faint)]">
                    ✏️ Set a custom code (use a nickname instead)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => { setCustomInput(e.target.value); setCodeMsg(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSetCode(); }}
                      placeholder="yourname"
                      maxLength={20}
                      spellCheck={false}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSetCode}
                      disabled={settingCode || customInput.trim().length < 3}
                      className="btn-accent whitespace-nowrap px-4 text-sm disabled:opacity-50"
                    >
                      {settingCode ? "Signing…" : "Set"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
                    3–20 chars · letters, numbers, <span className="font-mono">_</span> or <span className="font-mono">-</span> · you&apos;ll sign a free message (no SOL, no transaction). Changeable once a week. Prefer Telegram? Run <span className="font-mono text-[var(--ink-soft)]">/refer set yourname</span>.
                  </p>
                  {codeMsg && (
                    <p className={`mt-1 text-xs ${codeMsg.ok ? "text-[var(--accent-deep)]" : "text-[var(--bad)]"}`}>
                      {codeMsg.text}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your earnings
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <Stat label="Invited" value={data.referred_count.toString()} />
                  <Stat label="Borrowed" value={data.borrowed_count.toString()} />
                  <Stat label="Lifetime" value={`${fmtSol(data.lifetime_lamports)} SOL`} />
                  <Stat label="Paid out" value={`${fmtSol(data.paid_lamports)} SOL`} />
                </div>
                <div className="mt-5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    Claimable now
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                    {fmtSol(data.claimable_lamports)} SOL
                  </div>
                  {!aboveMin && Number(data.claimable_lamports) > 0 && (
                    <div className="mt-1 text-xs text-[var(--ink-soft)]">
                      Minimum claim: {fmtSol(data.min_claim_lamports)} SOL — keep referring.
                    </div>
                  )}
                  <a
                    href={`${TELEGRAM_URL}?start=refer`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    Claim in Telegram →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            How it works
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n={1} title="Grab your link">
              Open <span className="font-mono">@magpie_capital_bot</span> and type{" "}
              <span className="font-mono">/refer</span>. You get a unique share link, ready to
              post.
            </Step>
            <Step n={2} title="Friend takes a loan">
              They tap your link, the bot attributes them to you automatically. Every borrow
              or extend they do generates a fee.
            </Step>
            <Step n={3} title="Earn 5% of every fee">
              Your share accrues automatically in SOL. Tap{" "}
              <span className="font-mono">/refer</span> any time to see your balance — claim
              when you’re ready.
            </Step>
          </div>
        </div>
      </section>

      {/* ECONOMICS */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Where the money comes from
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Real on-chain SOL. Sourced from real loan activity.
              </h2>
              <p className="mt-4 max-w-xl text-base text-[var(--ink-soft)]">
                Per MGP-001 (ratified 2026-06-13), every loan fee splits 70% to $MAGPIE holders, 10% to LP loyalty, 10% to referrers, and 10% to the protocol reserve. Your 10% referrer slice comes out of that split, not out of LP yield. If a borrower you referred has no referrer marked at the time the loan opens, the slice rolls back into the holder pool — so $MAGPIE holders also benefit when referrals aren&apos;t set.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
              <Row label="$MAGPIE holders" pct={HOLDER_PCT} highlight={false} />
              <Row label="LP loyalty" pct={LP_PCT} highlight={false} />
              <Row label="You (referrer)" pct={REWARD_PCT} highlight />
              <Row label="Protocol reserve" pct={PROTOCOL_PCT} highlight={false} />
              <div className="mt-5 border-t border-[var(--hairline)] pt-4 text-xs text-[var(--ink-faint)]">
                Example · friend borrows 1 SOL at 30% LTV (3% fee, 0.03 SOL):
                <ul className="mt-2 space-y-1 font-mono text-[var(--ink-soft)]">
                  <li>· LPs earn 0.024 SOL</li>
                  <li>· You earn 0.0015 SOL</li>
                  <li>· Protocol nets 0.0045 SOL</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            FAQ
          </div>
          <div className="space-y-6">
            <Faq q="Is this a points program?">
              No. You earn actual SOL, paid on-chain when you claim. Nothing to vest, nothing
              to convert.
            </Faq>
            <Faq q="How long do I earn for?">
              Lifetime. Every loan or extend your referred users take pays you 5% of the
              fee — for as long as they keep using Magpie.
            </Faq>
            <Faq q="What's the minimum claim?">
              0.005 SOL. Lets us batch tiny payouts so tx fees don’t eat your earnings.
            </Faq>
            <Faq q="Can I refer myself?">
              No — the bot blocks attribution if the referrer and referee are the same user.
              Same goes for dust farming: tiny loans don’t accrue referral fees.
            </Faq>
            <Faq q="Where do I see my stats?">
              Either on this page (when your wallet is connected) or in the bot — type{" "}
              <span className="font-mono">/refer</span>.
            </Faq>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Get your link →
            </a>
            <a href="/docs" className="btn-ghost text-base">
              Read the docs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/15 font-mono text-sm text-[var(--accent)]">
        {n}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}

function Row({ label, pct, highlight }: { label: string; pct: number; highlight: boolean }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className={highlight ? "font-semibold text-[var(--accent)]" : "text-[var(--ink-soft)]"}>
          {label}
        </span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--surface)]">
        <div
          className={highlight ? "h-2 rounded-full bg-[var(--accent)]" : "h-2 rounded-full bg-[var(--ink-faint)]"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="font-medium text-[var(--ink)]">{q}</div>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}
