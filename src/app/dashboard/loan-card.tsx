"use client";

/**
 * ActiveLoanCard — the "existing loan" card on the dashboard, extracted from
 * page.tsx so it can be rendered OUTSIDE the wallet-gated dashboard.
 *
 * WHY THIS FILE EXISTS (operator mandate 2026-09-01): a borrower's live loan
 * card rendered with overlapping text ("things were all out of whack"), and
 * nothing in CI could have caught it — the card only ever rendered behind a
 * connected wallet with real loan data, so no build, type check, or reviewer
 * ever SAW it under adversarial data. The card now also renders in
 * /qa/loan-cards with deliberately hostile fixtures, and
 * scripts/check-loan-overlap.mjs fails CI if any two pieces of text overlap
 * or anything overflows, at every breakpoint. Cosmetic breakage on a loan
 * card is now a red X, not a surprise.
 *
 * Keep this component byte-faithful to the dashboard's behavior: it IS the
 * production card, not a copy. page.tsx renders <ActiveLoanCard/>; the QA
 * gallery renders the same component with fixtures.
 */

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LoanExpiryNotice } from "@/components/LoanExpiryNotice";
import { RepayReadinessNote } from "@/components/RepayReadinessNote";
import { TakeProfitCard } from "./TakeProfitCard";
import type { TakeProfitState } from "@/lib/solana/site-take-profit";

/** Format a raw token amount with decimals into a human-readable string */
export function formatTokenAmount(rawAmount: string, decimals: number): string {
  const num = Number(rawAmount) / Math.pow(10, decimals);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num > 0) return num.toPrecision(4);
  return "0";
}

export function TokenIcon({ mint, symbol, size = 28 }: { mint: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ width: size, height: size, background: "var(--d-accent-dim)", color: "var(--d-accent-deep)" }}
      >
        {symbol[0]}
      </div>
    );
  }

  return (
    <img
      src={`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`}
      alt={symbol}
      width={size}
      height={size}
      // loading="lazy" defers offscreen icons; decoding="async" keeps
      // image decode off the main render thread on mobile.
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

/** Structural view of the dashboard's Loan type — the fields this card reads. */
export type ActiveLoan = {
  loan_id: string | null;
  loan_pda: string;
  collateral: {
    mint: string;
    symbol: string | null;
    decimals: number | null;
    amount: string | null;
    current_amount?: string | null;
    sol_proceeds_lamports?: string | null;
    auto_sells_fired?: number;
  };
  loan: { original_amount_lamports: string | null; ltv_percentage: number; duration_days: number };
  timestamps: { due_at: string };
  health?: {
    ratio: number;
    liquidation_price_sol: number | null;
  } | null;
};

export function ActiveLoanCard({
  loan: l,
  siteRepayEnabled,
  pending,
  onRepay,
  onExtend,
  onTopup,
  solBalanceLamports,
  tpState,
  onTpMutated,
  botApiUrl,
}: {
  loan: ActiveLoan;
  siteRepayEnabled: boolean;
  pending: { repay: boolean; extend: boolean; topup: boolean };
  onRepay: () => void;
  onExtend: () => void;
  onTopup: () => void;
  solBalanceLamports: bigint | number | null | undefined;
  tpState: TakeProfitState | null;
  onTpMutated: () => void;
  botApiUrl: string;
}) {
  const owedSol = Number(BigInt(l.loan.original_amount_lamports ?? "0")) / LAMPORTS_PER_SOL;
  const due = new Date(l.timestamps.due_at);
  const msLeft = due.getTime() - Date.now();
  const dueLabel = msLeft <= 0
    ? `Overdue by ${Math.floor(-msLeft / 86_400_000)}d`
    : msLeft < 86_400_000
      ? `Due in ${Math.floor(msLeft / 3_600_000)}h`
      : `Due in ${Math.floor(msLeft / 86_400_000)}d`;
  const overdue = msLeft <= 0;

  // Live health snapshot. Color-band the badge so users see
  // their risk at a glance: green safe, amber tight, red danger.
  // Thresholds: <1.20x = danger (close to 1.10x liquidation),
  //             1.20-1.50x = tight, >1.50x = healthy.
  const h = l.health?.ratio ?? null;
  const healthBand = h == null
    ? { txt: "text-[var(--d-ink-faint)]", bg: "bg-transparent", label: "—" }
    : h < 1.20
      ? { txt: "text-red-500", bg: "bg-red-500/10 border border-red-500/30", label: `${h.toFixed(2)}x · danger` }
      : h < 1.50
        ? { txt: "text-amber-500", bg: "bg-amber-500/10 border border-amber-500/30", label: `${h.toFixed(2)}x · tight` }
        : { txt: "text-emerald-500", bg: "bg-emerald-500/10 border border-emerald-500/30", label: `${h.toFixed(2)}x · healthy` };

  const anyPending = pending.repay || pending.extend || pending.topup;

  return (
    <div
      key={l.loan_pda}
      id={`loan-${l.loan_id ?? l.loan_pda}`}
      data-loan-id={String(l.loan_id ?? l.loan_pda)}
      className="px-4 py-3 transition-colors duration-500"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <TokenIcon mint={l.collateral.mint} symbol={l.collateral.symbol || "?"} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[14px] break-all">{l.collateral.symbol || l.collateral.mint.slice(0, 6)}</span>
            <span className="text-[10px] text-[var(--d-ink-faint)] whitespace-nowrap">{l.loan.ltv_percentage}% LTV · {l.loan.duration_days}d</span>
            {h != null && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${healthBand.bg} ${healthBand.txt}`}
                title="Collateral value ÷ amount owed. Below 1.10x triggers auto-liquidation."
              >
                {healthBand.label}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--d-ink-soft)] break-words">
            {(() => {
              // V4 mixed-collateral rendering: when an auto-sell has
              // converted a slice of SPL to SOL, the user's collateral
              // is now (remaining SPL) + (SOL in vault). Both come
              // back to them at repay. The unmixed case (V1/V2/V3 or
              // V4 pre-fire) falls through to the original display.
              const mixed = (l.collateral.auto_sells_fired ?? 0) > 0;
              const decimals = l.collateral.decimals;
              if (decimals === null) return "—";
              if (mixed) {
                const splAmt = l.collateral.current_amount ?? l.collateral.amount;
                const vaultLamports = BigInt(l.collateral.sol_proceeds_lamports ?? "0");
                const vaultSol = Number(vaultLamports) / LAMPORTS_PER_SOL;
                return (
                  <>
                    {splAmt
                      ? formatTokenAmount(splAmt, decimals)
                      : "—"} {l.collateral.symbol || ""} + {vaultSol.toFixed(3)} SOL <span className="text-[var(--d-ink-faint)]">vault</span>
                  </>
                );
              }
              return l.collateral.amount
                ? <>{formatTokenAmount(l.collateral.amount, decimals)} collateral</>
                : "—";
            })()}
            {l.health?.liquidation_price_sol != null && (
              <>
                {" · "}
                <span className="text-[var(--d-ink-faint)] whitespace-nowrap">
                  liq @ {l.health.liquidation_price_sol < 0.000001
                    ? l.health.liquidation_price_sol.toExponential(2)
                    : l.health.liquidation_price_sol.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")} SOL
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0 sm:items-end sm:shrink-0">
          <div className="flex items-center justify-between gap-2 sm:text-right sm:justify-end">
            <div>
              <div className="text-[13px] font-semibold whitespace-nowrap">{owedSol.toFixed(4)} SOL</div>
              <div className={`text-[10px] whitespace-nowrap ${overdue ? "text-red-500" : "text-[var(--d-ink-faint)]"}`}>{dueLabel}</div>
            </div>
            {siteRepayEnabled && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={onRepay}
                  disabled={anyPending}
                  // text-white on bright accent was too hot in
                  // dark mode. Use the accent-ink token which
                  // resolves to the proper high-contrast
                  // foreground for each theme (dark text on
                  // light, light-but-not-white on dark).
                  className="rounded-md bg-[var(--d-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-accent-ink)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pending.repay ? "Repaying…" : "Repay"}
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={onExtend}
                    disabled={anyPending}
                    className="flex-1 rounded-md border border-[var(--d-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending.extend ? "…" : "Extend"}
                  </button>
                  <button
                    onClick={onTopup}
                    disabled={anyPending}
                    className="flex-1 rounded-md border border-[var(--d-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--d-ink-soft)] transition hover:bg-[var(--d-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending.topup ? "…" : "Top up"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/*
        The deadline comes FIRST: it is the only thing on this card with a
        hard consequence attached. Site-only borrowers get no warning DM at
        all (their stub user row has no real Telegram account, so every DM
        fails "chat not found"), and all nine unwarned liquidations in the
        last 90 days were site-only. For those borrowers this notice is the
        ONLY warning that exists.

        LAYOUT (operator incident 2026-09-01): these notices are full-width
        banners BELOW the header row — never children of the row's right
        column. Inside that column their paragraph text set the column's
        intrinsic width, crushing the symbol/collateral column to ~1ch and
        rendering the whole card "out of whack" whenever a loan was close
        enough to its deadline for the notices to appear. The overlap guard
        (/qa/loan-cards + check:loan-overlap) pins this.
      */}
      <LoanExpiryNotice
        dueAt={l.timestamps?.due_at}
        onRepay={siteRepayEnabled ? onRepay : undefined}
        onExtend={siteRepayEnabled ? onExtend : undefined}
      />
      <RepayReadinessNote
        owedLamports={l.loan.original_amount_lamports}
        balanceLamports={solBalanceLamports}
        vaultSolLamports={l.collateral.sol_proceeds_lamports}
      />
      {l.loan_id && (
        <TakeProfitCard
          botApiUrl={botApiUrl}
          loanIdChain={String(l.loan_id)}
          loanDbId={Number((l as unknown as { id?: number; loan_db_id?: number }).id ?? (l as unknown as { id?: number; loan_db_id?: number }).loan_db_id ?? 0)}
          collateralSymbol={l.collateral.symbol}
          collateralMint={l.collateral.mint}
          state={tpState}
          onMutated={onTpMutated}
        />
      )}
    </div>
  );
}
