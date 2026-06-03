"use client";

/**
 * LiveProtocolTicker — small, tasteful live-data strip for the homepage.
 *
 * Pulls /api/v1/transparency and surfaces the three strongest trust
 * signals: 24h activity (proof the protocol is alive), liquidations
 * lifetime (the "0 ever" claim), and total users (social proof).
 *
 * Designed to sit BELOW the existing qualitative stats strip — adds a
 * live element without replacing the timeless claims that hold up.
 */

import { useEffect, useState } from "react";

interface Headline {
  liquidations_lifetime: number;
  users: number;
  loans_lifetime: number;
}

interface TransparencyData {
  headline: Headline;
  loans: { new_24h: number; borrowed_24h_sol: number };
}

export function LiveProtocolTicker() {
  const [data, setData] = useState<TransparencyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/transparency");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent — ticker is non-critical */ }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Don't render anything if data isn't available — keeps the page clean.
  if (!data) return null;

  const liquidations = data.headline.liquidations_lifetime;
  const liquidationDisplay = liquidations === 0 ? "0" : liquidations.toLocaleString();

  return (
    <div className="fade-up mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--ink-soft)]">
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="uppercase tracking-[0.18em] text-[var(--ink-faint)]">Live</span>
      </span>
      <Stat
        label="Liquidations"
        value={liquidationDisplay}
        emphasis={liquidations === 0}
        tooltip="Lifetime — by design, not by luck"
      />
      <span className="text-[var(--ink-faint)]">·</span>
      <Stat label="Loans · 24h" value={data.loans.new_24h.toLocaleString()} />
      <span className="text-[var(--ink-faint)]">·</span>
      <Stat
        label="Borrowed · 24h"
        value={`${formatSol(data.loans.borrowed_24h_sol)} SOL`}
      />
      <span className="text-[var(--ink-faint)]">·</span>
      <Stat label="Users" value={data.headline.users.toLocaleString()} />
      <span className="text-[var(--ink-faint)]">·</span>
      <a
        href="/stats"
        className="underline-offset-2 hover:underline hover:text-[var(--ink)]"
      >
        verify →
      </a>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
  tooltip,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tooltip?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5" title={tooltip}>
      <span className={`font-display tabular text-sm font-medium ${emphasis ? "text-[var(--accent-deep)]" : "text-[var(--ink)]"}`}>
        {value}
      </span>
      <span className="uppercase tracking-[0.15em] text-[10px] text-[var(--ink-faint)]">
        {label}
      </span>
    </span>
  );
}

function formatSol(n: number) {
  if (n < 0.01) return n.toFixed(3);
  if (n < 10) return n.toFixed(2);
  if (n < 1000) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}
