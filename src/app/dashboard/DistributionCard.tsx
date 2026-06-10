"use client";

/**
 * Holder Distributions card — shows the full history of distributions
 * the connected wallet has received, oldest at bottom and newest at top.
 *
 * For each distribution row: proposal id, SOL amount, sent date, and a
 * clickable Solscan link to the actual on-chain transaction.
 *
 * Hides entirely when:
 *   - Wallet not connected
 *   - The wallet has no distributions in DB
 *   - API unreachable
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
  plan_hash?: string;
  snapshot_hash?: string;
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
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
        const r = await fetch(
          `${botApiUrl}/api/v1/governance/distributions?wallet=${publicKey.toBase58()}`,
        );
        if (!r.ok) { if (!cancelled) setLoading(false); return; }
        const j = (await r.json()) as DistributionsResp;
        if (!cancelled) { setData(j); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  if (!publicKey || loading) return null;
  if (!data || data.distribution_count === 0) return null;

  const sentRows = data.distributions.filter((d) => d.status === "sent");
  const pendingRows = data.distributions.filter((d) => d.status === "pending");
  const unpayableRows = data.distributions.filter((d) => d.status === "unpayable_rent_exempt");

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--d-ink)" }}>
          Holder Distributions
        </h3>
        <div style={{ fontSize: 12, color: "var(--d-ink-soft)" }}>
          {fmtSol(data.total_received_sol)} SOL received total
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--d-border)" }}>
        {sentRows.map((d) => (
          <div
            key={d.proposal_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid var(--d-border)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--d-ink)" }}>
                {d.proposal_id} Distribution
              </div>
              <div style={{ fontSize: 11, color: "var(--d-ink-faint)", marginTop: 2 }}>
                Sent {fmtDate(d.sent_at)}
              </div>
            </div>
            <div style={{ textAlign: "right", marginRight: 12 }}>
              <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink)" }}>
                {fmtSol(d.allocated_sol)} SOL
              </div>
            </div>
            {d.tx_signature && (
              <a
                href={`https://solscan.io/tx/${d.tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "var(--d-accent-deep)",
                  textDecoration: "underline",
                  whiteSpace: "nowrap",
                }}
              >
                view tx
              </a>
            )}
          </div>
        ))}

        {pendingRows.map((d) => (
          <div
            key={d.proposal_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid var(--d-border)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--d-ink)" }}>
                {d.proposal_id} Distribution
              </div>
              <div style={{ fontSize: 11, color: "var(--d-ink-faint)", marginTop: 2 }}>
                Pending — will be sent when the round executes
              </div>
            </div>
            <div style={{ textAlign: "right", marginRight: 12 }}>
              <div style={{ fontSize: 14, fontFamily: "monospace", color: "var(--d-ink)" }}>
                {fmtSol(d.allocated_sol)} SOL
              </div>
            </div>
            <div style={{ width: 60 }} />
          </div>
        ))}

        {unpayableRows.length > 0 && (
          <div style={{ padding: "12px 0", fontSize: 11, color: "var(--d-ink-faint)" }}>
            {unpayableRows.length} distribution(s) below Solana's rent-exempt minimum — unpayable to wallets not yet initialized on-chain.
          </div>
        )}
      </div>
    </section>
  );
}
