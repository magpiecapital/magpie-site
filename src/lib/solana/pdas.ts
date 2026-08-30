import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { PROGRAM_ID, PROGRAM_ID_V3, PROGRAM_ID_V4, PROGRAM_ID_V4_1 } from "./constants";

// Each PDA helper accepts an optional `programId` so callers can target
// v1 (memecoin), v2 (legacy RWA), or v3 (live RWA, since 2026-06-13).
// V3 uses a distinct "price_v3" seed prefix on its price_feed PDA —
// passing the v1/v2 "price" seed against the V3 program fails with
// Anchor ConstraintSeeds (error 2006), which then surfaces in the
// borrow flow as StalePriceAttestation. See the price-feed helper
// below for the per-program seed selection. Other PDAs (pool,
// loan-token-vault, loan, collateral-vault) share the same seed
// across all three programs.

export function priceFeedPda(
  mintPubkey: PublicKey,
  poolPubkey: PublicKey,
  programId: PublicKey = PROGRAM_ID,
) {
  // V3 and V4 both use the "price_v3" seed name (same TWAP PriceHistory
  // layout, just different program IDs). V1/V2 use "price". Mis-routing
  // V4 to "price" surfaces as "Account state mismatch" at borrow time.
  const isV3 = programId.equals(PROGRAM_ID_V3);
  const isV4 = !!PROGRAM_ID_V4 && programId.equals(PROGRAM_ID_V4);
  // V4.1 keeps the same "price_v3" seed (verified against its seeds constraint).
  const isV41 = !!PROGRAM_ID_V4_1 && programId.equals(PROGRAM_ID_V4_1);
  const seedPrefix = (isV3 || isV4 || isV41) ? "price_v3" : "price";
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seedPrefix), mintPubkey.toBuffer(), poolPubkey.toBuffer()],
    programId,
  );
}

export function poolPda(authorityPubkey: PublicKey, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), authorityPubkey.toBuffer()],
    programId,
  );
}

export function loanTokenVaultPda(poolPubkey: PublicKey, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan-token-vault"), poolPubkey.toBuffer()],
    programId,
  );
}

export function loanPda(borrowerPubkey: PublicKey, loanId: BN, programId: PublicKey = PROGRAM_ID) {
  const idBuf = Buffer.alloc(8);
  loanId.toArrayLike(Buffer, "le", 8).copy(idBuf);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), borrowerPubkey.toBuffer(), idBuf],
    programId,
  );
}

export function collateralVaultPda(loanPubkey: PublicKey, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collateral-vault"), loanPubkey.toBuffer()],
    programId,
  );
}
