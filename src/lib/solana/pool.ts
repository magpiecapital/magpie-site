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
