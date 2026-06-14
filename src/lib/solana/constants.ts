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

export const LENDER_PUBKEY = new PublicKey(
  "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx",
);

// Categories that route to an RWA pool (V2 or V3 depending on flag).
// MUST stay in sync with the bot's RWA_CATEGORIES set in
// bagbank-bot/src/solana/program.js.
export const RWA_CATEGORIES = new Set<string>(["stock", "etf", "metal"]);

// Routing flag — exposed as NEXT_PUBLIC_* so the client-side borrow
// builder can read it. Default false. Bot side env var
// ROUTE_RWA_TO_V3 must agree.
const ROUTE_RWA_TO_V3 =
  process.env.NEXT_PUBLIC_ROUTE_RWA_TO_V3 === "true";

/**
 * Pick the program ID for a borrow given the collateral's category.
 * Mirrors bagbank-bot/src/solana/program.js:chooseProgramIdForCategory().
 */
export function chooseProgramIdForCategory(category: string | null | undefined): PublicKey {
  if (category && RWA_CATEGORIES.has(category)) {
    return ROUTE_RWA_TO_V3 ? PROGRAM_ID_V3 : PROGRAM_ID_V2;
  }
  return PROGRAM_ID;
}

export const LOAN_TIERS = [
  { option: 0, ltv: 0.30, days: 2, fee: 0.03, label: "Express" },
  { option: 1, ltv: 0.25, days: 3, fee: 0.02, label: "Quick" },
  { option: 2, ltv: 0.20, days: 7, fee: 0.015, label: "Standard" },
] as const;
