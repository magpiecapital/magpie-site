import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
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
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  LENDER_PUBKEY,
  PROGRAM_ID,
  PROGRAM_ID_V2,
  RWA_CATEGORIES,
  chooseProgramIdForCategory,
} from "./constants";
import {
  poolPda,
  loanTokenVaultPda,
  loanPda,
  collateralVaultPda,
} from "./pdas";
import idl from "./magpie.json";
import idlV2 from "./magpie-v2.json";

/** Detect whether a mint uses Token-2022 or classic Token program. */
async function getMintTokenProgram(
  connection: Connection,
  mint: string,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(new PublicKey(mint));
  if (!info) throw new Error(`Mint ${mint} not found on-chain`);
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

export interface BorrowParams {
  /** The connected wallet's public key */
  borrower: PublicKey;
  /** Collateral token mint address */
  collateralMint: string;
  /** Raw collateral amount (token base units) */
  collateralAmountRaw: string;
  /** Collateral value in lamports (SOL equivalent) */
  collateralValueLamports: string;
  /** Tier option: 0 = Express, 1 = Quick, 2 = Standard */
  loanOption: number;
  /** Solana RPC connection */
  connection: Connection;
  /**
   * Collateral mint category from /api/v1/tokens — used to route the
   * borrow to the correct program ID. "stock" | "etf" | "metal" →
   * v2 (RWA pool). Anything else → v1 (memecoin pool). When omitted,
   * defaults to v1 — callers that don't pass this MUST know the
   * collateral is not an RWA, else V1 will reject the borrow at
   * Phantom's preflight simulation with InvalidAccountData.
   */
  category?: string | null;
}

export interface BorrowResult {
  transaction: Transaction;
  loanId: string;
  loanPda: string;
}

/**
 * Build a borrow transaction that the user signs with their wallet (Phantom).
 * Mirrors the bot's executeBorrow logic exactly.
 */
export async function buildBorrowTransaction({
  borrower,
  collateralMint,
  collateralAmountRaw,
  collateralValueLamports,
  loanOption,
  connection,
  category,
}: BorrowParams): Promise<BorrowResult> {
  const collateralMintPk = new PublicKey(collateralMint);
  const loanTokenMintPk = NATIVE_MINT; // wSOL

  // Route to V1 or V2 based on the collateral's category. RWAs
  // (stock/etf/metal) MUST use V2 — V1 cannot process them. All PDAs
  // derive against the chosen program (each program has its own pool,
  // loan-token-vault, loan, collateral-vault, price-feed).
  const targetProgramId = chooseProgramIdForCategory(category);
  const isV2 = targetProgramId.equals(PROGRAM_ID_V2);

  const [pool] = poolPda(LENDER_PUBKEY, targetProgramId);
  const [loanTokenVault] = loanTokenVaultPda(pool, targetProgramId);

  const collateralTokenProgram = await getMintTokenProgram(
    connection,
    collateralMint,
  );
  const loanTokenProgram = TOKEN_PROGRAM_ID; // wSOL is classic SPL

  // loan_id is baked into the loan PDA. Two borrows hitting the SAME
  // millisecond would derive the same PDA → second tx fails with
  // AccountAlreadyInitialized on submit (which can surface as an empty
  // "Submission failed" if the on-chain error message doesn't carry
  // through cleanly). Add 16 bits of entropy: collision space 2^16×
  // larger, while Date.now() still dominates so ordering is preserved.
  // Matches the bot's TG-side loan_id construction in services/loans.js.
  const randomSuffix = Math.floor(Math.random() * 0x10000);
  const loanId = new BN(Date.now()).muln(0x10000).addn(randomSuffix);
  const [loanAccount] = loanPda(borrower, loanId, targetProgramId);
  const [collateralVault] = collateralVaultPda(loanAccount, targetProgramId);

  const borrowerCollateralAta = getAssociatedTokenAddressSync(
    collateralMintPk,
    borrower,
    false,
    collateralTokenProgram,
  );

  const borrowerWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk,
    borrower,
    false,
    loanTokenProgram,
  );

  const feeWalletWsolAta = getAssociatedTokenAddressSync(
    loanTokenMintPk,
    LENDER_PUBKEY,
    false,
    loanTokenProgram,
  );

  // Build the Anchor program with a dummy provider (wallet adapter will sign)
  const provider = new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey: borrower, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program((isV2 ? idlV2 : idl) as any, provider);

  // Pre-instructions
  const preIxs = [
    // Priority fee for fast confirmation during congestion.
    // 100k microLamports × 400k CU = 40k lamports = 0.00004 SOL extra.
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      borrower,
      borrowerWsolAta,
      borrower,
      loanTokenMintPk,
      loanTokenProgram,
    ),
  ];

  // Post-instruction: unwrap wSOL → native SOL
  const postIxs = [
    createCloseAccountInstruction(
      borrowerWsolAta,
      borrower,
      borrower,
      [],
      loanTokenProgram,
    ),
  ];

  const tx = await program.methods
    .requestAndFundLoan(
      new BN(collateralAmountRaw),
      loanOption,
      new BN(collateralValueLamports),
      loanId,
    )
    .accounts({
      pool,
      loanTokenVault,
      loan: loanAccount,
      collateralVault,
      collateralMint: collateralMintPk,
      borrowerCollateralAccount: borrowerCollateralAta,
      borrowerLoanTokenAccount: borrowerWsolAta,
      feeWalletTokenAccount: feeWalletWsolAta,
      borrower,
      // Lender authority MUST be passed explicitly — it's marked
      // signer=true in the IDL but has no PDA seed or address constant
      // for Anchor to auto-resolve. Without this, the resulting tx has
      // no signer slot for LENDER_PUBKEY → cosign-borrow rejects with
      // "Lender authority is not a signer in this transaction."
      authority: LENDER_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: collateralTokenProgram,
      loanTokenProgram,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  // Set recent blockhash and fee payer
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = borrower;

  return {
    transaction: tx,
    loanId: loanId.toString(),
    loanPda: loanAccount.toBase58(),
  };
}
