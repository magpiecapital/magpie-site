/**
 * Build a repay transaction client-side, mirroring the bot's executeRepay
 * logic in src/services/loans.js. Unlike borrow, repay does NOT require
 * lender co-signature — only the borrower wallet signs.
 *
 * Flow:
 *   1. Read the live on-chain repay_amount (don't trust DB; sync if stale)
 *   2. Wrap exact SOL → wSOL in borrower's ATA
 *   3. Call repay_loan instruction
 *   4. Close wSOL ATA after (recovers rent + any leftover wSOL)
 *
 * This is the first write-action moved to the site. The on-chain program
 * doesn't care which client builds the tx — it just verifies the borrower
 * signature matches the loan's recorded borrower_pubkey.
 */
import {
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { LENDER_PUBKEY } from "./constants";
import {
  poolPda,
  loanTokenVaultPda,
  collateralVaultPda,
} from "./pdas";
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

export interface RepayParams {
  /** The connected wallet (must equal the loan's borrower) */
  borrower: PublicKey;
  /** Loan PDA (from the loan row's loan_pda column) */
  loanPda: string;
  /** Collateral mint address */
  collateralMint: string;
  /** Solana RPC connection */
  connection: Connection;
  /** Program ID — v1 for memecoins, v2 for RWAs. Read from loans.program_id. */
  programId: PublicKey;
}

export interface RepayResult {
  transaction: Transaction;
  repayLamports: string;
}

export async function buildRepayTransaction({
  borrower,
  loanPda,
  collateralMint,
  connection,
  programId,
}: RepayParams): Promise<RepayResult> {
  const collateralMintPk = new PublicKey(collateralMint);
  const loanTokenMintPk = NATIVE_MINT;
  const loanPdaPk = new PublicKey(loanPda);

  const [pool] = poolPda(LENDER_PUBKEY, programId);
  const [loanTokenVault] = loanTokenVaultPda(pool, programId);
  const [collateralVault] = collateralVaultPda(loanPdaPk, programId);

  const collateralTokenProgram = await getMintTokenProgram(connection, collateralMint);
  const loanTokenProgram = TOKEN_PROGRAM_ID;

  const borrowerCollateralAta = getAssociatedTokenAddressSync(
    collateralMintPk, borrower, false, collateralTokenProgram,
  );
  const borrowerWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk, borrower, false, loanTokenProgram,
  );

  // Build the program client with the right program ID
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

  // Read the live on-chain repay_amount — never trust client-side stored
  // values for the amount that goes into the wrap. Stale DB values would
  // cause us to wrap the wrong number of lamports and the tx to fail.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveLoan: any = await (program.account as any).loan.fetch(loanPdaPk);
  const repayLamports = BigInt(liveLoan.repayAmount.toString());
  if (repayLamports <= 0n) {
    throw new Error("Loan has zero repay amount — already repaid?");
  }

  // Pre-instructions:
  //   1. Idempotent borrower COLLATERAL ATA (program returns collateral here
  //      on success; user may have closed the ATA in their wallet UI)
  //   2. Idempotent borrower wSOL ATA + transfer the repay lamports + sync
  const preIxs = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      borrower, borrowerCollateralAta, borrower, collateralMintPk, collateralTokenProgram,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      borrower, borrowerWsolAta, borrower, loanTokenMintPk, loanTokenProgram,
    ),
    SystemProgram.transfer({
      fromPubkey: borrower,
      toPubkey: borrowerWsolAta,
      lamports: repayLamports,
    }),
    createSyncNativeInstruction(borrowerWsolAta, loanTokenProgram),
  ];

  // Post-instruction: close wSOL ATA, returns any leftover wrapped SOL to
  // the borrower as native SOL plus the ATA rent
  const postIxs = [
    createCloseAccountInstruction(
      borrowerWsolAta, borrower, borrower, [], loanTokenProgram,
    ),
  ];

  const tx = await program.methods
    .repayLoan()
    .accounts({
      pool,
      loanTokenVault,
      loan: loanPdaPk,
      collateralMint: collateralMintPk,
      collateralVault,
      borrowerCollateralAccount: borrowerCollateralAta,
      borrowerLoanTokenAccount: borrowerWsolAta,
      borrower,
      tokenProgram: collateralTokenProgram,
      loanTokenProgram,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = borrower;

  return { transaction: tx, repayLamports: repayLamports.toString() };
}
