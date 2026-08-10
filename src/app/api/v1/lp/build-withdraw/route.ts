/**
 * POST /api/v1/lp/build-withdraw
 *
 * Build an unsigned LP-withdraw transaction targeting the main Magpie
 * LendingPool. The caller signs with their own wallet and submits.
 *
 * Body:
 *   { depositor: <pubkey>, shares: "<u64-string>" }
 *
 * Response:
 *   200 { partial_signed_tx_b64, summary }
 *   400 { error, detail? }
 *   503 { error: "rpc_unavailable", detail }
 *
 * Important — the v1 program has an unfixed u64 overflow in `withdraw`
 * that limits a single tx's `shares × deposited_amount` to under
 * u64::MAX. The summary returns max_safe_shares the caller can extract
 * in one tx; for larger positions, withdraw in multiple txs of
 * <= max_safe_shares each.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  buildWithdrawTransaction,
  computeMaxSafeWithdrawShares,
  fetchAllDepositorPositions,
  type LpVersion,
} from "@/lib/solana/pool";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

export async function POST(req: Request) {
  // Audit S2 extended here: ~5 RPC calls per request (sweeps V1-V4 + blockhash). Unauthenticated and previously
  // unthrottled, so a loop billed us. Generous ceiling, fails OPEN.
  { const rl = rateLimit(req, "lp_build_withdraw", 30);
    if (rl.limited) return tooManyRequests(rl.retryAfter); }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const depositorStr = String(b.depositor ?? "");
  const sharesStr = String(b.shares ?? "");
  if (!depositorStr || !sharesStr) {
    return NextResponse.json(
      { error: "missing_params", required: ["depositor", "shares"] },
      { status: 400 },
    );
  }
  if (!/^\d+$/.test(sharesStr)) {
    return NextResponse.json(
      { error: "shares_must_be_u64_string" },
      { status: 400 },
    );
  }

  let depositorPk: PublicKey;
  try {
    depositorPk = new PublicKey(depositorStr);
  } catch {
    return NextResponse.json({ error: "invalid_depositor_pubkey" }, { status: 400 });
  }

  const requestedShares = BigInt(sharesStr);
  if (requestedShares <= 0n) {
    return NextResponse.json({ error: "shares_must_be_positive" }, { status: 400 });
  }

  // Resolve which pool version this wallet actually holds a position in.
  // Sweeps V1/V2/V3/V4 so nobody is stranded when new deposits move to V4.
  // Optional body.version pins a specific pool when a wallet holds more
  // than one. max_safe_shares only caps V1/V2 (u64 overflow); V3/V4 have
  // no cap (u128 → single-tx of any size).
  const requestedVersion =
    typeof b.version === "string" && ["v1", "v2", "v3", "v4"].includes(b.version)
      ? (b.version as LpVersion)
      : null;
  const positions = await fetchAllDepositorPositions(connection, depositorPk).catch(() => []);
  if (positions.length === 0) {
    return NextResponse.json(
      {
        error: "no_position",
        detail:
          "This wallet has no LP position in any pool (V1/V2/V3/V4). Call /api/v1/lp/build-deposit first.",
      },
      { status: 400 },
    );
  }
  const target = requestedVersion
    ? positions.find((p) => p.version === requestedVersion) ?? null
    : positions.length === 1
      ? positions[0]
      : null;
  if (!target) {
    return NextResponse.json(
      {
        error: requestedVersion ? "no_position_in_version" : "multiple_positions",
        positions: positions.map((p) => ({ version: p.version, shares: p.info.shares.toString() })),
        detail: requestedVersion
          ? `No position in ${requestedVersion}. This wallet holds positions in: ${positions.map((p) => p.version).join(", ")}.`
          : `Wallet holds positions in multiple pools (${positions.map((p) => p.version).join(", ")}). Pass "version" to pick one.`,
      },
      { status: 400 },
    );
  }
  const position = target.info;
  const version = target.version;

  if (requestedShares > BigInt(position.shares)) {
    return NextResponse.json(
      {
        error: "insufficient_shares",
        version,
        owned_shares: position.shares.toString(),
        requested_shares: sharesStr,
      },
      { status: 400 },
    );
  }
  const maxSafe = computeMaxSafeWithdrawShares(position.depositedAmount, version);
  if (requestedShares > maxSafe) {
    return NextResponse.json(
      {
        error: "shares_exceed_safe_chunk",
        version,
        max_safe_shares: maxSafe.toString(),
        owned_shares: position.shares.toString(),
        detail:
          "The V1/V2 program has a u64 overflow at large withdrawals. Cap a single withdraw at max_safe_shares; repeat the call for the remainder. (V3/V4 have no cap.)",
      },
      { status: 400 },
    );
  }

  let tx;
  try {
    tx = await buildWithdrawTransaction(connection, depositorPk, Number(requestedShares), version);
  } catch (err) {
    return NextResponse.json(
      {
        error: "tx_build_failed",
        detail: (err as Error).message?.slice(0, 300),
      },
      { status: 503 },
    );
  }

  const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
  const totalShares = BigInt(position.shares);
  const totalDeposits = BigInt(position.depositedAmount);
  const projectedLamports =
    totalShares > 0n ? (requestedShares * totalDeposits) / totalShares : 0n;

  return NextResponse.json({
    partial_signed_tx_b64: serialized,
    summary: {
      depositor: depositorStr,
      version,
      shares: sharesStr,
      max_safe_shares: maxSafe.toString(),
      single_tx: !(version === "v1" || version === "v2"),
      projected_lamports: projectedLamports.toString(),
      projected_sol: Number(projectedLamports) / 1e9,
    },
    next_step: {
      action: "sign the returned tx with the depositor wallet and submit to the cluster",
    },
  });
}
