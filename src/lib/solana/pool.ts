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
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  PROGRAM_ID_V2,
  PROGRAM_ID_V3,
  PROGRAM_ID_V4,
  LENDER_PUBKEY,
} from "./constants";
import { poolPda, loanTokenVaultPda, collateralVaultPda } from "./pdas";
import idlV1 from "./magpie.json";
import idlV2 from "./magpie-v2.json";
import idlV3 from "./magpie-v3.json";
import idlV4 from "./magpie-v4.json";

/* ────────────────────────── LP VERSION ROUTING ──────────────────────────
 * V4 is the flagship: NEW LP deposits flow into the V4 in-vault pool.
 * Existing LPs on V1/V2/V3 are NEVER stranded — position lookup + withdraw
 * sweep every version and act on whichever pool the wallet actually holds.
 *
 * All four programs share identical deposit/withdraw account lists + PDA
 * seeds (pool / position / loan-token-vault), so ONE version-parametrized
 * builder covers them all. V1/V2 carry the u64-overflow `withdraw` bug and
 * need chunking; V3/V4 use u128 → single-tx withdrawals of any size.
 *
 * SAFETY: every function below defaults to the version that preserves the
 * pre-existing behavior (withdraw/position default to v1 — the 110-SOL
 * whale + all legacy V1 LPs keep their exact chunked-bundle path). Only
 * `buildDepositTransaction` changes its default (→ V4) — and that only
 * affects NEW deposits, never an existing position.
 */
export type LpVersion = "v1" | "v2" | "v3" | "v4";

interface LpVersionCfg {
  version: LpVersion;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idl: any;
  programId: PublicKey;
  /** true when the program's withdraw has the u64 overflow → must chunk. */
  needsChunking: boolean;
}

function cfgFor(version: LpVersion): LpVersionCfg {
  switch (version) {
    case "v4":
      if (!PROGRAM_ID_V4) {
        throw new Error("V4_NOT_CONFIGURED: NEXT_PUBLIC_PROGRAM_ID_V4 is unset on the site.");
      }
      return { version, idl: idlV4, programId: PROGRAM_ID_V4, needsChunking: false };
    case "v3":
      return { version, idl: idlV3, programId: PROGRAM_ID_V3, needsChunking: false };
    case "v2":
      return { version, idl: idlV2, programId: PROGRAM_ID_V2, needsChunking: true };
    case "v1":
    default:
      return { version: "v1", idl: idlV1, programId: PROGRAM_ID, needsChunking: true };
  }
}

/**
 * The pool NEW deposits flow into — V4 flagship when configured, else V1
 * (graceful fallback so deposits never hard-break if the env is missing).
 */
export const DEPOSIT_VERSION: LpVersion = PROGRAM_ID_V4 ? "v4" : "v1";

/** Versions to sweep for a wallet's existing positions — flagship first. */
export function allLpVersions(): LpVersion[] {
  const versions: LpVersion[] = [];
  if (PROGRAM_ID_V4) versions.push("v4");
  versions.push("v3", "v2", "v1");
  return versions;
}

function makeDummyProvider(connection: Connection, publicKey: PublicKey) {
  return new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function programForVersion(connection: Connection, publicKey: PublicKey, cfg: LpVersionCfg): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(cfg.idl as any, makeDummyProvider(connection, publicKey));
}

function poolAccountsFor(cfg: LpVersionCfg): { pool: PublicKey; loanTokenVault: PublicKey } {
  const [pool] = poolPda(LENDER_PUBKEY, cfg.programId);
  const [loanTokenVault] = loanTokenVaultPda(pool, cfg.programId);
  return { pool, loanTokenVault };
}

function positionPdaFor(pool: PublicKey, depositor: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), depositor.toBuffer()],
    programId,
  )[0];
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

/** Fetch on-chain pool stats. Defaults to the V4 flagship pool (where new
 *  deposits go); pass a version to read a specific pool. */
export async function fetchPoolStats(
  connection: Connection,
  version: LpVersion = DEPOSIT_VERSION,
): Promise<PoolStats> {
  const cfg = cfgFor(version);
  const { pool } = poolAccountsFor(cfg);
  const program = programForVersion(connection, LENDER_PUBKEY, cfg);

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

/** Fetch a depositor's position in a SPECIFIC pool version. */
export async function fetchDepositorPositionForVersion(
  connection: Connection,
  depositor: PublicKey,
  version: LpVersion,
): Promise<DepositorInfo | null> {
  const cfg = cfgFor(version);
  const { pool } = poolAccountsFor(cfg);
  const program = programForVersion(connection, depositor, cfg);
  const positionPda = positionPdaFor(pool, depositor, cfg.programId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const position = await (program.account as any).depositorPosition.fetch(positionPda) as any;
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
    return null; // No position exists in this version
  }
}

/**
 * Fetch a depositor's position. Back-compat wrapper — defaults to V1 so
 * existing callers see IDENTICAL behavior. Pass a version for a specific
 * pool, or use fetchAllDepositorPositions to sweep every version.
 */
export async function fetchDepositorPosition(
  connection: Connection,
  depositor: PublicKey,
  version: LpVersion = "v1",
): Promise<DepositorInfo | null> {
  return fetchDepositorPositionForVersion(connection, depositor, version);
}

export interface VersionedPosition {
  version: LpVersion;
  info: DepositorInfo;
}

/**
 * Sweep EVERY pool version and return the wallet's non-empty positions
 * (flagship V4 first). This is how the site finds an LP's money wherever
 * it lives — so no V1/V2/V3 depositor (incl. the 110-SOL whale) is ever
 * stranded when new deposits move to V4.
 */
export async function fetchAllDepositorPositions(
  connection: Connection,
  depositor: PublicKey,
): Promise<VersionedPosition[]> {
  const out: VersionedPosition[] = [];
  for (const version of allLpVersions()) {
    const info = await fetchDepositorPositionForVersion(connection, depositor, version).catch(() => null);
    if (info && (info.shares > 0 || info.depositedAmount > 0)) {
      out.push({ version, info });
    }
  }
  return out;
}

/** Build a deposit transaction (wraps SOL -> wSOL -> deposits into pool).
 *  Defaults to the V4 flagship pool — new LP liquidity flows to V4. */
export async function buildDepositTransaction(
  connection: Connection,
  depositor: PublicKey,
  lamports: number,
  version: LpVersion = DEPOSIT_VERSION,
): Promise<Transaction> {
  const cfg = cfgFor(version);
  const { pool, loanTokenVault } = poolAccountsFor(cfg);
  const program = programForVersion(connection, depositor, cfg);

  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    depositor,
    false,
    TOKEN_PROGRAM_ID,
  );

  const positionPda = positionPdaFor(pool, depositor, cfg.programId);

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
 *
 * ONLY V1/V2 need this cap (their withdraw math is u64). V3/V4 use u128
 * and have no per-tx overflow ceiling → they return u64::MAX (effectively
 * "no cap", so any position withdraws in a single transaction).
 */
export function computeMaxSafeWithdrawShares(
  depositedAmount: number,
  version: LpVersion = "v1",
): bigint {
  if (depositedAmount <= 0) return 0n;
  const U64_MAX = 18_446_744_073_709_551_615n;
  const needsChunking = version === "v1" || version === "v2";
  if (!needsChunking) return U64_MAX; // V3/V4: u128 math, single-tx of any size
  // / 2 safety divisor: leaves us a comfortable 50% headroom under u64
  return U64_MAX / 2n / BigInt(depositedAmount);
}

/** Build a withdraw transaction (withdraws wSOL from pool -> unwraps to SOL).
 *  Defaults to V1 (existing whale/legacy LPs); pass the version of the
 *  pool the wallet actually holds a position in. */
export async function buildWithdrawTransaction(
  connection: Connection,
  depositor: PublicKey,
  shares: number,
  version: LpVersion = "v1",
): Promise<Transaction> {
  const cfg = cfgFor(version);
  const { pool, loanTokenVault } = poolAccountsFor(cfg);
  const program = programForVersion(connection, depositor, cfg);

  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    depositor,
    false,
    TOKEN_PROGRAM_ID,
  );

  const positionPda = positionPdaFor(pool, depositor, cfg.programId);

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

/**
 * Max withdraw instructions to pack into ONE transaction. Each `withdraw` ix
 * is ~55k CU; at MAX_WITHDRAW_IXS_PER_TX × 55k we stay well under the 1.4M-CU
 * tx ceiling with headroom for the ATA create/close + priority-fee ixs. Tx-size
 * is not the binding limit here (all ixs share the same accounts). Conservative
 * on purpose: a CU-exhausted bundle would revert (no funds lost, just a wasted
 * approval), so we trade a few extra transactions for zero revert risk.
 */
export const MAX_WITHDRAW_IXS_PER_TX = 12;

/**
 * Build ONE transaction containing MULTIPLE `withdraw` instructions (one per
 * entry in `chunkSharesList`). This is the fix for the V1 u64-overflow chunking
 * blowing up into hundreds of separate wallet approvals: instead of 1 tx per
 * chunk, the caller groups chunks (≤ MAX_WITHDRAW_IXS_PER_TX) into a single tx =
 * a single approval. Safe because the ixs execute atomically and each chunk is
 * still individually sized under the per-tx overflow ceiling (deposited_amount
 * only shrinks as ixs execute, so if chunk[0] is safe every later chunk is too).
 * Caller MUST guarantee sum(chunkSharesList) ≤ the position's remaining shares
 * (so no ix withdraws more than exists / closes the position mid-bundle).
 */
export async function buildWithdrawBundleTransaction(
  connection: Connection,
  depositor: PublicKey,
  chunkSharesList: number[],
  version: LpVersion = "v1",
): Promise<Transaction> {
  const cfg = cfgFor(version);
  const { pool, loanTokenVault } = poolAccountsFor(cfg);
  const program = programForVersion(connection, depositor, cfg);
  const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, depositor, false, TOKEN_PROGRAM_ID);
  const positionPda = positionPdaFor(pool, depositor, cfg.programId);

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(depositor, wsolAta, depositor, NATIVE_MINT, TOKEN_PROGRAM_ID));
  for (const shares of chunkSharesList) {
    const ix = await program.methods
      .withdraw(new BN(shares))
      .accounts({
        pool,
        loanTokenVault,
        position: positionPda,
        depositorTokenAccount: wsolAta,
        depositor,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    tx.add(ix);
  }
  tx.add(createCloseAccountInstruction(wsolAta, depositor, depositor, [], TOKEN_PROGRAM_ID));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = depositor;
  return tx;
}

export interface LiquidatableLoanInfo {
  loanPubkey: PublicKey;
  borrower: PublicKey;
  collateralMint: PublicKey;
  collateralAmount: bigint;
  dueAtUnix: number;
  status: "active" | "repaid" | "liquidated";
}

/**
 * Read a Loan account + its on-chain status. Returns null if the
 * account doesn't exist OR the loan is no longer active.
 *
 * Used by the build-liquidate endpoint to pre-validate that the
 * agent is liquidating an eligible loan — saves them paying for a
 * build of a tx that would revert at submit time.
 */
export async function fetchLiquidatableLoan(
  connection: Connection,
  loanPda: PublicKey,
): Promise<LiquidatableLoanInfo | null> {
  const provider = makeDummyProvider(connection, LENDER_PUBKEY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idlV1 as any, provider);
  let acct;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acct = await (program.account as any).loan.fetch(loanPda) as any;
  } catch {
    return null;
  }
  // Anchor enums show up as { active: {} } / { repaid: {} } / { liquidated: {} }
  let status: "active" | "repaid" | "liquidated";
  if (acct.status?.active !== undefined) status = "active";
  else if (acct.status?.repaid !== undefined) status = "repaid";
  else if (acct.status?.liquidated !== undefined) status = "liquidated";
  else return null;
  if (status !== "active") return null;
  return {
    loanPubkey: loanPda,
    borrower: acct.borrower as PublicKey,
    collateralMint: acct.collateral_mint as PublicKey,
    collateralAmount: BigInt(acct.collateral_amount.toString()),
    dueAtUnix: Number(acct.due_at.toString()),
    status,
  };
}

/**
 * Build an unsigned liquidate-loan transaction. Permissionless on-
 * chain — any wallet can sign + submit + receive the keeper bounty
 * portion of the seized collateral.
 *
 * Server-side responsibilities:
 *   - Detect whether the collateral mint is on SPL Token or
 *     Token-2022 program (the on-chain ix takes whichever it is).
 *   - Derive the keeper's ATA and prepend createIdempotent so first-
 *     time liquidators don't need to create it themselves.
 *   - Derive the lender authority's ATA + prepend createIdempotent
 *     (almost always exists; guard is cheap).
 *   - Derive the collateral_vault PDA from the loan PDA.
 *
 * The program splits seized collateral between keeper and authority
 * by keeper_reward_bps. The keeper account receives the bounty; the
 * authority account receives the remainder for pool recovery
 * (operator swaps off-chain).
 */
export async function buildLiquidateTransaction(
  connection: Connection,
  keeper: PublicKey,
  loanPubkey: PublicKey,
  collateralMint: PublicKey,
): Promise<Transaction> {
  const [pool] = poolPda(LENDER_PUBKEY);
  const [collateralVault] = collateralVaultPda(loanPubkey);

  const mintInfo = await connection.getAccountInfo(collateralMint, "confirmed");
  if (!mintInfo) {
    throw new Error(`Collateral mint ${collateralMint.toBase58()} not found on chain`);
  }
  const tokenProgram =
    mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

  const keeperAta = getAssociatedTokenAddressSync(
    collateralMint, keeper, false, tokenProgram,
  );
  const authorityAta = getAssociatedTokenAddressSync(
    collateralMint, LENDER_PUBKEY, false, tokenProgram,
  );

  const provider = makeDummyProvider(connection, keeper);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idlV1 as any, provider);

  // Priority fee + idempotent ATAs. Keeper pays the rent on their own
  // ATA (~0.002 SOL one-time), recouped via the bounty.
  const preIxs = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      keeper, keeperAta, keeper, collateralMint, tokenProgram,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      keeper, authorityAta, LENDER_PUBKEY, collateralMint, tokenProgram,
    ),
  ];

  const tx = await program.methods
    .liquidateLoan()
    .accounts({
      pool,
      loan: loanPubkey,
      collateralMint,
      collateralVault,
      keeperCollateralAccount: keeperAta,
      authorityCollateralAccount: authorityAta,
      keeper,
      tokenProgram,
    })
    .preInstructions(preIxs)
    .transaction();

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = keeper;

  return tx;
}
