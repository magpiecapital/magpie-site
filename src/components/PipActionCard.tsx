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
  return String(parseFloat(s));
}

/** Convert a raw token amount + decimals into a friendly display
 *  string. e.g. "14160345328" with decimals=6 → "14,160.35".        */
function fmtTokenAmount(rawStr: string, decimals: number): string {
  try {
    const raw = BigInt(rawStr);
    const divisor = 10n ** BigInt(Math.max(0, decimals));
    const whole = raw / divisor;
    const frac = raw % divisor;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (decimals === 0 || frac === 0n) return wholeStr;
    // 2 sig figs of fractional for display (more for very small)
    const fracDigits = Number(whole) < 1 ? Math.min(decimals, 6) : 2;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, fracDigits).replace(/0+$/, "");
    return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  } catch {
    return rawStr;
  }
}

const DEFAULT_BOT_API = "https://magpie-bot-production.up.railway.app";

export function PipActionCard({
  action,
  onResult,
}: {
  action: ProposedAction;
  onResult: (msg: string) => void;
}) {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
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
      if (action.type === "repay") {
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
        await waitConfirmed(connection, sig);
        setDoneSig(sig);
        onResult(
          `✅ Loan #${action.loan_id} repaid · ${fmtSol(action.owed_sol)} SOL · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }

      if (action.type === "topup") {
        const { PublicKey } = await import("@solana/web3.js");
        const { buildTopupTransaction } = await import("@/lib/solana/topup");
        const programId = new PublicKey(action.program_id);
        const { transaction } = await buildTopupTransaction({
          borrower: publicKey,
          loanPda: action.loan_pda,
          collateralMint: action.collateral_mint,
          extraRawAmount: BigInt(action.extra_amount_raw),
          connection,
          programId,
        });
        const sig = await sendTransaction(transaction, connection);
        await waitConfirmed(connection, sig);
        setDoneSig(sig);
        onResult(
          `✅ Added ${action.extra_ui_amount} ${action.collateral_symbol} to loan #${action.loan_id.slice(-6)} · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }

      if (action.type === "extend") {
        const { PublicKey } = await import("@solana/web3.js");
        const { buildExtendTransaction } = await import("@/lib/solana/extend");
        const programId = new PublicKey(action.program_id);
        const { transaction } = await buildExtendTransaction({
          borrower: publicKey,
          loanPda: action.loan_pda,
          connection,
          programId,
        });
        const sig = await sendTransaction(transaction, connection);
        await waitConfirmed(connection, sig);
        setDoneSig(sig);
        onResult(
          `✅ Extended loan #${action.loan_id.slice(-6)} · new due ${new Date(action.new_due_at_utc).toLocaleDateString()} · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }

      if (action.type === "partial_repay") {
        const { PublicKey } = await import("@solana/web3.js");
        const { buildPartialRepayTransaction } = await import("@/lib/solana/partial-repay");
        const programId = new PublicKey(action.program_id);
        const { transaction } = await buildPartialRepayTransaction({
          borrower: publicKey,
          loanPda: action.loan_pda,
          repayLamports: BigInt(action.repay_lamports),
          connection,
          programId,
        });
        const sig = await sendTransaction(transaction, connection);
        await waitConfirmed(connection, sig);
        setDoneSig(sig);
        onResult(
          `✅ Paid down ${fmtSol(action.repay_sol)} SOL on loan #${action.loan_id.slice(-6)} · now owes ${fmtSol(action.owed_sol_after)} SOL · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }

      // borrow: build tx, user signs, bot co-signs, returned signature is final
      if (action.type === "borrow") {
        if (!signTransaction) throw new Error("Wallet does not support signTransaction");
        const { buildBorrowTransaction } = await import("@/lib/solana/borrow");
        const { transaction } = await buildBorrowTransaction({
          borrower: publicKey,
          collateralMint: action.collateral_mint,
          collateralAmountRaw: action.collateral_amount_raw,
          collateralValueLamports: action.collateral_value_lamports,
          loanOption: action.tier_option,
          connection,
        });
        const userSigned = await signTransaction(transaction);
        const partialBase64 = userSigned
          .serialize({ requireAllSignatures: false })
          .toString("base64");
        const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || DEFAULT_BOT_API;
        const res = await fetch(`${botApi}/api/v1/cosign-borrow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partialSignedTxBase64: partialBase64 }),
        });
        const body = await res.json();
        if (!res.ok || !body.ok) {
          throw new Error(body.error || `Co-sign failed (${res.status})`);
        }
        const sig = body.signature as string;
        await waitConfirmed(connection, sig);
        setDoneSig(sig);
        onResult(
          `✅ Borrowed ${fmtSol(action.received_sol)} SOL against ${action.collateral_ui_amount} ${action.collateral_symbol} · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [publicKey, connected, sendTransaction, signTransaction, connection, action, onResult, expired]);

  // ── REPAY card ─────────────────────────────────────────────────
  if (action.type === "repay") {
    return (
      <Card title={`Repay loan #${action.loan_id.slice(-6)}`} kind="repay">
        <Row label="Owed" value={`${fmtSol(action.owed_sol)} SOL`} mono />
        <Row label="Fee included" value={`${fmtSol(action.fee_sol)} SOL`} mono muted />
        <Row
          label="You get back"
          value={`${fmtTokenAmount(action.collateral_amount_raw, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim()}
        />
        <Row
          label="Due"
          value={action.past_due ? "past due" : `in ${action.hours_to_due}h`}
          valueColor={action.past_due ? "var(--bad)" : "var(--ink-soft)"}
        />
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Repay"}
          onClick={handleSign}
        />
      </Card>
    );
  }

  // ── TOPUP card ─────────────────────────────────────────────────
  if (action.type === "topup") {
    return (
      <Card title={`Top up loan #${action.loan_id.slice(-6)}`} kind="add collateral">
        <Row label="Current collateral" value={`${fmtTokenAmount(action.current_collateral_raw, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim()} muted />
        <Row label="Adding" value={`+ ${action.extra_ui_amount} ${action.collateral_symbol ?? "tokens"}`} mono />
        <Row
          label="New total"
          value={(() => {
            try {
              const total = (BigInt(action.current_collateral_raw) + BigInt(action.extra_amount_raw)).toString();
              return `${fmtTokenAmount(total, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim();
            } catch {
              return "—";
            }
          })()}
        />
        <Row label="Effect" value="Lowers LTV, raises health" muted />
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Top up"}
          onClick={handleSign}
        />
      </Card>
    );
  }

  // ── EXTEND card ────────────────────────────────────────────────
  if (action.type === "extend") {
    return (
      <Card title={`Extend loan #${action.loan_id.slice(-6)}`} kind="extend term">
        <Row label="Fee" value={`~${fmtSol(action.est_fee_sol)} SOL`} mono />
        <Row label="Current due" value={new Date(action.current_due_at_utc).toLocaleDateString(undefined, { month: "short", day: "numeric" })} muted />
        <Row label="New due" value={new Date(action.new_due_at_utc).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
        <Row label="Added" value={`${action.duration_days} day${action.duration_days === 1 ? "" : "s"}`} />
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Extend"}
          onClick={handleSign}
        />
      </Card>
    );
  }

  // ── PARTIAL REPAY card ─────────────────────────────────────────
  if (action.type === "partial_repay") {
    return (
      <Card title={`Partial repay · loan #${action.loan_id.slice(-6)}`} kind="partial repay">
        <Row label="Paying" value={`${fmtSol(action.repay_sol)} SOL`} mono />
        <Row label="Currently owed" value={`${fmtSol(action.owed_sol_before)} SOL`} mono muted />
        <Row label="After payment" value={`${fmtSol(action.owed_sol_after)} SOL`} mono />
        {/* Loud warning — users sometimes assume partial repay frees
            collateral proportionally. It does NOT. Make this impossible
            to miss before they sign. */}
        <div
          className="col-span-2 mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug"
          style={{
            borderColor: "var(--accent)",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: "var(--ink)",
          }}
        >
          <span className="font-semibold">⚠️ Your collateral stays locked.</span>{" "}
          A partial repay only reduces what you owe — it does <span className="font-semibold">not</span> return any of your{" "}
          {action.collateral_symbol ?? "collateral"}. To get your tokens back, fully repay the remaining balance.
        </div>
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Pay down"}
          onClick={handleSign}
        />
      </Card>
    );
  }

  // ── BORROW card ────────────────────────────────────────────────
  return (
    <Card title={`Borrow ${fmtSol(action.received_sol)} SOL · ${action.tier_label}`} kind="new loan">
      <Row label="Collateral" value={`${action.collateral_ui_amount} ${action.collateral_symbol}`} />
      <Row label="LTV" value={`${action.ltv_pct}%`} />
      <Row label="Term" value={`${action.duration_days} day${action.duration_days === 1 ? "" : "s"}`} />
      <Row label="Fee" value={`${fmtSol(action.fee_sol)} SOL (${(action.fee_bps / 100).toFixed(2)}%)`} mono muted />
      <Row label="You receive" value={`${fmtSol(action.received_sol)} SOL`} mono />
      <Row label="Due" value={new Date(action.due_at_utc).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} />
      <Footer
        busy={busy}
        expired={expired}
        doneSig={doneSig}
        error={error}
        buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Borrow"}
        onClick={handleSign}
      />
    </Card>
  );
}

/* ── Shared sub-components ───────────────────────────────────────── */

function Card({ title, kind = "action", children }: { title: string; kind?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4 mt-2 text-[13px] shadow-sm"
      style={{
        borderColor: "var(--accent)",
        background: "var(--bg-elevated, var(--surface))",
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b" style={{ borderColor: "color-mix(in srgb, var(--hairline) 60%, transparent)" }}>
        <div className="font-semibold text-[14px] leading-tight" style={{ color: "var(--ink)" }}>{title}</div>
        <div
          className="text-[10px] uppercase tracking-[0.1em] font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: "var(--accent-ink, #0a0a0a)",
            background: "var(--accent)",
          }}
        >
          {kind}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]" style={{ color: "var(--ink-soft)" }}>
        {children}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  muted = false,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  valueColor?: string;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd
        className={`text-right ${mono ? "font-mono" : ""}`}
        style={{ color: valueColor ?? (muted ? "var(--ink-soft)" : "var(--ink)") }}
      >
        {value}
      </dd>
    </>
  );
}

function Footer({
  busy,
  expired,
  doneSig,
  error,
  buttonLabel,
  onClick,
}: {
  busy: boolean;
  expired: boolean;
  doneSig: string | null;
  error: string | null;
  buttonLabel: string;
  onClick: () => void;
}) {
  if (doneSig) {
    return (
      <div className="mt-3 text-[12px] flex items-center gap-2 col-span-2" style={{ color: "var(--good, #22c55e)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Done · <a href={`https://solscan.io/tx/${doneSig}`} target="_blank" rel="noopener noreferrer" className="underline">tx</a>
      </div>
    );
  }
  return (
    <div className="col-span-2 mt-3">
      <button
        onClick={onClick}
        disabled={busy || expired}
        className="w-full rounded-xl py-2 text-sm font-semibold transition disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-ink, #0a0a0a)" }}
      >
        {buttonLabel}
      </button>
      {error && (
        <div className="mt-2 text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

async function waitConfirmed(connection: import("@solana/web3.js").Connection, sig: string) {
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    const status = await connection.getSignatureStatus(sig);
    const s = status?.value;
    if (s?.err) throw new Error(JSON.stringify(s.err));
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Tx not confirmed in 90s — check Solscan");
}
