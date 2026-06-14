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

/**
 * Tell the bot that a write tx just landed on-chain so its DB (which
 * feeds the activity feed, /stats lifetime totals, credit score, and
 * on-time streak tracking) picks up the state change immediately
 * instead of waiting for the every-5-min loan-reconciler. Fail-soft —
 * if it errors, the reconciler will catch up shortly.
 */
async function syncLoanWithBot(loanPda: string, signature: string) {
  try {
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || DEFAULT_BOT_API;
    await fetch(`${botApi}/api/v1/sync-loan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loan_pda: loanPda, signature }),
    });
  } catch (err) {
    console.warn("[pip] sync-loan failed (reconciler will catch up):", err);
  }
}

export function PipActionCard({
  action,
  onResult,
}: {
  action: ProposedAction;
  onResult: (msg: string) => void;
}) {
  const { publicKey, connected, sendTransaction, signTransaction, signMessage } = useWallet();
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
        await syncLoanWithBot(action.loan_pda, sig);
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
        await syncLoanWithBot(action.loan_pda, sig);
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
        await syncLoanWithBot(action.loan_pda, sig);
        setDoneSig(sig);
        onResult(
          `✅ Extended loan #${action.loan_id.slice(-6)} · new due ${new Date(action.new_due_at_utc).toLocaleDateString()} · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }

      if (action.type === "take_profit") {
        // Arm flow doesn't build an on-chain tx. We send a signed
        // Ed25519 envelope to the bot which INSERTs the order. The
        // user's wallet adapter shows them the magpie-formatted envelope
        // (collateral, target, slippage) BEFORE they confirm.
        if (!signMessage) {
          throw new Error("Your wallet doesn't support signMessage. Try Phantom or Solflare.");
        }
        const { armTakeProfit } = await import("@/lib/solana/site-take-profit");
        const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || DEFAULT_BOT_API;
        const result = await armTakeProfit({
          botApiUrl: botApi,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          request: {
            from: publicKey.toBase58(),
            loanIdChain: action.loan_id,
            target: action.multiplier != null
              ? { kind: "multiplier", multiplier: action.multiplier }
              : action.target_usd != null
                ? { kind: "price_usd", usd: action.target_usd }
                : { kind: "multiplier", multiplier: 2 },
            slippageBps: action.slippage_bps,
            sellDestination: action.sell_destination,
            expire: action.order_expire || undefined,
          },
        });
        setDoneSig(`order-${result.order_id}`);
        const targetStr = result.target_usd
          ? `$${result.target_usd < 0.01 ? result.target_usd.toFixed(8) : result.target_usd.toFixed(6)}`
          : `${result.multiplier}×`;
        onResult(
          `✅ Take-profit armed for ${result.collateral_symbol ?? "your collateral"} at ${targetStr} (slip ${(result.slippage_bps / 100).toFixed(1)}%) · order #${result.order_id}`,
        );
        return;
      }

      if (action.type === "trailing_stop") {
        // Trailing stop arm — same envelope shape as take_profit but
        // emits Trailing instead of Target. armTakeProfit takes the
        // trailingDistanceBps + drops the target field internally.
        if (!signMessage) {
          throw new Error("Your wallet doesn't support signMessage. Try Phantom or Solflare.");
        }
        const { armTakeProfit } = await import("@/lib/solana/site-take-profit");
        const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || DEFAULT_BOT_API;
        const result = await armTakeProfit({
          botApiUrl: botApi,
          signerPubkey: publicKey.toBase58(),
          signMessage,
          request: {
            from: publicKey.toBase58(),
            loanIdChain: action.loan_id,
            trailingDistanceBps: action.distance_bps,
            slippageBps: action.slippage_bps,
            sellDestination: action.sell_destination,
            expire: action.order_expire || undefined,
          },
        });
        setDoneSig(`order-${result.order_id}`);
        const pct = (action.distance_bps / 100).toFixed(1);
        onResult(
          `Trailing stop armed for ${result.collateral_symbol ?? "your collateral"} at ${pct}% trail (slip ${(result.slippage_bps / 100).toFixed(1)}%) · order #${result.order_id}`,
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
        await syncLoanWithBot(action.loan_pda, sig);
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
          // CRITICAL — passes the authoritative category Pip already
          // resolved server-side. Without this, buildBorrowTransaction
          // falls back to its own client-side fetch of /api/v1/tokens
          // and tries to match by mint; works in most cases but adds a
          // failure mode (stale cache, mint absent from the list) that
          // we sidestep entirely by carrying the category through.
          category: action.collateral_category ?? null,
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
        // Safety net: cosign-borrow records inline, but if that step
        // hit an RPC blip, sync-loan recovers from on-chain truth.
        if (body.loan_pda) {
          await syncLoanWithBot(body.loan_pda, sig);
        }
        setDoneSig(sig);
        onResult(
          `✅ Borrowed ${fmtSol(action.received_sol)} SOL against ${action.collateral_ui_amount} ${action.collateral_symbol} · ` +
          `[tx](https://solscan.io/tx/${sig})`,
        );
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Mirror the full error to the browser console so the
      // operator can paste it for debugging — the toast text-box can
      // visually truncate long messages depending on layout.
      console.error("[magpie] action card failed:", msg, e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [publicKey, connected, sendTransaction, signTransaction, signMessage, connection, action, onResult, expired]);

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
        reward={{ label: "Reclaim", value: collateralLabel }}
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
          successVerb="Loan repaid"
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
          successVerb="Collateral added"
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
          successVerb="Loan extended"
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
        warning={`Your ${sym} stays locked. To get tokens back, fully repay — then open a new, smaller loan against just the portion you want kept locked.`}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Sign & Pay down"}
          successVerb="Loan paid down"
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── TAKE-PROFIT card ───────────────────────────────────────────
  if (action.type === "take_profit") {
    const targetStr =
      action.target_usd != null
        ? `$${action.target_usd < 0.01 ? action.target_usd.toFixed(8) : action.target_usd.toFixed(6)}/token`
        : action.multiplier != null
          ? `${action.multiplier}× current`
          : "target";
    const currentStr =
      action.current_usd != null
        ? `$${action.current_usd < 0.01 ? action.current_usd.toFixed(8) : action.current_usd.toFixed(6)}`
        : null;
    const symbol = action.collateral_symbol ?? "collateral";
    return (
      <HeroCard
        title={`Take-profit on ${symbol}`}
        kind="auto-sell"
        heroLabel="Sell when"
        heroValue={targetStr}
        heroSub={currentStr ? `Currently ${currentStr}` : undefined}
        reward={{ label: "Proceeds", value: action.sell_destination.toUpperCase() }}
        meta={[
          { label: "Slippage cap", value: `${(action.slippage_bps / 100).toFixed(1)}%` },
          { label: "Order expiry", value: action.order_expire ?? "—" },
        ]}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Arm take-profit"}
          successVerb="Take-profit armed"
          onClick={handleSign}
        />
      </HeroCard>
    );
  }

  // ── TRAILING-STOP card ─────────────────────────────────────────
  if (action.type === "trailing_stop") {
    const pct = (action.distance_bps / 100).toFixed(1);
    const floorStr =
      action.initial_floor_usd != null
        ? `$${action.initial_floor_usd < 0.01 ? action.initial_floor_usd.toFixed(8) : action.initial_floor_usd.toFixed(6)}`
        : "seeded at sign";
    const currentStr =
      action.current_usd != null
        ? `$${action.current_usd < 0.01 ? action.current_usd.toFixed(8) : action.current_usd.toFixed(6)}`
        : null;
    const symbol = action.collateral_symbol ?? "collateral";
    return (
      <HeroCard
        title={`Trailing stop on ${symbol}`}
        kind="auto-sell"
        heroLabel={`Trail ${pct}%`}
        heroValue={floorStr}
        heroSub={currentStr ? `Currently ${currentStr} — floor floats up with each new high` : "Floor floats up with each new high"}
        reward={{ label: "Proceeds", value: action.sell_destination.toUpperCase() }}
        meta={[
          { label: "Slippage cap", value: `${(action.slippage_bps / 100).toFixed(1)}%` },
          { label: "Order expiry", value: action.order_expire ?? "—" },
        ]}
      >
        <Footer
          busy={busy}
          expired={expired}
          doneSig={doneSig}
          error={error}
          buttonLabel={busy ? "Signing…" : expired ? "Proposal expired" : "Arm trailing stop"}
          successVerb="Trailing stop armed"
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
        successVerb="Loan funded"
        onClick={handleSign}
      />
    </HeroCard>
  );
}

/* ── Shared sub-components ───────────────────────────────────────── */

/**
 * HeroCard — minimal, mobile-first action confirm.
 *
 * Three lines of content max:
 *   1) Title (small, plain)
 *   2) Hero amount (big, font-display)
 *   3) Optional reward / sub-line
 *
 * Plus a single full-width primary button. No header strips, no chips,
 * no metadata grids — the chat bubble above the card already carries
 * Pip's prose intro, and the card itself is the confirmation moment.
 * Extra chrome on a 280-320px-wide mobile panel competes with the
 * primary CTA and was getting flagged as clunky.
 *
 * Warning slot is kept (for the partial-repay collateral-locked
 * notice) — never optional, but rendered with minimal styling.
 */
function HeroCard({
  title,
  heroLabel,
  heroValue,
  reward,
  warning,
  children,
}: {
  title: string;
  /** @deprecated kept for prop compatibility — unused in the minimal design */
  kind?: string;
  heroLabel: string;
  heroValue: string;
  /** @deprecated kept for prop compatibility — unused in the minimal design */
  heroSub?: string;
  reward?: { label: string; value: string };
  /** @deprecated kept for prop compatibility — unused in the minimal design */
  meta?: Array<{ label: string; value: string; tone?: "neutral" | "danger" | "good" }>;
  warning?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border mt-2 px-4 py-4 shadow-sm"
      style={{
        borderColor: "var(--accent)",
        background: "var(--bg-elevated, var(--surface))",
      }}
    >
      {/* Tiny eyebrow label */}
      <div
        className="text-[11px] font-medium leading-none mb-1"
        style={{ color: "var(--ink-faint)" }}
      >
        {title}
      </div>

      {/* Hero amount — the one number that matters */}
      <div
        className="font-display text-[28px] font-semibold leading-[1.05] tracking-tight"
        style={{ color: "var(--ink)" }}
      >
        {heroValue}
      </div>

      {/* Eyebrow above the hero ("You'll pay", "You'll receive", etc.) */}
      <div
        className="text-[11px] mt-0.5 mb-2.5"
        style={{ color: "var(--ink-faint)" }}
      >
        {heroLabel}
      </div>

      {/* Single optional reward line — no chip, just text */}
      {reward && (
        <div className="flex items-center justify-between gap-3 mb-3 text-[12.5px]">
          <span style={{ color: "var(--ink-faint)" }}>{reward.label}</span>
          <span className="font-semibold text-right" style={{ color: "var(--ink)" }}>
            {reward.value}
          </span>
        </div>
      )}

      {/* Warning slot — only used for partial-repay's collateral-locked notice */}
      {warning && (
        <div
          className="rounded-lg px-2.5 py-2 mb-3 text-[11px] leading-snug"
          style={{
            background: "color-mix(in srgb, var(--bad) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--bad) 22%, transparent)",
            color: "var(--ink)",
          }}
        >
          {warning}
        </div>
      )}

      {/* Footer (button + status) */}
      {children}
    </div>
  );
}

function Footer({
  busy,
  expired,
  doneSig,
  error,
  buttonLabel,
  successVerb = "Done",
  onClick,
  /** When true, wrap output so it sits cleanly inside the old 2-col Card grid. */
  inGrid = false,
}: {
  busy: boolean;
  expired: boolean;
  doneSig: string | null;
  error: string | null;
  buttonLabel: string;
  /** Past-tense verb shown on success ("Repaid", "Borrowed", "Top-up added", etc.). */
  successVerb?: string;
  onClick: () => void;
  inGrid?: boolean;
}) {
  if (doneSig) {
    // Success state: full-width pill with check + past-tense verb,
    // plus a "View tx" affordance. Feels like a small win instead
    // of a buried "Done · tx" footnote.
    return (
      <div className={inGrid ? "col-span-2 mt-3" : ""}>
        <div
          className="w-full rounded-xl py-2.5 px-3 flex items-center justify-between gap-2 pip-card-confirmed"
          style={{
            // Slightly more saturated pill background so the success
            // state feels confident rather than washed out.
            background: "color-mix(in srgb, #16a34a 18%, transparent)",
            border: "1px solid color-mix(in srgb, #16a34a 45%, transparent)",
          }}
        >
          {/* Pinned to a saturated, WCAG-AA dark green (#15803d) for
              the verb text, and a deep solid green (#16a34a) for the
              check circle. var(--good) can resolve to a pale tint in
              some themes, making the check feel ghosted — these
              hardcoded values guarantee strong contrast in both light
              and dark modes. */}
          <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "#15803d" }}>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full pip-check-pop"
              style={{ background: "#16a34a", color: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
              aria-hidden="true"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            {successVerb}
          </div>
          <a
            href={`https://solscan.io/tx/${doneSig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11.5px] font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--ink-soft)" }}
          >
            View tx →
          </a>
        </div>
        <style jsx>{`
          @keyframes pip-check-pop {
            0%   { transform: scale(0.6); opacity: 0; }
            55%  { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .pip-check-pop { animation: pip-check-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1); }
          @keyframes pip-card-confirmed-in {
            from { opacity: 0; transform: translateY(2px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .pip-card-confirmed { animation: pip-card-confirmed-in 220ms ease-out; }
        `}</style>
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
