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
    const collateralLabel = `${fmtTokenAmount(action.collateral_amount_raw, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim();
    return (
      <HeroCard
        title={`Repay loan #${action.loan_id.slice(-6)}`}
        kind="repay"
        heroLabel="You'll pay"
        heroValue={`${fmtSol(action.owed_sol)} SOL`}
        heroSub={Number(action.fee_sol) > 0 ? `Includes ${fmtSol(action.fee_sol)} SOL fee` : undefined}
        reward={{ label: "Reclaim", value: collateralLabel, symbol: action.collateral_symbol ?? undefined }}
        meta={[
          {
            label: action.past_due ? "Status" : "Due",
            value: action.past_due ? "past due" : `in ${action.hours_to_due}h`,
            tone: action.past_due ? "danger" : "neutral",
          },
        ]}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Repay"}
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── TOPUP card ─────────────────────────────────────────────────
  if (action.type === "topup") {
    const sym = action.collateral_symbol ?? "tokens";
    const newTotal = (() => {
      try {
        const total = (BigInt(action.current_collateral_raw) + BigInt(action.extra_amount_raw)).toString();
        return `${fmtTokenAmount(total, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim();
      } catch {
        return "—";
      }
    })();
    return (
      <HeroCard
        title={`Top up loan #${action.loan_id.slice(-6)}`}
        kind="add collateral"
        heroLabel="Adding"
        heroValue={`+${action.extra_ui_amount} ${sym}`}
        heroSub="Lowers LTV, raises health"
        reward={{ label: "New total", value: newTotal }}
        meta={[
          { label: "Currently posted", value: `${fmtTokenAmount(action.current_collateral_raw, action.collateral_decimals)} ${action.collateral_symbol ?? ""}`.trim() },
        ]}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Top up"}
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── EXTEND card ────────────────────────────────────────────────
  if (action.type === "extend") {
    const newDueLabel = new Date(action.new_due_at_utc).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const oldDueLabel = new Date(action.current_due_at_utc).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return (
      <HeroCard
        title={`Extend loan #${action.loan_id.slice(-6)}`}
        kind="extend term"
        heroLabel="Extension fee"
        heroValue={`~${fmtSol(action.est_fee_sol)} SOL`}
        heroSub={`Adds ${action.duration_days} day${action.duration_days === 1 ? "" : "s"} to the loan`}
        reward={{ label: "New due date", value: newDueLabel }}
        meta={[
          { label: "Current due", value: oldDueLabel },
        ]}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Extend"}
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── PARTIAL REPAY card ─────────────────────────────────────────
  if (action.type === "partial_repay") {
    const sym = action.collateral_symbol ?? "collateral";
    return (
      <HeroCard
        title={`Partial repay · loan #${action.loan_id.slice(-6)}`}
        kind="partial repay"
        heroLabel="Paying down"
        heroValue={`${fmtSol(action.repay_sol)} SOL`}
        heroSub={`Reduces what you owe — does NOT release ${sym}`}
        reward={{ label: "Owed after", value: `${fmtSol(action.owed_sol_after)} SOL` }}
        meta={[
          { label: "Owed now", value: `${fmtSol(action.owed_sol_before)} SOL` },
        ]}
        warning={`Your ${sym} stays locked. To get tokens back, fully repay. Or use /reborrow in the bot — closes this loan then opens a smaller one against just the portion you want kept locked.`}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Pay down"}
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── BORROW card ────────────────────────────────────────────────
  return (
    <HeroCard
      title={`Borrow · ${action.tier_label}`}
      kind="new loan"
      heroLabel="You'll receive"
      heroValue={`${fmtSol(action.received_sol)} SOL`}
      heroSub={`Pledging ${action.collateral_ui_amount} ${action.collateral_symbol} at ${action.ltv_pct}% LTV`}
      reward={{ label: "Loan term", value: `${action.duration_days} day${action.duration_days === 1 ? "" : "s"}` }}
      meta={[
        { label: "Fee", value: `${fmtSol(action.fee_sol)} SOL (${(action.fee_bps / 100).toFixed(2)}%)` },
        { label: "Due", value: new Date(action.due_at_utc).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
      ]}
    >
      <Footer
        busy={busy}
        expired={expired}
        doneSig={doneSig}
        error={error}
        buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Borrow"}
        onClick={handleSign}
      />
    </HeroCard>
  );
}

/* ── Shared sub-components ───────────────────────────────────────── */

/**
 * HeroCard: visual hierarchy designed for in-chat action confirms.
 * One LARGE primary number (the cost the user is committing to),
 * a single "you get back" reward chip, and tightly-packed metadata
 * rows beneath. Replaces the flat two-column grid that made every
 * field look equally important.
 */
function HeroCard({
  title,
  kind,
  heroLabel,
  heroValue,
  heroSub,
  reward,
  meta,
  warning,
  children,
}: {
  title: string;
  kind: string;
  heroLabel: string;
  heroValue: string;
  heroSub?: string;
  reward?: { label: string; value: string; symbol?: string };
  meta?: Array<{ label: string; value: string; tone?: "neutral" | "danger" | "good" }>;
  warning?: string;
  children: React.ReactNode;
}) {
  const toneColor = (tone?: "neutral" | "danger" | "good") =>
    tone === "danger" ? "var(--bad)" : tone === "good" ? "var(--good, #22c55e)" : "var(--ink-soft)";
  return (
    <div
      className="rounded-2xl border mt-2 shadow-sm overflow-hidden"
      style={{
        borderColor: "var(--accent)",
        background: "var(--bg-elevated, var(--surface))",
      }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--hairline) 60%, transparent)",
          background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        }}
      >
        <div className="font-semibold text-[13px] leading-tight tracking-tight" style={{ color: "var(--ink)" }}>{title}</div>
        <div
          className="text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: "var(--accent-ink, #0a0a0a)", background: "var(--accent)" }}
        >
          {kind}
        </div>
      </div>

      {/* Hero amount */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-[0.16em] font-medium" style={{ color: "var(--ink-faint)" }}>
          {heroLabel}
        </div>
        <div className="mt-1 font-display text-[26px] font-semibold leading-none tracking-tight" style={{ color: "var(--ink)" }}>
          {heroValue}
        </div>
        {heroSub && (
          <div className="mt-1.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>{heroSub}</div>
        )}
      </div>

      {/* Reward chip — what the user gets back */}
      {reward && (
        <div className="mx-4 mb-3 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
          style={{
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-deep, var(--accent))" }} aria-hidden="true">
              <path d="M20 12v9H4v-9" />
              <path d="M22 7H2v5h20V7z" />
              <path d="M12 22V7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            <span className="text-[11px] uppercase tracking-[0.14em] font-medium" style={{ color: "var(--ink-soft)" }}>{reward.label}</span>
          </div>
          <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            {reward.value}
          </span>
        </div>
      )}

      {/* Warning callout (e.g. partial repay collateral-locked notice) */}
      {warning && (
        <div className="mx-4 mb-3 rounded-xl px-3 py-2 text-[11px] leading-relaxed flex gap-2"
          style={{
            background: "color-mix(in srgb, var(--bad) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--bad) 25%, transparent)",
            color: "var(--ink)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" style={{ color: "var(--bad)" }} aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{warning}</span>
        </div>
      )}

      {/* Compact metadata rows */}
      {meta && meta.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {meta.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-[11.5px]">
              <span className="uppercase tracking-[0.12em]" style={{ color: "var(--ink-faint)" }}>{m.label}</span>
              <span className="font-medium" style={{ color: toneColor(m.tone) }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer (button + status messages) */}
      <div className="px-4 pb-4 pt-1">
        {children}
      </div>
    </div>
  );
}

function Footer({
  busy,
  expired,
  doneSig,
  error,
  buttonLabel,
  onClick,
  /** When true, wrap output so it sits cleanly inside the old 2-col Card grid. */
  inGrid = false,
}: {
  busy: boolean;
  expired: boolean;
  doneSig: string | null;
  error: string | null;
  buttonLabel: string;
  onClick: () => void;
  inGrid?: boolean;
}) {
  if (doneSig) {
    return (
      <div className={`text-[12px] flex items-center gap-2 ${inGrid ? "mt-3 col-span-2" : ""}`} style={{ color: "var(--good, #22c55e)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Done · <a href={`https://solscan.io/tx/${doneSig}`} target="_blank" rel="noopener noreferrer" className="underline">tx</a>
      </div>
    );
  }
  return (
    <div className={inGrid ? "col-span-2 mt-3" : ""}>
      <button
        onClick={onClick}
        disabled={busy || expired}
        aria-busy={busy}
        className="w-full rounded-xl py-2.5 text-[13px] font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--accent)", color: "var(--accent-ink, #0a0a0a)" }}
      >
        {buttonLabel}
      </button>
      {error && (
        <div className="mt-2 text-[11px] leading-snug" style={{ color: "var(--bad)" }}>
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
