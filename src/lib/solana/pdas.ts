import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { PROGRAM_ID } from "./constants";

export function lendingPoolPda(lenderPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lending-pool"), lenderPubkey.toBuffer()],
    PROGRAM_ID,
  );
}

export function loanTokenVaultPda(lendingPoolPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan-token-vault"), lendingPoolPubkey.toBuffer()],
    PROGRAM_ID,
  );
}

export function loanPda(borrowerPubkey: PublicKey, loanId: BN) {
  const idBuf = Buffer.alloc(8);
  loanId.toArrayLike(Buffer, "le", 8).copy(idBuf);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), borrowerPubkey.toBuffer(), idBuf],
    PROGRAM_ID,
  );
}

export function collateralVaultPda(loanPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collateral-vault"), loanPubkey.toBuffer()],
    PROGRAM_ID,
  );
}
