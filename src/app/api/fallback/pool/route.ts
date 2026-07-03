/**
 * GET /api/fallback/pool
 *
 * On-chain read of the LendingPool account via Helius RPC. Runs on
 * Vercel — totally independent of the Railway bot. Pip uses this
 * when the bot is unreachable so it can still answer "what's the
 * current utilization / available liquidity / total borrowed".
 *
 * This is the EXACT same data as the bot's /api/v1/pool/stats but
 * read directly from the chain. The bot has caching, batching, and
 * sophisticated routing; we have direct RPC. The trade-off is fine
 * for fallback — slightly higher latency, slightly more RPC quota,
 * but Pip stays useful when the bot is down.
 */
import { NextResponse } from "next/server";
import { fetchPoolStats, type LpVersion } from "@/lib/solana/pool";
import { makeResilientConnection } from "@/lib/fallback/rpc-with-backup";

// 30s edge cache so repeated calls during a bot outage don't hammer
// the RPC. Vercel re-renders the route per cache window.
export const revalidate = 30;

export async function GET() {
  try {
    const connection = makeResilientConnection();
    // AGGREGATE across every pool that holds liquidity (V1 memecoin, V3 RWA,
    // V4 flagship) so "protocol liquidity / utilization" is the TRUE total —
    // not just one pool. (Before V4 became the deposit flagship this read a
    // single pool; reading only V4 would under-report the V1 whale + legacy
    // liquidity.) Any per-pool RPC miss is skipped, not fatal.
    const versions: LpVersion[] = ["v1", "v3", "v4"];
    const results = await Promise.all(
      versions.map((v) => fetchPoolStats(connection, v).catch(() => null)),
    );
    const pools = results.filter((s): s is NonNullable<typeof s> => s !== null);
    if (pools.length === 0) throw new Error("all pool reads failed");
    const sum = (f: (s: (typeof pools)[number]) => number) =>
      pools.reduce((acc, s) => acc + f(s), 0);
    const totalDeposits = sum((s) => s.totalDeposits);
    const totalBorrowed = sum((s) => s.totalBorrowed);
    const stats = {
      totalDeposits,
      totalBorrowed,
      totalShares: sum((s) => s.totalShares),
      totalFeesEarned: sum((s) => s.totalFeesEarned),
      totalLoansIssued: sum((s) => s.totalLoansIssued),
      totalLiquidations: sum((s) => s.totalLiquidations),
      // Rate params are uniform across pools; take the flagship's (or first).
      protocolFeeBps: (pools.find((s) => s.version === "v4") ?? pools[0]).protocolFeeBps,
      keeperRewardBps: (pools.find((s) => s.version === "v4") ?? pools[0]).keeperRewardBps,
      paused: pools.every((s) => s.paused),
      availableLiquidity: totalDeposits - totalBorrowed,
      utilizationRate: totalDeposits > 0 ? totalBorrowed / totalDeposits : 0,
    };
    return NextResponse.json({
      ok: true,
      source: "on-chain (fallback)",
      pools_aggregated: pools.map((s) => s.version),
      pool: {
        total_deposits_sol: stats.totalDeposits / 1e9,
        total_borrowed_sol: stats.totalBorrowed / 1e9,
        total_shares: stats.totalShares,
        total_fees_earned_sol: stats.totalFeesEarned / 1e9,
        total_loans_issued: stats.totalLoansIssued,
        total_liquidations: stats.totalLiquidations,
        protocol_fee_bps: stats.protocolFeeBps,
        keeper_reward_bps: stats.keeperRewardBps,
        paused: stats.paused,
        available_liquidity_sol: stats.availableLiquidity / 1e9,
        utilization_rate: stats.utilizationRate,
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        source: "on-chain (fallback)",
        error: "rpc_read_failed",
        detail: (err as Error).message?.slice(0, 200),
      },
      { status: 502 },
    );
  }
}
