/**
 * GET /api/v1/lp/position/[wallet]
 *
 * Return the wallet's LP position(s) across EVERY pool version (V1/V2/V3/V4)
 * — shares, deposited amount, current value at each pool's live
 * shares/deposits ratio, yield, and share-of-pool. `positions[]` is
 * ordered flagship-first (V4), and the top-level fields mirror the primary
 * position for back-compat. This is how a wallet sees its money wherever it
 * lives, so no V1/V2/V3 LP is stranded when new deposits move to V4.
 *
 * Free, public, no auth — same risk envelope as /api/v1/pool (the
 * underlying accounts are readable from any RPC).
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  fetchAllDepositorPositions,
  fetchPoolStats,
  DEPOSIT_VERSION,
} from "@/lib/solana/pool";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

const CACHE = { "Cache-Control": "public, max-age=10, s-maxage=10" };

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

  const positions = await fetchAllDepositorPositions(connection, walletPk).catch(() => []);

  if (positions.length === 0) {
    const pool = await fetchPoolStats(connection, DEPOSIT_VERSION).catch(() => null);
    return NextResponse.json(
      {
        wallet,
        has_position: false,
        deposit_version: DEPOSIT_VERSION,
        positions: [],
        pool: pool
          ? {
              version: DEPOSIT_VERSION,
              total_deposits: pool.totalDeposits,
              total_shares: pool.totalShares,
              utilization_rate: pool.utilizationRate,
            }
          : null,
      },
      { status: 200, headers: CACHE },
    );
  }

  // Fetch each held pool's stats once, for accurate share-of-pool.
  const detailed = await Promise.all(
    positions.map(async (p) => {
      const pool = await fetchPoolStats(connection, p.version).catch(() => null);
      const sharePct =
        pool && pool.totalShares > 0 ? p.info.shares / pool.totalShares : 0;
      return {
        version: p.version,
        // V3/V4 withdraw in a single tx (u128); V1/V2 may chunk (u64 overflow).
        single_tx_withdraw: !(p.version === "v1" || p.version === "v2"),
        shares: p.info.shares.toString(),
        deposited_lamports: p.info.depositedAmount.toString(),
        current_value_lamports: p.info.currentValue.toString(),
        yield_lamports: p.info.yieldEarned.toString(),
        yield_pct:
          p.info.depositedAmount > 0 ? p.info.yieldEarned / p.info.depositedAmount : 0,
        share_of_pool_pct: sharePct,
        pool: pool
          ? {
              total_deposits: pool.totalDeposits,
              total_shares: pool.totalShares,
              utilization_rate: pool.utilizationRate,
            }
          : null,
      };
    }),
  );

  const primary = detailed[0]; // flagship-first ordering

  return NextResponse.json(
    {
      wallet,
      has_position: true,
      deposit_version: DEPOSIT_VERSION,
      positions: detailed,
      // Back-compat: top-level mirrors the primary (flagship-first) position.
      ...primary,
    },
    { status: 200, headers: CACHE },
  );
}
