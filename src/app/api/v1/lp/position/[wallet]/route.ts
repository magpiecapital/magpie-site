/**
 * GET /api/v1/lp/position/[wallet]
 *
 * Return the LP position state for a wallet — shares, deposited amount,
 * current value at the pool's live shares/deposits ratio, yield earned.
 * Plus pool context so a caller can compute their share-of-pool.
 *
 * Free, public, no auth — same risk envelope as /api/v1/pool (the
 * underlying account is readable from any RPC).
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchDepositorPosition, fetchPoolStats } from "@/lib/solana/pool";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await ctx.params;
  let walletPk: PublicKey;
  try {
    walletPk = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "invalid_wallet_pubkey" }, { status: 400 });
  }

  const [position, pool] = await Promise.all([
    fetchDepositorPosition(connection, walletPk).catch(() => null),
    fetchPoolStats(connection).catch(() => null),
  ]);

  if (!position) {
    return NextResponse.json(
      {
        wallet,
        has_position: false,
        pool: pool
          ? {
              total_deposits: pool.totalDeposits,
              total_shares: pool.totalShares,
              utilization_rate: pool.utilizationRate,
            }
          : null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
      },
    );
  }

  const sharePct =
    pool && pool.totalShares > 0 ? position.shares / pool.totalShares : 0;

  return NextResponse.json(
    {
      wallet,
      has_position: true,
      shares: position.shares.toString(),
      deposited_lamports: position.depositedAmount.toString(),
      current_value_lamports: position.currentValue.toString(),
      yield_lamports: position.yieldEarned.toString(),
      yield_pct:
        position.depositedAmount > 0
          ? position.yieldEarned / position.depositedAmount
          : 0,
      share_of_pool_pct: sharePct,
      pool: pool
        ? {
            total_deposits: pool.totalDeposits,
            total_shares: pool.totalShares,
            utilization_rate: pool.utilizationRate,
          }
        : null,
    },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
    },
  );
}
