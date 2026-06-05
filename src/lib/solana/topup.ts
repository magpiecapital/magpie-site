/**
 * Build an add-collateral (topup) transaction client-side. Mirrors the
 * bot's executeAddCollateral in src/services/loans.js. Borrower-only
 * signature — adds more tokens to the loan's collateral vault, lowering
 * effective LTV and liquidation risk.
 *
 * Doesn't change the loan amount or due date. Just deepens the cushion.
 */
import {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { collateralVaultPda } from "./pdas";
import idl from "./magpie.json";

async function getMintTokenProgram(
  connection: Connection,
  mint: string,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(new PublicKey(mint));
  if (!info) throw new Error(`Mint ${mint} not found on-chain`);
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

export interface TopupParams {
  borrower: PublicKey;
  loanPda: string;
  collateralMint: string;
  /** Extra raw collateral amount (base units, BigInt) */
  extraRawAmount: bigint;
  connection: Connection;
  programId: PublicKey;
}

export interface TopupResult {
  transaction: Transaction;
}

export async function buildTopupTransaction({
  borrower,
  loanPda,
  collateralMint,
  extraRawAmount,
  connection,
  programId,
}: TopupParams): Promise<TopupResult> {
  if (extraRawAmount <= 0n) throw new Error("Topup amount must be > 0");

  const collateralMintPk = new PublicKey(collateralMint);
  const loanPdaPk = new PublicKey(loanPda);
  const [collateralVault] = collateralVaultPda(loanPdaPk, programId);
  const collateralTokenProgram = await getMintTokenProgram(connection, collateralMint);

  const borrowerCollateralAta = getAssociatedTokenAddressSync(
    collateralMintPk, borrower, false, collateralTokenProgram,
  );

  const provider = new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey: borrower, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idlWithAddr = { ...(idl as any), address: programId.toBase58() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idlWithAddr as any, provider);

  const tx = await program.methods
    .addCollateral(new BN(extraRawAmount.toString()))
    .accounts({
      loan: loanPdaPk,
      collateralMint: collateralMintPk,
      collateralVault,
      borrowerCollateralAccount: borrowerCollateralAta,
      borrower,
      tokenProgram: collateralTokenProgram,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ])
    .transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = borrower;

  return { transaction: tx };
}
