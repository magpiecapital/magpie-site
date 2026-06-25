"use client";

/**
 * Governance dashboard card.
 *
 * Surfaces active governance proposals to the connected wallet, shows
 * their voting power (read from /api/v1/governance/voting-power on the
 * bot API), and provides a quick link to the cast-vote page.
 *
 * Reasoning for being prominent:
 *   - $MAGPIE holders shouldn't have to hunt for the vote
 *   - Showing voting weight directly answers "do I matter on this?"
 *   - Whale-cap surfaced explicitly so big holders know the ceiling
 *
 * Card hides itself when no proposals are active AND wallet has no
 * recent vote history. Empty-state is "no clutter" on the dashboard.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PROPOSAL_LIFECYCLES, resolveProposalStatus } from "@/lib/governance";

const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";

// Which proposals to query voting power for — DERIVED from the single source of
// truth (src/lib/governance.ts), not hardcoded, so a closed proposal drops off
// and a newly-opened one appears automatically. The bot's voting-window check
// below is still the authoritative "is it open right now" gate.
function candidateProposalIds(now = new Date()): string[] {
  return Object.keys(PROPOSAL_LIFECYCLES).filter((id) => {
    const kind = resolveProposalStatus(id, now)?.kind;
    return kind === "active" || kind === "upcoming";
  });
}

// Mirrors the public response from
// magpie-bot /api/v1/governance/voting-power. The bot intentionally
// REDACTS the raw weight, held balance, collateralized balance, total
// eligible weight, and exact snapshot timing — those are operator-
// internal per the governance-snapshot privacy rule (any of them would
// let an attacker game the next snapshot). The dashboard shows what
// the bot actually returns: capped percentage of the eligible pool +
// cap-state flags. The user's own raw $MAGPIE balance is something
// they can verify in their wallet UI — we don't need to mirror it here.
interface VotingPower {
  eligible: boolean;
  wallet: string;
  capped_pct_of_pool?: number;
  was_capped?: boolean;
  cap_fraction?: number;
  reason?: string;
  proposal: {
    id: string;
    title: string;
    voting_started_at_iso: string | null;
    voting_ends_at_iso: string | null;
    quorum_pct: number;
    threshold_pct: number;
  };
}

function fmtCloses(iso?: string | null): { label: string; warn: boolean } {
  if (!iso) return { label: "—", warn: false };
  const end = new Date(iso);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  if (ms < 0) return { label: "closed", warn: false };
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return { label: `${d}d ${h}h left`, warn: false };
  if (h > 0) return { label: `${h}h ${m}m left`, warn: h < 6 };
  return { label: `${m}m left`, warn: true };
}

export default function GovernanceCard() {
  const { publicKey } = useWallet();
  const [powers, setPowers] = useState<VotingPower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey || !botApiUrl) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const wallet = publicKey.toBase58();
      const ids = candidateProposalIds();
      if (ids.length === 0) { setLoading(false); return; }
      const results = await Promise.all(
        ids.map(async (pid) => {
          try {
            const r = await fetch(`${botApiUrl}/api/v1/governance/voting-power?wallet=${wallet}&proposal_id=${pid}`);
            if (!r.ok) return null;
            return (await r.json()) as VotingPower;
          } catch { return null; }
        }),
      );
      if (!cancelled) {
        setPowers(results.filter((x): x is VotingPower => !!x));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  // Hide card entirely if no proposals or wallet not connected — keeps dashboard clean
  if (!publicKey || loading) return null;
  // Filter for proposals in an active window
  const activePowers = powers.filter((p) => {
    if (!p.proposal.voting_started_at_iso || !p.proposal.voting_ends_at_iso) return false;
    const start = new Date(p.proposal.voting_started_at_iso);
    const end = new Date(p.proposal.voting_ends_at_iso);
    const now = new Date();
    return now >= start && now <= end;
  });
  if (activePowers.length === 0) return null;

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
          Governance — active votes
        </h3>
        <Link
          href="/governance"
          style={{ fontSize: 13, color: "var(--d-ink-soft)", textDecoration: "underline" }}
        >
          See all
        </Link>
      </div>

      {activePowers.map((p) => {
        const closes = fmtCloses(p.proposal.voting_ends_at_iso);
        return (
          <div key={p.proposal.id} style={{ borderTop: "1px solid var(--d-border)", paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--d-ink)" }}>{p.proposal.id}</div>
                <div style={{ fontSize: 13, color: "var(--d-ink-soft)" }}>{p.proposal.title}</div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: closes.warn ? "var(--d-warn)" : "var(--d-ink-soft)",
                  fontWeight: closes.warn ? 600 : 400,
                }}
              >
                {closes.label}
              </div>
            </div>

            <div style={{ marginTop: 10, padding: 12, background: "var(--d-surface)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--d-ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Your voting weight
              </div>
              {p.eligible ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: "var(--d-ink)" }}>
                    {(p.capped_pct_of_pool ?? 0).toFixed(4)}% of eligible pool
                  </div>
                  <div style={{ fontSize: 12, color: "var(--d-ink-soft)", marginTop: 2 }}>
                    {p.was_capped ? (
                      <span style={{ color: "var(--d-warn)" }}>
                        Capped at {((p.cap_fraction ?? 0.02) * 100).toFixed(0)}% per-wallet maximum
                      </span>
                    ) : (
                      <span>Your share of the vote</span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--d-ink-soft)", marginTop: 4 }}>
                  Not eligible &mdash; {p.reason === "wallet_not_in_snapshot_or_zero_balance"
                    ? "this wallet wasn't holding $MAGPIE when the snapshot was taken. If you bought after the snapshot, you'll be eligible for the next proposal."
                    : p.reason}
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Link
                href={`/governance/proposal/${p.proposal.id}`}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: "var(--d-cta-bg)",
                  color: "var(--d-cta-text)",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {p.eligible ? "Cast your vote →" : "View proposal →"}
              </Link>
            </div>
          </div>
        );
      })}
    </section>
  );
}
