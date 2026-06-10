"use client";

/**
 * Holder Distributions card — shows the full history of distributions
 * the connected wallet has received, oldest at bottom and newest at top.
 *
 * Each row: proposal id, SOL amount, date sent, running cumulative
 * total at that point, and a Solscan tx link.
 * Header: lifetime total received + count of distributions.
 *
 * Hides entirely when wallet not connected or has no distribution rows.
 */

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";

interface DistributionRow {
  proposal_id: string;
  allocated_lamports: string;
  allocated_sol: number;
  tx_signature: string | null;
  sent_at: string | null;
  status: string;
}

interface DistributionsResp {
  wallet: string;
  distribution_count: number;
  total_received_lamports: string;
  total_received_sol: number;
  distributions: DistributionRow[];
}

function fmtSol(sol: number): string {
  if (sol === 0) return "0";
  return sol.toFixed(6).replace(/\.?0+$/, "");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DistributionCard() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<DistributionsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey || !botApiUrl) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/governance/distributions?wallet=${publicKey.toBase58()}`);
        if (!r.ok) { if (!cancelled) setLoading(false); return; }
        const j = (await r.json()) as DistributionsResp;
        if (!cancelled) { setData(j); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  if (!publicKey || loading) return null;
  if (!data || data.distribution_count === 0) return null;

  // Sort sent rows oldest-first to compute the running cumulative, then
  // render newest-first by reversing the prepared array.
  const sentRowsOldestFirst = [...data.distributions]
    .filter((d) => d.status === "sent")
    .sort((a, b) => {
      const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return ta - tb;
    });
  let runningSum = 0;
  const sentWithCumulative = sentRowsOldestFirst.map((d) => {
    runningSum += d.allocated_sol;
    return { ...d, cumulative_sol: runningSum };
  });
  const sentNewestFirst = [...sentWithCumulative].reverse();

  const pendingRows = data.distributions.filter((d) => d.status === "pending");
  const unpayableCount = data.distributions.filter((d) => d.status === "unpayable_rent_exempt").length;

  return (
    <section
      style={{
        background: "var(--d-bg-card)",
        border: "1px solid var(--d-border)",
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--d-ink)" }}>
          Holder Distributions
        </h3>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: "var(--d-ink)" }}>
            {fmtSol(data.total_received_sol)} SOL
          </div>
          <div style={{ fontSize: 11, color: "var(--d-ink-faint)" }}>
            received across {sentNewestFirst.length} distribution{sentNewestFirst.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto",
          gap: "8px 16px",
          fontSize: 11,
          color: "var(--d-ink-faint)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          paddingBottom: 8,
          borderBottom: "1px solid var(--d-border)",
        }}
      >
        <div>Round</div>
        <div style={{ textAlign: "right" }}>Amount</div>
        <div style={{ textAlign: "right" }}>Lifetime</div>
        <div style={{ textAlign: "right" }}>Proof</div>
      </div>

      {sentNewestFirst.map((d) => (
        <div
          key={d.proposal_id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: "8px 16px",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid var(--d-border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--d-ink)" }}>
              {d.proposal_id}
            </div>
            <div style={{ fontSize: 11, color: "var(--d-ink-faint)", marginTop: 2 }}>
              {fmtDate(d.sent_at)}
            </div>
          </div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink)", textAlign: "right" }}>
            {fmtSol(d.allocated_sol)}
          </div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink-soft)", textAlign: "right" }}>
            {fmtSol(d.cumulative_sol)}
          </div>
          <div style={{ textAlign: "right" }}>
            {d.tx_signature ? (
              <a
                href={`https://solscan.io/tx/${d.tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--d-accent-deep)", textDecoration: "underline" }}
              >
                view tx
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "var(--d-ink-faint)" }}>—</span>
            )}
          </div>
        </div>
      ))}

      {pendingRows.map((d) => (
        <div
          key={d.proposal_id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: "8px 16px",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid var(--d-border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--d-ink)" }}>{d.proposal_id}</div>
            <div style={{ fontSize: 11, color: "var(--d-ink-faint)", marginTop: 2 }}>
              Pending — will be sent when the round executes
            </div>
          </div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink)", textAlign: "right" }}>
            {fmtSol(d.allocated_sol)}
          </div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink-faint)", textAlign: "right" }}>
            —
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "var(--d-ink-faint)" }}>—</span>
          </div>
        </div>
      ))}

      {unpayableCount > 0 && (
        <div style={{ padding: "10px 0 0 0", fontSize: 11, color: "var(--d-ink-faint)" }}>
          {unpayableCount} round(s) below Solana&apos;s rent-exempt minimum — unpayable to wallets not yet initialized on-chain.
        </div>
      )}
    </section>
  );
}
