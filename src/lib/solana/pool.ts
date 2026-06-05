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
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { LENDER_PUBKEY } from "./constants";
import { poolPda, loanTokenVaultPda } from "./pdas";
import idl from "./magpie.json";

function makeDummyProvider(connection: Connection, publicKey: PublicKey) {
  return new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
}

export interface PoolStats {
  totalDeposits: number;
  totalBorrowed: number;
  totalShares: number;
  totalFeesEarned: number;
  totalLoansIssued: number;
  totalLiquidations: number;
  protocolFeeBps: number;
  keeperRewardBps: number;
  paused: boolean;
  availableLiquidity: number;
  utilizationRate: number;
}

/** Fetch on-chain pool stats */
export async function fetchPoolStats(connection: Connection): Promise<PoolStats> {
  const [pool] = poolPda(LENDER_PUBKEY);
  const provider = makeDummyProvider(connection, LENDER_PUBKEY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, provider);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poolAccount = await (program.account as any).lendingPool.fetch(pool) as any;

  const totalDeposits = poolAccount.totalDeposits.toNumber();
  const totalBorrowed = poolAccount.totalBorrowed.toNumber();

  return {
    totalDeposits,
    totalBorrowed,
    totalShares: poolAccount.totalShares.toNumber(),
    totalFeesEarned: poolAccount.totalFeesEarned.toNumber(),
    totalLoansIssued: poolAccount.totalLoansIssued.toNumber(),
    totalLiquidations: poolAccount.totalLiquidations.toNumber(),
    protocolFeeBps: poolAccount.protocolFeeBps,
    keeperRewardBps: poolAccount.keeperRewardBps,
    paused: poolAccount.paused,
    availableLiquidity: totalDeposits - totalBorrowed,
    utilizationRate: totalDeposits > 0 ? totalBorrowed / totalDeposits : 0,
  };
}

export interface DepositorInfo {
  shares: number;
  depositedAmount: number;
  /** Current value of shares in lamports */
  currentValue: number;
  /** Yield earned = currentValue - depositedAmount */
  yieldEarned: number;
}

/** Fetch a depositor's position */
export async function fetchDepositorPosition(
  connection: Connection,
  depositor: PublicKey,
): Promise<DepositorInfo | null> {
  const [pool] = poolPda(LENDER_PUBKEY);
  const provider = makeDummyProvider(connection, depositor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, provider);

  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), depositor.toBuffer()],
    program.programId,
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const position = await (program.account as any).depositorPosition.fetch(positionPda) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poolAccount = await (program.account as any).lendingPool.fetch(pool) as any;

    const shares = position.shares.toNumber();
    const depositedAmount = position.depositedAmount.toNumber();
    const totalShares = poolAccount.totalShares.toNumber();
    const totalDeposits = poolAccount.totalDeposits.toNumber();

    const currentValue = totalShares > 0
      ? Math.floor((shares * totalDeposits) / totalShares)
      : 0;

    return {
      shares,
      depositedAmount,
      currentValue,
      yieldEarned: currentValue - depositedAmount,
    };
  } catch {
    return null; // No position exists
  }
}

/** Build a deposit transaction (wraps SOL -> wSOL -> deposits into pool) */
export async function buildDepositTransaction(
  connection: Connection,
  depositor: PublicKey,
  lamports: number,
): Promise<Transaction> {
  const [pool] = poolPda(LENDER_PUBKEY);
  const [loanTokenVault] = loanTokenVaultPda(pool);
  const provider = makeDummyProvider(connection, depositor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, provider);

  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    depositor,
    false,
    TOKEN_PROGRAM_ID,
  );

  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), depositor.toBuffer()],
    program.programId,
  );

  // Pre: create wSOL ATA + wrap SOL
  const preIxs = [
    // Priority fee — pays validators extra per compute unit so the tx
    // gets prioritized into the next block instead of sitting in the
    // mempool during congestion. 100k microLamports × 300k CU =
    // 30k lamports = 0.00003 SOL extra. Trivial cost, ~10x faster
    // confirmation when the network is busy.
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      depositor, wsolAta, depositor, NATIVE_MINT, TOKEN_PROGRAM_ID,
    ),
    SystemProgram.transfer({
      fromPubkey: depositor,
      toPubkey: wsolAta,
      lamports,
    }),
    createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM_ID),
  ];

  // Post: close wSOL ATA to recover any dust
  const postIxs = [
    createCloseAccountInstruction(
      wsolAta, depositor, depositor, [], TOKEN_PROGRAM_ID,
    ),
  ];

  const tx = await program.methods
    .deposit(new BN(lamports))
    .accounts({
      pool,
      loanTokenVault,
      position: positionPda,
      depositorTokenAccount: wsolAta,
      depositor,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = depositor;

  return tx;
}

/**
 * v1 withdraw has an unfixed u64 overflow at lib.rs:300 — it does
 * `shares.checked_mul(position.deposited_amount)` in u64 instead of u128.
 * For any position where shares × deposited_amount exceeds u64::MAX
 * (≈ 1.84 × 10¹⁹), the call returns MathOverflow (custom error 6004).
 * Roughly, this blocks any single-tx withdraw on LP positions larger
 * than ~1.36 SOL when deposited_amount and shares are both ≈ that size.
 *
 * Until the program is replaced, the site chunks large withdrawals into
 * multiple sequential transactions, each sized so `chunk_shares ×
 * deposited_amount < safety_threshold`. After each chunk lands, the
 * position's deposited_amount has shrunk proportionally, so successive
 * chunks can be slightly larger. This continues until the requested
 * amount is fully withdrawn.
 *
 * Returns the max shares safely withdrawable in one tx, given the
 * current on-chain depositedAmount. Uses u64::MAX / 2 as the safety
 * floor — half of theoretical max to absorb any rounding drift.
 */
export function computeMaxSafeWithdrawShares(depositedAmount: number): bigint {
  if (depositedAmount <= 0) return 0n;
  const U64_MAX = 18_446_744_073_709_551_615n;
  // / 2 safety divisor: leaves us a comfortable 50% headroom under u64
  return U64_MAX / 2n / BigInt(depositedAmount);
}

/** Build a withdraw transaction (withdraws wSOL from pool -> unwraps to SOL) */
export async function buildWithdrawTransaction(
  connection: Connection,
  depositor: PublicKey,
  shares: number,
): Promise<Transaction> {
  const [pool] = poolPda(LENDER_PUBKEY);
  const [loanTokenVault] = loanTokenVaultPda(pool);
  const provider = makeDummyProvider(connection, depositor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl as any, provider);

  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    depositor,
    false,
    TOKEN_PROGRAM_ID,
  );

  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), depositor.toBuffer()],
    program.programId,
  );

  const preIxs = [
    // Priority fee — pays validators extra per compute unit so the tx
    // gets prioritized into the next block instead of sitting in the
    // mempool during congestion. 100k microLamports × 300k CU =
    // 30k lamports = 0.00003 SOL extra. Trivial cost, ~10x faster
    // confirmation when the network is busy.
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      depositor, wsolAta, depositor, NATIVE_MINT, TOKEN_PROGRAM_ID,
    ),
  ];

  const postIxs = [
    createCloseAccountInstruction(
      wsolAta, depositor, depositor, [], TOKEN_PROGRAM_ID,
    ),
  ];

  const tx = await program.methods
    .withdraw(new BN(shares))
    .accounts({
      pool,
      loanTokenVault,
      position: positionPda,
      depositorTokenAccount: wsolAta,
      depositor,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions(preIxs)
    .postInstructions(postIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = depositor;

  return tx;
}
