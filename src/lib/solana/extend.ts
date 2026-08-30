/**
 * Build an extend-loan transaction client-side. Mirrors the bot's
 * executeExtendLoan in src/services/loans.js. Borrower-only signature.
 *
 * Extend renews the loan for another full duration in exchange for a
 * tier-dependent fee on the CURRENT owed amount:
 *   Express (30% LTV) → 3% fee
 *   Quick    (25% LTV) → 2% fee
 *   Standard (20% LTV) → 1.5% fee
 *
 * If past-due, the clock resets from now (not from the old due date).
 *
 * Caller doesn't need to compute the fee — the on-chain program does
 * its own math from the loan account. We just wrap a slight overshoot
 * of the expected fee into wSOL so the program can deduct it. Any
 * leftover wSOL gets unwrapped back to SOL via the post-instruction
 * ATA close.
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
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { LENDER_PUBKEY, PROGRAM_ID_V4_1 } from "./constants";
import { poolPda, loanTokenVaultPda, priceFeedPda } from "./pdas";
import idl from "./magpie.json";
import idlV41 from "./magpie-v4-1.json";

export interface ExtendParams {
  borrower: PublicKey;
  loanPda: string;
  connection: Connection;
  programId: PublicKey;
  /** Required for V4.1 loans — extend_loan re-checks collateral health on-chain. */
  collateralMint?: string | null;
}

export interface ExtendResult {
  transaction: Transaction;
  feeLamports: string;
}

export async function buildExtendTransaction({
  borrower,
  loanPda,
  connection,
  programId,
  collateralMint,
}: ExtendParams): Promise<ExtendResult> {
  const loanTokenMintPk = NATIVE_MINT;
  const loanPdaPk = new PublicKey(loanPda);

  // V4.1 (Sec3 M-01): extend_loan re-checks collateral health ON-CHAIN, so it
  // takes collateral_mint + price_history. The pool authority is an OPTIONAL
  // co-signer, needed only when the loan is NOT provably healthy (stale feed
  // or LTV above the loan's tier). A healthy loan self-extends with the
  // borrower's signature alone — so the site deliberately does NOT route
  // through a lender co-sign: an unhealthy loan should fail loudly
  // (ExtendRequiresAuthority) rather than be silently co-signed into an
  // extension. Caller must warm the feed first (bot /v4/feed-ready).
  const isV41 = !!PROGRAM_ID_V4_1 && programId.equals(PROGRAM_ID_V4_1);
  if (isV41 && !collateralMint) {
    throw new Error("V4.1 extend needs the loan's collateral mint");
  }
  const [pool] = poolPda(LENDER_PUBKEY, programId);
  const [loanTokenVault] = loanTokenVaultPda(pool, programId);
  const loanTokenProgram = TOKEN_PROGRAM_ID;

  const borrowerWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk, borrower, false, loanTokenProgram,
  );
  const feeWalletWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk, LENDER_PUBKEY, false, loanTokenProgram,
  );

  const provider = new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey: borrower, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idlWithAddr = { ...((isV41 ? idlV41 : idl) as any), address: programId.toBase58() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idlWithAddr as any, provider);

  // Compute the extend fee. Match bot logic: tier-dependent fee on current
  // owed amount. Read live on-chain to get the truth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveLoan: any = await (program.account as any).loan.fetch(loanPdaPk);
  const owed = BigInt(liveLoan.repayAmount.toString());
  const ltv = Number(liveLoan.ltvPercentage ?? liveLoan.ltvBps ?? 0);
  // ltv stored in pct (30/25/20) — mirror loans.js logic exactly
  const feeBps = ltv >= 30 ? 300n : ltv >= 25 ? 200n : 150n;
  const feeLamports = (owed * feeBps) / 10_000n;
  if (feeLamports <= 0n) {
    throw new Error("Computed extend fee is 0 — loan may be too small to extend");
  }

  const preIxs = [
    ...(await priorityFeeInstructions(connection, 300_000, { label: "site-extend" })),
    createAssociatedTokenAccountIdempotentInstruction(
      borrower, borrowerWsolAta, borrower, loanTokenMintPk, loanTokenProgram,
    ),
    // Same safety as borrow: ensure fee wallet's wSOL ATA exists
    createAssociatedTokenAccountIdempotentInstruction(
      borrower, feeWalletWsolAta, LENDER_PUBKEY, loanTokenMintPk, loanTokenProgram,
    ),
    SystemProgram.transfer({
      fromPubkey: borrower,
      toPubkey: borrowerWsolAta,
      lamports: feeLamports,
    }),
    createSyncNativeInstruction(borrowerWsolAta, loanTokenProgram),
  ];

  const postIxs = [
    createCloseAccountInstruction(
      borrowerWsolAta, borrower, borrower, [], loanTokenProgram,
    ),
  ];

  // V4.1 extra accounts — mirrors the bot's executeExtend V4.1 branch
  // (services/loans.js): collateral_mint + pool-bound price_history, and
  // NO authority (see note above).
  const v41Accounts: Record<string, PublicKey> = {};
  if (isV41) {
    const collateralMintPk = new PublicKey(collateralMint as string);
    const [priceHistory] = priceFeedPda(collateralMintPk, pool, programId);
    v41Accounts.collateralMint = collateralMintPk;
    v41Accounts.priceHistory = priceHistory;
  }

  const tx = await program.methods
    .extendLoan()
    .accounts({
      pool,
      loanTokenVault,
      loan: loanPdaPk,
      borrowerLoanTokenAccount: borrowerWsolAta,
      feeWalletTokenAccount: feeWalletWsolAta,
      borrower,
      loanTokenProgram,
      ...v41Accounts,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = borrower;

  return { transaction: tx, feeLamports: feeLamports.toString() };
}
