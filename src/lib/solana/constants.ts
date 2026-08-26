import { PublicKey } from "@solana/web3.js";

// V1 program — memecoin pool. Default for site-built borrow txs whose
// collateral isn't an RWA.
export const PROGRAM_ID = new PublicKey(
  "4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh",
);

// V2 program — RWA pool (legacy). Continues handling existing V2 RWA
// loans for repay/extend/topup. New RWA borrows route to V3 when the
// V3 routing flag is on (see chooseProgramIdForCategory below).
export const PROGRAM_ID_V2 = new PublicKey(
  "6wSpKAGuiRf3nYHj9raVwmoTPbG5MswBzTy6aMXZHBe",
);

// V3 program — RWA pool. Live since 2026-06-13. Higher LTV ladder
// (50/60/70% @ 7/15/30d), u128 LP withdraw math, hardened TWAP price
// validation. Site routes new RWA borrows here when
// NEXT_PUBLIC_ROUTE_RWA_TO_V3=true. Must stay in sync with the bot's
// ROUTE_RWA_TO_V3 env var — if the site routes to a different program
// than the bot's price-attestor is refreshing, borrows fail with
// StalePriceAttestation (lesson from 2026-06-14).
export const PROGRAM_ID_V3 = new PublicKey(
  "B8AwYzFmc3ZB5EWWVtJcJhJtEmKL78W5i3kZrL1uMCmP",
);

// V4 program — in-vault auto-sell. Adds convert_collateral_slice for
// engine-driven SPL → SOL conversion that keeps the loan ACTIVE. Same
// dual-tier ladder as V3. Pubkey is read from env so it can be replaced
// without a redeploy of the site after the actual V4 deploy lands. Until
// NEXT_PUBLIC_PROGRAM_ID_V4 is set, V4 routing is impossible (the
// resolver below returns V3/V2/V1 just like before).
export const PROGRAM_ID_V4: PublicKey | null =
  process.env.NEXT_PUBLIC_PROGRAM_ID_V4
    ? new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID_V4)
    : null;

// V4.1 — the Sec3-remediated program (live 2026-08-26). When set, NEW LP
// deposits flow here; unset ⇒ deposits fall back to V4 exactly as before.
export const PROGRAM_ID_V4_1: PublicKey | null =
  process.env.NEXT_PUBLIC_PROGRAM_ID_V4_1
    ? new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID_V4_1)
    : null;

export const LENDER_PUBKEY = new PublicKey(
  "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx",
);

// Categories that route to an RWA pool (V2 or V3 depending on flag).
// MUST stay in sync with the bot's RWA_CATEGORIES set in
// bagbank-bot/src/solana/program.js.
export const RWA_CATEGORIES = new Set<string>(["stock", "etf", "metal"]);

// Routing flags — exposed as NEXT_PUBLIC_* so the client-side borrow
// builder can read them. Default false. Bot side env vars ROUTE_*_TO_V*
// MUST agree, or borrows fail with StalePriceAttestation on the wrong
// program (lesson from 2026-06-14).
//
// NOTE (2026-06-15): NEXT_PUBLIC_ROUTE_*_TO_V4 are intentionally NOT
// read here anymore — V4 routing is exit-arming-driven now, not
// flag-driven. Operator can delete those envs after this PR lands.
const ROUTE_RWA_TO_V3 =
  process.env.NEXT_PUBLIC_ROUTE_RWA_TO_V3 === "true";

// Plain (non-exit-armed) memecoins default to V1, which has NO on-chain TWAP
// pump gate (V3/V4 do). Setting NEXT_PUBLIC_ROUTE_MEMECOINS_TO_V3=true routes
// them to V3 for that on-chain protection instead. MUST be flipped in lock-step
// with the bot's ROUTE_MEMECOINS_TO_V3 (routing + cosign guard) and the
// attestor warming V3 memecoin feeds — otherwise the site/bot disagree or the
// first V3 memecoin borrow hits TwapInsufficientHistory. Default off = V1,
// identical to today. See security audit 2026-07-04 #4.
const ROUTE_MEMECOINS_TO_V3 =
  process.env.NEXT_PUBLIC_ROUTE_MEMECOINS_TO_V3 === "true";

// V4 IS EXIT-ONLY routing (operator-mandated 2026-06-16 PM, PERMANENT).
// Supersedes the 2026-06-15 "V4 unconditional default" direction.
//
//   chooseProgramId(category)                          — plain borrow → V1/V2/V3 by category
//   chooseProgramId(category, { hasExitArming: true }) — exit-armed borrow → V4
//
// V4 is the ONLY pool that services exits (engine fire path keeps the
// loan ACTIVE and accumulates SOL in the per-loan vault). Plain borrows
// stay on V1/V2/V3 and never touch V4. Existing V1/V2/V3/V4 loans are
// unaffected — they read their own program_id and continue to
// repay/extend/liquidate against the program that issued them.
export function chooseProgramId(
  category: string | null | undefined,
  opts: { hasExitArming?: boolean } = {},
): PublicKey {
  const { hasExitArming = false } = opts;
  if (hasExitArming) {
    if (!PROGRAM_ID_V4) {
      throw new Error(
        "EXIT_ARMING_REQUIRES_V4: exit-armed borrow requested but NEXT_PUBLIC_PROGRAM_ID_V4 is not set on the site.",
      );
    }
    return PROGRAM_ID_V4;
  }
  if (category && RWA_CATEGORIES.has(category)) {
    return ROUTE_RWA_TO_V3 ? PROGRAM_ID_V3 : PROGRAM_ID_V2;
  }
  // Plain memecoin: V3 (on-chain TWAP) only when the operator opts in AND V3 is
  // configured; otherwise V1, exactly as today.
  if (ROUTE_MEMECOINS_TO_V3 && PROGRAM_ID_V3) return PROGRAM_ID_V3;
  return PROGRAM_ID;
}

/**
 * Backwards-compatible shim — pre-2026-06-15 callers that don't know
 * about exit arming still call this. They get the plain-borrow routing.
 * New callers should use chooseProgramId(category, { hasExitArming })
 * directly so the exit-aware routing engages.
 */
export function chooseProgramIdForCategory(category: string | null | undefined): PublicKey {
  return chooseProgramId(category, { hasExitArming: false });
}

export const LOAN_TIERS = [
  { option: 0, ltv: 0.30, days: 2, fee: 0.03, label: "Express" },
  { option: 1, ltv: 0.25, days: 3, fee: 0.02, label: "Quick" },
  { option: 2, ltv: 0.20, days: 7, fee: 0.015, label: "Standard" },
] as const;
