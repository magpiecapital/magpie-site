/**
 * Repay readiness — "can this borrower actually close this loan right now?"
 *
 * WHY THIS EXISTS. `repay_loan` takes the owed amount OUT of the borrower's
 * wallet FIRST, and only then returns the vault contents (remaining collateral
 * + any SOL from auto-sells that already fired). So a borrower who spent their
 * borrowed SOL can be unable to repay even though the value that would clear
 * the debt is sitting in their own vault. From production support:
 *
 *   "I just tried repaying a loan and it failed. The error was: their wallet
 *    didn't have enough SOL to cover the loan amount + Solana network fees."
 *
 * That borrower is not reckless — spending borrowed SOL is what borrowing is
 * FOR. Discovering the problem at the moment of repay, when the loan may be
 * near expiry, is the worst possible time. This module lets the loan card say
 * it on day one instead.
 *
 * TWO RULES THIS FILE ENFORCES:
 *
 *  1. ONE SOURCE OF TRUTH. The pre-flight guard in the repay handler and the
 *     early warning on the card MUST agree. A warning that says "you're fine"
 *     while the guard refuses is worse than no warning at all, so both call
 *     `computeRepayReadiness()` and share `TX_FEE_RESERVE_LAMPORTS`.
 *
 *  2. NEVER THROW. This renders inside the loan card. A malformed or missing
 *     field must degrade to `status: "unknown"` and a quiet UI, never take the
 *     dashboard down. Every input is treated as untrusted: these strings come
 *     from an API response, and `BigInt("")` / `BigInt("abc")` throw.
 *
 * Pure, synchronous, no I/O — all inputs are already present on the client, so
 * this adds no endpoint, no fetch and no new attack surface.
 */

/**
 * Reserve on top of the owed amount, covering the network/priority fee plus the
 * few lamports of interest drift between `original_amount_lamports` and the
 * live on-chain `repay_amount`.
 *
 * Shared deliberately — see rule 1 above.
 */
export const TX_FEE_RESERVE_LAMPORTS = 5_000_000n; // 0.005 SOL

export type RepayReadinessStatus =
  /** Enough liquid SOL to close the loan today. */
  | "ready"
  /** Short of the amount needed. `deficitLamports` is how much more is needed. */
  | "short"
  /** Not enough information to judge (missing/malformed data). Show nothing. */
  | "unknown";

export interface RepayReadiness {
  status: RepayReadinessStatus;
  /** Owed principal as reported on-chain. */
  owedLamports: bigint;
  /** Liquid SOL required in the wallet = owed + reserve. */
  neededLamports: bigint;
  /** Borrower's current liquid SOL. */
  balanceLamports: bigint;
  /** How much MORE liquid SOL is required. 0n when ready. */
  deficitLamports: bigint;
  /**
   * SOL already sitting in the loan vault from auto-sells, returned to the
   * borrower by the same repay transaction. This is why the true cost of
   * closing is lower than `neededLamports` — the borrower needs it liquid, but
   * does not ultimately spend all of it.
   */
  vaultSolLamports: bigint;
  /**
   * True economic cost of closing = needed − vault SOL, floored at 0.
   * Showing only `neededLamports` makes closing look far more expensive than
   * it is and can scare a borrower into defaulting instead.
   */
  netCostLamports: bigint;
}

/** Parse an untrusted lamport string. Returns null on anything unusable. */
function toLamports(v: unknown): bigint | null {
  if (typeof v === "bigint") return v >= 0n ? v : null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    return BigInt(v);
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  // BigInt() accepts "0x..", "1e3" is rejected but "" becomes 0n — be explicit
  // and allow only plain digits, so no exotic literal slips through.
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

export interface RepayReadinessInput {
  /** `loan.loan.original_amount_lamports` — the on-chain owed amount. */
  owedLamports: unknown;
  /** Borrower's liquid SOL, in LAMPORTS. */
  balanceLamports: unknown;
  /** `loan.collateral.sol_proceeds_lamports` — vault SOL from auto-sells. */
  vaultSolLamports?: unknown;
}

/**
 * Decide whether the borrower can close this loan right now.
 * Never throws; returns `status: "unknown"` when inputs are unusable.
 */
export function computeRepayReadiness(input: RepayReadinessInput): RepayReadiness {
  const unknown: RepayReadiness = {
    status: "unknown",
    owedLamports: 0n,
    neededLamports: 0n,
    balanceLamports: 0n,
    deficitLamports: 0n,
    vaultSolLamports: 0n,
    netCostLamports: 0n,
  };

  try {
    const owed = toLamports(input?.owedLamports);
    const balance = toLamports(input?.balanceLamports);
    // A missing vault figure is normal (V1/V2/V3, or V4 before any auto-sell),
    // so it degrades to 0 rather than making the whole result unknown.
    const vault = toLamports(input?.vaultSolLamports) ?? 0n;

    if (owed === null || balance === null) return unknown;
    // A zero owed amount means there is nothing to judge — a closed or
    // not-yet-synced loan. Say nothing rather than claim "ready".
    if (owed <= 0n) return unknown;

    const needed = owed + TX_FEE_RESERVE_LAMPORTS;
    const deficit = balance >= needed ? 0n : needed - balance;
    const netCost = needed > vault ? needed - vault : 0n;

    return {
      status: deficit === 0n ? "ready" : "short",
      owedLamports: owed,
      neededLamports: needed,
      balanceLamports: balance,
      deficitLamports: deficit,
      vaultSolLamports: vault,
      netCostLamports: netCost,
    };
  } catch {
    return unknown; // rule 2 — never take the dashboard down
  }
}

/**
 * Lamports → a short SOL string, rounded UP.
 *
 * Use this for any number the borrower is meant to ACT on — a shortfall, or an
 * amount to add. `fmtSol` truncates, so a deficit of 1.60509 would display as
 * "1.6050"; a borrower who adds exactly that is still short and hits the very
 * failure this note exists to prevent. Rounding up can only ever tell them to
 * bring a few lamports too many.
 */
export function fmtSolCeil(lamports: bigint, dp = 4): string {
  if (lamports <= 0n) return fmtSol(0n, dp);
  const scale = 10n ** BigInt(9 - dp);
  const rounded = ((lamports + scale - 1n) / scale) * scale; // ceil to dp
  return fmtSol(rounded, dp);
}

/** Lamports → a short SOL string. Safe for arbitrarily large bigints. */
export function fmtSol(lamports: bigint, dp = 4): string {
  const neg = lamports < 0n;
  const abs = neg ? -lamports : lamports;
  const whole = abs / 1_000_000_000n;
  const frac = (abs % 1_000_000_000n).toString().padStart(9, "0").slice(0, dp);
  return `${neg ? "-" : ""}${whole.toString()}${dp > 0 ? "." + frac : ""}`;
}
