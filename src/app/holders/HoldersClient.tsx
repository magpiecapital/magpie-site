"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const PUMP_URL = "https://pump.fun/coin/9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump";
const REWARD_PCT = 10;
const LP_PCT = 80;
const REFERRER_PCT = 5;
const PROTOCOL_PCT = 5;

interface HolderData {
  magpie_balance_raw: string;
  magpie_balance: number;
  has_balance: boolean;
  reward_bps: number;
  reward_pct: number;
  lifetime_lamports: string;
  paid_lamports: string;
  pending_lamports: string;
  distributions_count: number;
  estimated_next_payout_lamports: string;
  seconds_until_next_distribution: number | null;
  auto_distribute: boolean;
}

function fmtCountdown(seconds: number | null) {
  if (seconds == null) return "first distribution pending";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `~${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `~${h}h ${m}m`;
}

interface PoolData {
  pool_lamports: string;
  pool_sol: number;
  last_distribution_at: string | null;
  distribution_interval_days: number;
}

function fmtSol(lamports: string | number) {
  const n = typeof lamports === "string" ? Number(lamports) : lamports;
  return (n / 1e9).toFixed(6);
}

function fmtMagpie(raw: string | number) {
  const n = (typeof raw === "string" ? Number(raw) : raw) / 1e6;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export default function HoldersClient() {
  const { connected, publicKey } = useWallet();
  const [data, setData] = useState<HolderData | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch pool size (public, always shown)
  useEffect(() => {
    fetch("/api/v1/holders/pool")
      .then((r) => r.json())
      .then((j) => setPool(j?.data ?? null))
      .catch(() => {});
  }, []);

  // Fetch user holder data when wallet connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/holders?wallet=${publicKey.toBase58()}`)
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

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-6 md:pt-24 md:pb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            <span>💎</span>
            <span>$MAGPIE · holders</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Hold $MAGPIE. <span className="text-[var(--accent)]">Earn</span> from every loan.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
            <span className="font-semibold text-[var(--ink)]">10% of every loan fee</span>{" "}
            on Magpie accrues to a holder reward pool, distributed weekly to every $MAGPIE
            holder pro-rata. Real yield, on-chain payout, no staking, no lockup.
          </p>

          {pool && (
            <div className="mt-8 inline-block rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                Pool accruing now
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold text-[var(--accent)]">
                {fmtSol(pool.pool_lamports)} SOL
              </div>
              <div className="mt-1 text-xs text-[var(--ink-faint)]">
                Distributed every {pool.distribution_interval_days} days
                {pool.last_distribution_at
                  ? ` · last: ${new Date(pool.last_distribution_at).toLocaleDateString()}`
                  : " · first distribution pending"}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent shimmer text-sm sm:text-base">
              Buy $MAGPIE →
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm sm:text-base">
              Open the bot
            </a>
          </div>
        </div>
      </section>

      {/* CONNECTED WALLET PANEL */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
          {!connected && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center sm:p-8">
              <p className="text-sm text-[var(--ink-soft)]">
                Connect your wallet to see your $MAGPIE balance and pending rewards.
              </p>
            </div>
          )}

          {connected && loading && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--ink-soft)]">
              Loading your holder stats…
            </div>
          )}

          {connected && !loading && data && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your $MAGPIE balance
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-[var(--ink)]">
                  {fmtMagpie(data.magpie_balance_raw)}
                </div>
                {!data.has_balance && (
                  <p className="mt-3 text-sm text-[var(--ink-soft)]">
                    You don't hold $MAGPIE yet. Grab some to start earning a share of every
                    loan fee.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-sm">
                    Buy on pump.fun
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your rewards
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Lifetime received" value={`${fmtSol(data.paid_lamports)} SOL`} />
                  <Stat label="Distributions" value={data.distributions_count.toString()} />
                  <Stat label="Reward rate" value={`${data.reward_pct}%`} />
                  <Stat
                    label="Next in"
                    value={fmtCountdown(data.seconds_until_next_distribution)}
                  />
                </div>
                <div className="mt-5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    Estimated next payout
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                    ~{fmtSol(data.estimated_next_payout_lamports)} SOL
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">
                    Sent automatically to this wallet on the next distribution. Estimate
                    moves with the live pool size — no action needed on your end.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MECHANICS */}
      <section id="how" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            How it works
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n={1} title="Loans pay fees">
              Every borrow + extend on Magpie charges a fee. 80% flows to LPs, 5% to
              referrers, 10% to $MAGPIE holders, 5% to the protocol.
            </Step>
            <Step n={2} title="Weekly snapshot">
              Once a week, the protocol snapshots every wallet holding $MAGPIE on-chain
              (excluding DEX pools, burn addresses, and protocol wallets).
            </Step>
            <Step n={3} title="Pro-rata payout">
              The accrued pool is distributed proportionally to each holder's balance.
              Your share is marked claimable — withdraw it as SOL whenever you want.
            </Step>
          </div>
        </div>
      </section>

      {/* FEE SPLIT */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Fee split
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                LPs untouched. Real revenue for holders.
              </h2>
              <p className="mt-4 max-w-xl text-base text-[var(--ink-soft)]">
                The holder reward comes from the protocol's own share of fees — not from
                LP yield. Depositors keep their full 80%, and $MAGPIE holders get a 10%
                slice of the protocol's revenue, sourced sustainably from real loan
                activity.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
              <Row label="LPs (depositors)" pct={LP_PCT} highlight={false} />
              <Row label="$MAGPIE holders" pct={REWARD_PCT} highlight />
              <Row label="Referrers" pct={REFERRER_PCT} highlight={false} />
              <Row label="Protocol" pct={PROTOCOL_PCT} highlight={false} />
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
            <Faq q="Do I have to stake to earn?">
              No. Just hold $MAGPIE in any wallet you control. The protocol snapshots
              on-chain balances directly — no staking contract, no lockup.
            </Faq>
            <Faq q="How do I receive my SOL?">
              Automatically. Every 7 days the bot snapshots all $MAGPIE holders and sends
              each their pro-rata share via on-chain transfer. SOL just appears in the
              wallet that holds $MAGPIE — no claim button, no signing, no bot account
              needed.
            </Faq>
            <Faq q="When do distributions happen?">
              Every 7 days. The pool accrues continuously and is paid out at the end of
              each interval. The next-distribution countdown is shown above when your
              wallet is connected.
            </Faq>
            <Faq q="Which wallets are eligible?">
              Every on-chain $MAGPIE holder is eligible except: DEX pool accounts
              (Raydium, Orca, Meteora), the pump.fun bonding curve, known burn addresses,
              and the protocol's own wallet.
            </Faq>
            <Faq q="What if a transfer fails?">
              Failed transfers are automatically retried on the next cycle. Your reward
              stays earmarked until it lands in your wallet — nothing is lost to RPC
              flakiness.
            </Faq>
            <Faq q="Does this dilute LP yield?">
              No. LPs still earn their full 80% of every fee. The 10% holder reward comes
              from the protocol's existing share, not from LP yield.
            </Faq>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Buy $MAGPIE →
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-base">
              Check your rewards in the bot
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
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value}</div>
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
