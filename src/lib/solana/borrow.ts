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
  PROGRAM_ID_V3,
  RWA_CATEGORIES,
  chooseProgramIdForCategory,
} from "./constants";
import {
  poolPda,
  loanTokenVaultPda,
  loanPda,
  collateralVaultPda,
  priceFeedPda,
} from "./pdas";
import idl from "./magpie.json";
import idlV2 from "./magpie-v2.json";
import idlV3 from "./magpie-v3.json";

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

  // ── Server-side category resolution (2026-06-13 hardening, v2) ──
  // Previous version trusted caller-passed category and only fell back
  // to a fetch when it was missing/unrecognized. THIRD report of the
  // SPCX dashboard/Phantom divergence after PR #58, #61, #63 suggests
  // an upstream code path is passing the WRONG category (e.g., a stale
  // client constructing TokenHolding with category="memecoin" even
  // though the mint is stock).
  //
  // This version IGNORES the caller-passed category entirely when the
  // mint resolves to a known supported_mints entry. The server is
  // ALWAYS the source of truth — the caller's hint is treated as a
  // best-effort optimization, never as authoritative.
  //
  // If the lookup fails (network error, mint not in supported_mints),
  // we THROW rather than silently defaulting to V1. A failed borrow
  // with a clear error is infinitely better than a wrong-amount borrow.
  let resolvedCategory: string | null | undefined = category;
  try {
    const res = await fetch(`/api/v1/tokens`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      const tokens: Array<{ mint: string; category?: string }> = Array.isArray(j?.tokens)
        ? j.tokens
        : [];
      const match = tokens.find((t) => t.mint === collateralMint);
      if (match?.category) {
        // Server-side wins. If caller hint disagreed, log it so we can
        // see in the browser console which upstream path is buggy.
        if (resolvedCategory && resolvedCategory !== match.category) {
          console.warn(
            `[borrow] caller passed category=${resolvedCategory} but server says ${match.category} for ${collateralMint.slice(0, 8)}…. Using server value.`,
          );
        }
        resolvedCategory = match.category;
      }
    }
  } catch (err) {
    console.warn(
      "[borrow] server-side category lookup failed:",
      (err as Error).message,
    );
  }

  // Hard-fail if we still don't know the category. Silent default-to-V1
  // is what caused the 0.78-vs-2.68-SOL bug; never again.
  if (!resolvedCategory || !["stock", "etf", "metal", "memecoin"].includes(resolvedCategory)) {
    throw new Error(
      `Borrow refused: couldn't determine collateral category for ${collateralMint}. ` +
        `This usually means the page is stale — hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) and try again. ` +
        `If it persists, the mint may not be in supported_mints.`,
    );
  }

  // Route to V1, V2, or V3 based on the collateral's (server-resolved)
  // category. Memecoin → V1. RWA (stock/etf/metal) → V2 or V3 depending
  // on NEXT_PUBLIC_ROUTE_RWA_TO_V3. All PDAs derive against the chosen
  // program (each program has its own pool, loan-token-vault, loan,
  // collateral-vault, price-feed). V3 uses a distinct "price_v3" seed
  // for price-feed — priceFeedPda handles that branch internally.
  const targetProgramId = chooseProgramIdForCategory(resolvedCategory);
  const isV2 = targetProgramId.equals(PROGRAM_ID_V2);
  const isV3 = targetProgramId.equals(PROGRAM_ID_V3);
  const isRwa = !!resolvedCategory && RWA_CATEGORIES.has(resolvedCategory);

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
  const program = new Program((isV3 ? idlV3 : isV2 ? idlV2 : idl) as any, provider);

  // Pre-instructions
  //
  // The program needs three token accounts to exist BEFORE it tries to
  // transfer through them:
  //   1. borrower wSOL ATA           — receives loan proceeds
  //   2. borrower COLLATERAL ATA     — source of collateral transfer (CRITICAL)
  //   3. fee wallet wSOL ATA         — receives the origination fee
  //
  // The TG-side already creates all three idempotently
  // (src/services/loans.js:229-241 on the bot repo). The site path
  // historically only pre-created #1, which surfaced as
  // "AccountNotInitialized" on the borrow tx when the user held their
  // collateral in a non-canonical token account (common for Token-2022
  // xStocks like SPCX/TSLAx where the Backpack issuance flow may not
  // initialize the canonical ATA up front). Idempotent-create is cheap
  // when the account exists and fixes the missing-ATA case when it
  // doesn't — borrower pays ~0.002 SOL of rent one-time per ATA.
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
    // Borrower's COLLATERAL ATA — uses the matching token program (classic
    // SPL for memecoins, Token-2022 for xStocks). Without this idempotent
    // create, the on-chain transfer from borrower_collateral_account
    // fails with AccountNotInitialized when the user's collateral lives
    // in a non-ATA token account.
    createAssociatedTokenAccountIdempotentInstruction(
      borrower,
      borrowerCollateralAta,
      borrower,
      collateralMintPk,
      collateralTokenProgram,
    ),
    // Fee wallet wSOL ATA — should normally exist on prod (every borrow
    // touches it) but defensive idempotent create costs nothing when the
    // account exists and prevents a one-borrow-loss-of-rent edge case
    // where the fee ATA was closed (wSOL drained → auto-close).
    createAssociatedTokenAccountIdempotentInstruction(
      borrower,
      feeWalletWsolAta,
      LENDER_PUBKEY,
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

  // V3 introduced a category arg (u8) to pick the right tier ladder:
  //   0 = memecoin (30/25/20% LTV @ 2/3/7d)
  //   1 = RWA      (50/60/70% LTV @ 7/15/30d)
  // V1/V2 do not take this arg. Build args conditionally so each
  // program's instruction signature matches its IDL.
  const v3Category = isRwa ? 1 : 0;
  const ixArgs = isV3
    ? [
        new BN(collateralAmountRaw),
        loanOption,
        new BN(collateralValueLamports),
        loanId,
        v3Category,
      ]
    : [
        new BN(collateralAmountRaw),
        loanOption,
        new BN(collateralValueLamports),
        loanId,
      ];

  const tx = await program.methods
    .requestAndFundLoan(...ixArgs)
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
