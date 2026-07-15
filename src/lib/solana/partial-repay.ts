/**
 * Build a partial-repay transaction client-side. Mirrors the bot's
 * executePartialRepay logic in src/services/loans.js. Only the borrower
 * signs — no lender co-signature required.
 *
 * Flow:
 *   1. Wrap exact repayLamports of SOL → wSOL in borrower's ATA
 *   2. Call partial_repay(amount) on the loan
 *   3. Close wSOL ATA (recovers rent + any leftover)
 *
 * Caller passes the EXACT amount in lamports (BigInt). Use parseAmountInput
 * upstream to support keywords like "max" / "50%" — that pattern is
 * already implemented in src/lib/amount-input.js on the bot side.
 */
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { priorityFeeInstructions } from "./priority-fee";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { LENDER_PUBKEY } from "./constants";
import { poolPda, loanTokenVaultPda } from "./pdas";
import idl from "./magpie.json";

export interface PartialRepayParams {
  /** Connected wallet (must equal loan's borrower) */
  borrower: PublicKey;
  /** Loan PDA (from loans.loan_pda) */
  loanPda: string;
  /** Exact amount to repay, in lamports */
  repayLamports: bigint;
  /** Solana RPC connection */
  connection: Connection;
  /** Program ID — v1 or v2b, from loans.program_id */
  programId: PublicKey;
}

export interface PartialRepayResult {
  transaction: Transaction;
}

export async function buildPartialRepayTransaction({
  borrower,
  loanPda,
  repayLamports,
  connection,
  programId,
}: PartialRepayParams): Promise<PartialRepayResult> {
  if (repayLamports <= 0n) throw new Error("Repay amount must be > 0");

  const loanTokenMintPk = NATIVE_MINT;
  const loanPdaPk = new PublicKey(loanPda);

  const [pool] = poolPda(LENDER_PUBKEY, programId);
  const [loanTokenVault] = loanTokenVaultPda(pool, programId);
  const loanTokenProgram = TOKEN_PROGRAM_ID;

  const borrowerWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk, borrower, false, loanTokenProgram,
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

  // Read the live on-chain repay_amount and HARD CLAMP — the bot's
  // amount-input util applies a similar pattern. Even if the caller
  // somehow over-shoots, we never request more than what's actually
  // owed on-chain. Any over-payment would error inside the program;
  // clamping here gives a graceful 'paid full' outcome instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveLoan: any = await (program.account as any).loan.fetch(loanPdaPk);
  const onChainRepayAmount = BigInt(liveLoan.repayAmount.toString());
  const clamped = repayLamports > onChainRepayAmount ? onChainRepayAmount : repayLamports;

  const preIxs = [
    ...(await priorityFeeInstructions(connection, 300_000, { label: "site-partial-repay" })),
    createAssociatedTokenAccountIdempotentInstruction(
      borrower, borrowerWsolAta, borrower, loanTokenMintPk, loanTokenProgram,
    ),
    SystemProgram.transfer({
      fromPubkey: borrower,
      toPubkey: borrowerWsolAta,
      lamports: clamped,
    }),
    createSyncNativeInstruction(borrowerWsolAta, loanTokenProgram),
  ];

  const postIxs = [
    createCloseAccountInstruction(
      borrowerWsolAta, borrower, borrower, [], loanTokenProgram,
    ),
  ];

  const tx = await program.methods
    .partialRepay(new BN(clamped.toString()))
    .accounts({
      pool,
      loanTokenVault,
      loan: loanPdaPk,
      borrowerLoanTokenAccount: borrowerWsolAta,
      borrower,
      loanTokenProgram,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = borrower;

  return { transaction: tx };
}
