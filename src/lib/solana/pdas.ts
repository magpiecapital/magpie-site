import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { PROGRAM_ID } from "./constants";

// Each PDA helper accepts an optional `programId` so callers can target
// either v1 (memecoin program) or v2b (RWA program). Defaults to v1 so
// existing call sites are behaviorally unchanged.

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
