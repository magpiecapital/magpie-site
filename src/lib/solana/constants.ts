import { PublicKey } from "@solana/web3.js";

// V1 program — memecoin pool. Default for site-built borrow txs whose
// collateral isn't an RWA.
export const PROGRAM_ID = new PublicKey(
  "4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh",
);

// V2 program — RWA pool. Used for stock/etf/metal category collateral
// (Backed xStocks, gold, etc.). Site MUST route RWA borrows here —
// V1 cannot process them and the resulting tx fails Phantom's
// preflight simulation with InvalidAccountData (which is how a fresh
// site user trying to borrow GLDx on 2026-06-11 surfaced this bug).
export const PROGRAM_ID_V2 = new PublicKey(
  "6wSpKAGuiRf3nYHj9raVwmoTPbG5MswBzTy6aMXZHBe",
);

export const LENDER_PUBKEY = new PublicKey(
  "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx",
);

// Categories that route to V2. MUST stay in sync with the bot's
// RWA_CATEGORIES set in bagbank-bot/src/solana/program.js.
export const RWA_CATEGORIES = new Set<string>(["stock", "etf", "metal"]);

/**
 * Pick the program ID for a borrow given the collateral's category.
 * Mirrors bagbank-bot/src/solana/program.js:chooseProgramIdForCategory().
 *
 * Caller supplies the category they read from /api/v1/tokens. When the
 * category is null/unknown, defaults to V1 — same "fail to known-good"
 * stance the bot takes.
 */
export function chooseProgramIdForCategory(category: string | null | undefined): PublicKey {
  if (category && RWA_CATEGORIES.has(category)) return PROGRAM_ID_V2;
  return PROGRAM_ID;
}

export const LOAN_TIERS = [
  { option: 0, ltv: 0.30, days: 2, fee: 0.03, label: "Express" },
  { option: 1, ltv: 0.25, days: 3, fee: 0.02, label: "Quick" },
  { option: 2, ltv: 0.20, days: 7, fee: 0.015, label: "Standard" },
] as const;
