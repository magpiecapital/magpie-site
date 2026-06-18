"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BOT_API =
  process.env.NEXT_PUBLIC_BOT_API_URL ||
  "https://magpie-bot-production.up.railway.app";

const KIND_LABELS: Record<string, string> = {
  holder_reward: "$MAGPIE Holders",
  governance: "Governance",
  lp_loyalty: "LP Loyalty",
  yield: "LP Yield",
  loan_remediation: "Remediation",
};
const KIND_BLURBS: Record<string, string> = {
  holder_reward:
    "Pro-rata payout to $MAGPIE holders. 70% of every loan fee accrues here (per MGP-001).",
  governance: "Ratification payout following a passed governance proposal.",
  lp_loyalty:
    "LP loyalty distribution to liquidity providers, weighted by share-seconds held.",
  yield: "LP yield distribution.",
  loan_remediation: "Refunds or remediation payments to affected wallets.",
};

type Event = {
  id: number;
  kind: string;
  external_ref: string;
  snapshot_at: string;
  paid_first_at: string | null;
  paid_last_at: string | null;
  distributed_lamports: string;
  unpaid_lamports: string;
  eligible_wallet_count: number;
  paid_wallet_count: number;
  unpayable_wallet_count: number;
  denominator_kind: string | null;
  denominator_value: string | null;
  min_payout_lamports: string | null;
  max_payout_lamports: string | null;
  median_payout_lamports: string | null;
  source_borrow_fees_lamports: string;
  source_liquidation_lamports: string;
  source_other_lamports: string;
  sample_tx_signatures: string[] | null;
  notes: string | null;
  status: string;
};

type Totals = {
  event_count: number;
  lifetime_distributed_lamports: string;
  lifetime_payout_count: number;
  first_event_at: string | null;
  most_recent_event_at: string | null;
  holder_reward_count: number;
  governance_count: number;
  lp_loyalty_count: number;
};

function fmtSol(lamports: string | null): string {
  if (!lamports) return "—";
  const n = Number(lamports) / 1e9;
  return n < 1
    ? n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    : n.toFixed(4);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // Eastern per protocol-timezone rule
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function DistributionsClient() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BOT_API}/api/v1/public/distributions?limit=100`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!j.ok) throw new Error("api returned ok=false");
        setEvents(j.events);
        setTotals(j.totals);
      })
      .catch((e) => setErr(e.message || String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Distributions
        </h1>
        <p className="mt-3 text-[var(--ink-soft)]">
          Every SOL distribution Magpie has made — holder rewards, governance
          ratifications, LP loyalty. Real numbers, on-chain tx sigs, lifetime
          totals.
        </p>
      </header>

      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          Failed to load: {err}
        </div>
      )}

      {totals && (
        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Total events"
            value={totals.event_count.toLocaleString()}
          />
          <Stat
            label="Lifetime SOL distributed"
            value={`${fmtSol(totals.lifetime_distributed_lamports)} SOL`}
          />
          <Stat
            label="Total payouts"
            value={totals.lifetime_payout_count.toLocaleString()}
          />
          <Stat
            label="Most recent"
            value={fmtDate(totals.most_recent_event_at)}
          />
        </section>
      )}

      {events && events.length === 0 && !err && (
        <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--ink-soft)]">
          No distributions recorded yet.
        </div>
      )}

      {events && events.length > 0 && (
        <section className="space-y-3">
          {events.map((ev) => (
            <article
              key={ev.id}
              className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                    {KIND_LABELS[ev.kind] ?? ev.kind}
                  </span>
                  <h2 className="font-medium">{ev.external_ref}</h2>
                  <span className="text-xs text-[var(--ink-faint)]">
                    {fmtDate(ev.paid_last_at ?? ev.snapshot_at)}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {fmtSol(ev.distributed_lamports)} SOL
                  </div>
                  <div className="text-xs text-[var(--ink-faint)]">
                    distributed
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <KV
                  label="Wallets paid"
                  value={`${ev.paid_wallet_count.toLocaleString()} / ${ev.eligible_wallet_count.toLocaleString()}`}
                />
                {ev.unpayable_wallet_count > 0 && (
                  <KV
                    label="Skipped (rent-exempt)"
                    value={ev.unpayable_wallet_count.toLocaleString()}
                  />
                )}
                <KV
                  label="Median payout"
                  value={`${fmtSol(ev.median_payout_lamports)} SOL`}
                />
                <KV
                  label="Status"
                  value={ev.status}
                />
              </div>

              {KIND_BLURBS[ev.kind] && (
                <p className="mt-3 text-xs text-[var(--ink-soft)]">
                  {KIND_BLURBS[ev.kind]}
                </p>
              )}

              {ev.sample_tx_signatures && ev.sample_tx_signatures.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="text-[var(--ink-faint)]">Verify on-chain:</span>
                  {ev.sample_tx_signatures.slice(0, 3).map((sig) => (
                    <a
                      key={sig}
                      href={`https://solscan.io/tx/${sig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[var(--accent)] hover:underline"
                    >
                      {sig.slice(0, 8)}…{sig.slice(-6)}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <footer className="mt-12 text-xs text-[var(--ink-faint)]">
        Audit trail powered by the unified <code>distribution_events</code>{" "}
        ledger.{" "}
        <Link href="/stats" className="text-[var(--accent)] hover:underline">
          Protocol stats
        </Link>{" "}
        ·{" "}
        <Link href="/holders" className="text-[var(--accent)] hover:underline">
          $MAGPIE holder rewards
        </Link>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
      <div className="text-xs text-[var(--ink-faint)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
