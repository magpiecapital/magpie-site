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
import {
  buildWithdrawTransaction,
  computeMaxSafeWithdrawShares,
  fetchDepositorPosition,
} from "@/lib/solana/pool";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

export async function POST(req: Request) {
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

  // Look up the current position so we can refuse impossible withdrawals
  // up-front (better error than the on-chain program would emit), AND
  // compute max_safe_shares for the chunking guidance.
  const position = await fetchDepositorPosition(connection, depositorPk).catch(() => null);
  if (!position) {
    return NextResponse.json(
      {
        error: "no_position",
        detail:
          "This wallet has no LP position. Call /api/v1/lp/build-deposit first.",
      },
      { status: 400 },
    );
  }
  if (requestedShares > BigInt(position.shares)) {
    return NextResponse.json(
      {
        error: "insufficient_shares",
        owned_shares: position.shares.toString(),
        requested_shares: sharesStr,
      },
      { status: 400 },
    );
  }
  const maxSafe = computeMaxSafeWithdrawShares(position.depositedAmount);
  if (requestedShares > maxSafe) {
    return NextResponse.json(
      {
        error: "shares_exceed_safe_chunk",
        max_safe_shares: maxSafe.toString(),
        owned_shares: position.shares.toString(),
        detail:
          "The current v1 program has a u64 overflow at large withdrawals. Cap a single withdraw at max_safe_shares; repeat the call for the remainder.",
      },
      { status: 400 },
    );
  }

  let tx;
  try {
    tx = await buildWithdrawTransaction(connection, depositorPk, Number(requestedShares));
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
      shares: sharesStr,
      max_safe_shares: maxSafe.toString(),
      projected_lamports: projectedLamports.toString(),
      projected_sol: Number(projectedLamports) / 1e9,
    },
    next_step: {
      action: "sign the returned tx with the depositor wallet and submit to the cluster",
    },
  });
}
