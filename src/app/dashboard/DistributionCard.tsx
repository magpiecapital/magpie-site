"use client";

/**
 * Distribution card — surfaces the connected wallet's expected SOL
 * allocation for an upcoming or in-progress holder distribution.
 *
 * Three states the card renders, depending on the API response:
 *   - in_distribution = false           → no allocation (or floored out for dust)
 *   - status = 'pending'                → "you'll receive X SOL when the round executes"
 *   - status = 'sent'                   → "you received X SOL — view tx"
 *   - status = 'failed'                 → "send failed — operator is retrying"
 *
 * Hides entirely when the wallet isn't connected.
 */

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";

const ACTIVE_DISTRIBUTION_PROPOSAL = "MGP-001";

interface DistributionResp {
  in_distribution: boolean;
  wallet?: string;
  proposal_id?: string;
  allocated_lamports?: string;
  allocated_sol?: number;
  pct_of_distribution?: number;
  status?: string;
  tx_signature?: string;
  sent_at?: string;
  failure_reason?: string;
  reason?: string;
  distribution_total_recipients?: number;
  distribution_total_sol?: number;
}

export default function DistributionCard() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<DistributionResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey || !botApiUrl) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${botApiUrl}/api/v1/governance/distribution?wallet=${publicKey.toBase58()}&proposal_id=${ACTIVE_DISTRIBUTION_PROPOSAL}`,
        );
        if (!r.ok) { if (!cancelled) setLoading(false); return; }
        const j = (await r.json()) as DistributionResp;
        if (!cancelled) { setData(j); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  if (!publicKey || loading) return null;
  if (!data) return null;

  // Hide if wallet wasn't in distribution AND no useful context to show
  if (!data.in_distribution) return null;

  // Link to the CONNECTED WALLET's Solscan address page rather than the
  // batched transaction page. The batched tx contains multiple recipients
  // (up to 10 per tx) and shows them all — surfacing other holders' wallets
  // and amounts on the same page would feel non-private. The address page
  // shows only THIS wallet's incoming history, including the distribution
  // tx as one of its own account activities.
  const sentLink = data.tx_signature && data.wallet
    ? `https://solscan.io/account/${data.wallet}`
    : null;

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
          Holder Distribution — {data.proposal_id}
        </h3>
        <div style={{ fontSize: 12, color: "var(--d-ink-soft)" }}>
          {data.distribution_total_recipients?.toLocaleString()} recipients · {data.distribution_total_sol?.toFixed(4)} SOL pool
        </div>
      </div>

      <div style={{ padding: 12, background: "var(--d-surface)", borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: "var(--d-ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Your allocation
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "var(--d-ink)" }}>
          {data.allocated_sol?.toFixed(6)} SOL
        </div>
        <div style={{ fontSize: 12, color: "var(--d-ink-soft)", marginTop: 4 }}>
          {data.pct_of_distribution?.toFixed(4)}% of pool
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {data.status === "pending" && (
          <span style={{ fontSize: 13, color: "var(--d-ink-soft)" }}>
            Pending — will be sent to your wallet when the round executes
          </span>
        )}
        {data.status === "sent" && sentLink && (
          <>
            <span style={{ fontSize: 13, color: "var(--d-accent-deep)", fontWeight: 600 }}>
              Sent {data.sent_at ? new Date(data.sent_at).toLocaleDateString() : ""}
            </span>
            <a
              href={sentLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: "var(--d-accent-deep)", textDecoration: "underline" }}
            >
              View tx ↗
            </a>
          </>
        )}
        {data.status === "failed" && (
          <span style={{ fontSize: 13, color: "var(--d-bad)" }}>
            Send failed — {data.failure_reason || "retry pending"}
          </span>
        )}
      </div>
    </section>
  );
}
