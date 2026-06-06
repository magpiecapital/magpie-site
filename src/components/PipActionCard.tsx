"use client";

/**
 * Inline confirm card Pip renders when it proposes an on-chain action.
 *
 * Currently supports `type: "repay"`. The card shows the loan + amount
 * detail, then a single Sign & Repay button. Click → wallet sign →
 * submit → poll for confirmation → done. Reuses the same
 * buildRepayTransaction the dashboard uses, so the on-chain path is
 * identical and already battle-tested.
 *
 * Pip itself never signs anything. The borrower's wallet does.
 */
import { useCallback, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { ProposedAction } from "@/lib/solana/site-ai-chat";

function fmtSol(s: string): string {
  // Already a human SOL string from the bot, just trim trailing zeros.
  return String(parseFloat(s));
}

export function PipActionCard({
  action,
  onResult,
}: {
  action: ProposedAction;
  onResult: (msg: string) => void;
}) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneSig, setDoneSig] = useState<string | null>(null);

  const expired = Date.now() > action.expires_at;

  const handleSign = useCallback(async () => {
    if (!publicKey || !connected) {
      setError("Connect your wallet first.");
      return;
    }
    if (expired) {
      setError("This proposal expired — ask Pip again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { buildRepayTransaction } = await import("@/lib/solana/repay");
      const programId = new PublicKey(action.program_id);
      const { transaction } = await buildRepayTransaction({
        borrower: publicKey,
        loanPda: action.loan_pda,
        collateralMint: action.collateral_mint,
        connection,
        programId,
      });
      const sig = await sendTransaction(transaction, connection);

      // Poll for confirmation (same pattern dashboard uses)
      const start = Date.now();
      let confirmed = false;
      while (Date.now() - start < 90_000) {
        const status = await connection.getSignatureStatus(sig);
        const s = status?.value;
        if (s?.err) throw new Error(JSON.stringify(s.err));
        if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
          confirmed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!confirmed) throw new Error("Tx not confirmed in 90s — check Solscan");
      setDoneSig(sig);
      onResult(
        `✅ Loan #${action.loan_id} repaid · ${fmtSol(action.owed_sol)} SOL · ` +
        `[tx](https://solscan.io/tx/${sig})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [publicKey, connected, sendTransaction, connection, action, onResult, expired]);

  return (
    <div
      className="rounded-2xl border p-3 mt-2 text-[13px]"
      style={{
        borderColor: "var(--accent)",
        background: "var(--bg-elevated, var(--surface))",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={{ color: "var(--ink)" }}>
          Repay loan #{action.loan_id.slice(-6)}
        </div>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--accent-deep)" }}>
          one-tap action
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--ink-soft)" }}>
        <dt>Owed</dt>
        <dd style={{ color: "var(--ink)" }} className="text-right font-mono">{fmtSol(action.owed_sol)} SOL</dd>
        <dt>Fee included</dt>
        <dd style={{ color: "var(--ink-soft)" }} className="text-right font-mono">{fmtSol(action.fee_sol)} SOL</dd>
        <dt>Collateral returns</dt>
        <dd style={{ color: "var(--ink)" }} className="text-right">{action.collateral_symbol ?? "—"}</dd>
        <dt>Due</dt>
        <dd className="text-right" style={{ color: action.past_due ? "var(--bad)" : "var(--ink-soft)" }}>
          {action.past_due ? "past due" : `in ${action.hours_to_due}h`}
        </dd>
      </dl>

      {doneSig ? (
        <div className="mt-3 text-[12px] flex items-center gap-2" style={{ color: "var(--good, #22c55e)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Repaid · <a href={`https://solscan.io/tx/${doneSig}`} target="_blank" rel="noopener noreferrer" className="underline">tx</a>
        </div>
      ) : (
        <button
          onClick={handleSign}
          disabled={busy || expired}
          className="mt-3 w-full rounded-xl py-2 text-sm font-semibold transition disabled:opacity-50"
          style={{
            background: "var(--accent)",
            color: "var(--accent-ink, #0a0a0a)",
          }}
        >
          {busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Repay"}
        </button>
      )}
      {error && (
        <div className="mt-2 text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
