#!/usr/bin/env node
/**
 * Guard for repay-readiness.
 *
 * This renders inside the loan card and its numbers must match the pre-flight
 * guard in the repay handler exactly. Two failure modes are unacceptable:
 *   - saying "ready" when the guard would refuse (borrower trusts us, then fails)
 *   - throwing (takes the dashboard down)
 * Both are tested first.
 */
import {
  computeRepayReadiness,
  TX_FEE_RESERVE_LAMPORTS,
  fmtSol,
  fmtSolCeil,
} from "../src/lib/repay-readiness.ts";

let failed = 0;
const check = (name, cond) => { if (!cond) { failed++; console.error(`✕ ${name}`); } else console.log(`✓ ${name}`); };
const SOL = (n) => (BigInt(Math.round(n * 1000)) * 1_000_000n).toString(); // n SOL → lamport string

// ── never throws, on anything ──────────────────────────────────────────────
for (const bad of [
  undefined, null, {}, { owedLamports: null, balanceLamports: null },
  { owedLamports: "abc", balanceLamports: "1" },
  { owedLamports: "", balanceLamports: "" },
  { owedLamports: "-5", balanceLamports: "1" },
  { owedLamports: "1e9", balanceLamports: "1" },          // exotic numeric literal
  { owedLamports: "0x10", balanceLamports: "1" },         // hex must be rejected
  { owedLamports: "1.5", balanceLamports: "1" },
  { owedLamports: NaN, balanceLamports: 5 },
  { owedLamports: Infinity, balanceLamports: 5 },
  { owedLamports: {}, balanceLamports: [] },
  { owedLamports: "9".repeat(60), balanceLamports: "1" }, // absurdly large, must not throw
]) {
  let threw = false, res;
  try { res = computeRepayReadiness(bad); } catch { threw = true; }
  check(`no throw on ${JSON.stringify(bad)?.slice(0, 46)}`, !threw && !!res);
}
check("garbage input yields status 'unknown', never 'ready'",
  computeRepayReadiness({ owedLamports: "abc", balanceLamports: "x" }).status === "unknown");
check("a zero owed amount is 'unknown', never 'ready'",
  computeRepayReadiness({ owedLamports: "0", balanceLamports: SOL(10) }).status === "unknown");

// ── agrees with the repay handler's guard: userBalance < owed + reserve ────
{
  const owed = SOL(4);
  const exact = (BigInt(owed) + TX_FEE_RESERVE_LAMPORTS).toString();
  check("balance exactly equal to owed+reserve is READY (guard uses <, not <=)",
    computeRepayReadiness({ owedLamports: owed, balanceLamports: exact }).status === "ready");
  const oneShort = (BigInt(exact) - 1n).toString();
  const r = computeRepayReadiness({ owedLamports: owed, balanceLamports: oneShort });
  check("one lamport short is SHORT", r.status === "short");
  check("deficit of exactly 1 lamport is reported", r.deficitLamports === 1n);
  check("reserve is included in 'needed'", r.neededLamports === BigInt(owed) + TX_FEE_RESERVE_LAMPORTS);
}

// ── the empathy number: net cost accounts for vault SOL coming back ────────
{
  const r = computeRepayReadiness({
    owedLamports: SOL(4.2), balanceLamports: SOL(5), vaultSolLamports: SOL(3.9),
  });
  check("ready when the borrower holds enough liquid", r.status === "ready");
  check("vault SOL is surfaced", r.vaultSolLamports === BigInt(SOL(3.9)));
  // needed 4.205, vault 3.9 → net 0.305
  check("net cost subtracts the vault SOL returned by the same tx",
    r.netCostLamports === BigInt(SOL(4.2)) + TX_FEE_RESERVE_LAMPORTS - BigInt(SOL(3.9)));
  check("net cost is far below the liquid requirement (this is the point)",
    r.netCostLamports < r.neededLamports / 10n);
}
{
  const r = computeRepayReadiness({ owedLamports: SOL(1), balanceLamports: SOL(9), vaultSolLamports: SOL(50) });
  check("vault SOL larger than the debt floors net cost at 0, never negative", r.netCostLamports === 0n);
}
{
  const r = computeRepayReadiness({ owedLamports: SOL(1), balanceLamports: SOL(9) });
  check("missing vault field degrades to 0, still usable (V1/V2/V3 loans)",
    r.status === "ready" && r.vaultSolLamports === 0n);
}

// ── formatting is exact (no float rounding on lamports) ───────────────────
check("fmtSol is exact at 9dp precision", fmtSol(1_234_567_891n, 9) === "1.234567891");
check("fmtSol truncates, never rounds up (never overstate what they hold)",
  fmtSol(1_999_999_999n, 2) === "1.99");
check("fmtSol handles zero", fmtSol(0n) === "0.0000");
check("fmtSol handles huge values without precision loss",
  fmtSol(123_456_789_000_000_000n, 2) === "123456789.00");

// ── numbers the borrower ACTS on must round UP, never down ────────────────
check("fmtSolCeil rounds a shortfall UP (following it must never leave them short)",
  fmtSolCeil(1_605_090_000n, 4) === "1.6051");
check("fmtSolCeil leaves an exact value unchanged", fmtSolCeil(1_500_000_000n, 4) === "1.5000");
check("fmtSolCeil of zero is zero", fmtSolCeil(0n) === "0.0000");
check("fmtSolCeil is never LESS than fmtSol (the whole point)",
  Number(fmtSolCeil(1_999_999_999n, 2)) >= Number(fmtSol(1_999_999_999n, 2)));
{
  // The end-to-end promise: add the displayed deficit, and you are covered.
  const owed = "4200000000", bal = "300000000";
  const r0 = computeRepayReadiness({ owedLamports: owed, balanceLamports: bal });
  const shown = fmtSolCeil(r0.deficitLamports);
  const after = (BigInt(bal) + BigInt(Math.round(Number(shown) * 1e9))).toString();
  const r1 = computeRepayReadiness({ owedLamports: owed, balanceLamports: after });
  check("adding exactly the DISPLAYED deficit makes the loan closeable", r1.status === "ready");
}

if (failed) { console.error(`\n[repay-readiness] ${failed} check(s) failed.`); process.exit(1); }
console.log("\n[repay-readiness] OK — matches the repay guard, never throws, never overstates.");
