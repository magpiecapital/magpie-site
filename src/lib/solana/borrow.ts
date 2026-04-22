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
import { LENDER_PUBKEY } from "./constants";
import {
  lendingPoolPda,
  loanTokenVaultPda,
  loanPda,
  collateralVaultPda,
} from "./pdas";
import idl from "./magpie.json";

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
}: BorrowParams): Promise<BorrowResult> {
  const collateralMintPk = new PublicKey(collateralMint);
  const loanTokenMintPk = NATIVE_MINT; // wSOL

  const [lendingPool] = lendingPoolPda(LENDER_PUBKEY);
  const [loanTokenVault] = loanTokenVaultPda(lendingPool);

  const collateralTokenProgram = await getMintTokenProgram(
    connection,
    collateralMint,
  );
  const loanTokenProgram = TOKEN_PROGRAM_ID; // wSOL is classic SPL

  const loanId = new BN(Date.now());
  const [loanAccount] = loanPda(borrower, loanId);
  const [collateralVault] = collateralVaultPda(loanAccount);

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
  const program = new Program(idl as any, provider);

  // Pre-instructions
  const preIxs = [
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
      loan: loanAccount,
      collateralVault,
      lendingPool,
      loanTokenVault,
      loanTokenMint: loanTokenMintPk,
      collateralMint: collateralMintPk,
      borrowerCollateralAccount: borrowerCollateralAta,
      borrowerLoanTokenAccount: borrowerWsolAta,
      feeWalletTokenAccount: feeWalletWsolAta,
      borrower,
      systemProgram: SystemProgram.programId,
      collateralTokenProgram,
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
