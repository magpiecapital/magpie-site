"use client";

import { computeRepayReadiness, fmtSol, fmtSolCeil } from "@/lib/repay-readiness";

/**
 * The one line a borrower most needs, on day one instead of at a failed repay.
 *
 * `repay_loan` takes the owed amount out of the wallet FIRST and only then
 * returns the vault contents, so a borrower who spent their borrowed SOL can be
 * unable to close a loan whose value they already hold. Today they find that out
 * at the moment they try to repay — often near expiry, when it is most stressful
 * and least fixable.
 *
 * Copy rules (see magpie-strategy doc 17 §17.7):
 *  - Never blame. The SOL is "tied up in the vault", not "insufficient funds".
 *    Spending borrowed SOL is what borrowing is FOR.
 *  - Always show what comes BACK. Quoting only the liquid requirement makes
 *    closing look far more expensive than it is and can scare someone into
 *    defaulting instead of repaying.
 *  - Say nothing when there is nothing useful to say. A borrower who is covered
 *    and has no vault SOL does not need a widget.
 */
export function RepayReadinessNote({
  owedLamports,
  balanceLamports,
  vaultSolLamports,
}: {
  owedLamports: string | null | undefined;
  balanceLamports: bigint | number | null | undefined;
  vaultSolLamports?: string | null | undefined;
}) {
  const r = computeRepayReadiness({ owedLamports, balanceLamports, vaultSolLamports });

  if (r.status === "unknown") return null;

  const hasVaultSol = r.vaultSolLamports > 0n;

  // Covered, and nothing interesting to add — stay out of the way.
  if (r.status === "ready" && !hasVaultSol) return null;

  if (r.status === "short") {
    return (
      <div
        className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-[var(--d-ink-soft)]"
        role="status"
      >
        <div className="font-semibold text-amber-600 dark:text-amber-400">
          You&apos;ll need {fmtSolCeil(r.neededLamports)} SOL liquid to close this
        </div>
        <div className="mt-0.5">
          Your wallet holds {fmtSol(r.balanceLamports)} SOL — about{" "}
          <span className="font-semibold">{fmtSolCeil(r.deficitLamports)} SOL</span> more when you&apos;re
          ready to repay.
        </div>
        {hasVaultSol && (
          <div className="mt-1 text-[var(--d-ink-faint)]">
            {fmtSol(r.vaultSolLamports)} SOL of yours is already sitting in the vault and comes
            straight back in the same transaction, so closing really costs about{" "}
            <span className="font-semibold">{fmtSol(r.netCostLamports)} SOL</span>.
          </div>
        )}
        <div className="mt-1 text-[var(--d-ink-faint)]">
          Repayment pays from your wallet first, then returns your collateral and any vault SOL.
        </div>
      </div>
    );
  }

  // Ready, and there IS vault SOL worth mentioning — this is good news, so say it.
  return (
    <div
      className="mt-2 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--d-ink-faint)]"
      role="status"
    >
      Ready to close — needs {fmtSolCeil(r.neededLamports)} SOL liquid, and{" "}
      {fmtSol(r.vaultSolLamports)} SOL comes back from the vault in the same transaction (net{" "}
      <span className="font-semibold text-[var(--d-ink-soft)]">{fmtSol(r.netCostLamports)} SOL</span>
      ).
    </div>
  );
}
