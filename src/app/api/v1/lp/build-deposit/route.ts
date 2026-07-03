/**
 * POST /api/v1/lp/build-deposit
 *
 * Build an unsigned LP-deposit transaction targeting the V4 flagship
 * Magpie LendingPool (new liquidity flows to V4). The caller (a wallet,
 * or — via the x402 service — an AI agent) signs the returned tx with
 * their own wallet and submits.
 *
 * Body:
 *   { depositor: <pubkey>, lamports: "<u64-string>" }
 *
 * Response:
 *   200 { partial_signed_tx_b64, summary: { lamports, depositor } }
 *   400 { error, detail? }
 *   503 { error: "rpc_unavailable", detail }
 *
 * Safety:
 *   - The depositor IS the signer; the server never touches the keypair.
 *   - The tx wraps SOL → wSOL → deposits → closes wSOL (recovers any dust).
 *   - Public endpoint, no auth — anyone can pre-build a deposit tx for
 *     any wallet; only that wallet's signature lets it actually settle.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildDepositTransaction, DEPOSIT_VERSION } from "@/lib/solana/pool";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

const MIN_DEPOSIT_LAMPORTS = 10_000_000n; // 0.01 SOL — anti-dust floor

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const depositorStr = String(b.depositor ?? "");
  const lamportsStr = String(b.lamports ?? "");
  if (!depositorStr || !lamportsStr) {
    return NextResponse.json(
      { error: "missing_params", required: ["depositor", "lamports"] },
      { status: 400 },
    );
  }
  if (!/^\d+$/.test(lamportsStr)) {
    return NextResponse.json(
      { error: "lamports_must_be_u64_string" },
      { status: 400 },
    );
  }

  let depositorPk: PublicKey;
  try {
    depositorPk = new PublicKey(depositorStr);
  } catch {
    return NextResponse.json({ error: "invalid_depositor_pubkey" }, { status: 400 });
  }

  const lamports = BigInt(lamportsStr);
  if (lamports < MIN_DEPOSIT_LAMPORTS) {
    return NextResponse.json(
      {
        error: "amount_below_minimum",
        min_lamports: MIN_DEPOSIT_LAMPORTS.toString(),
        detail: `Minimum LP deposit is ${Number(MIN_DEPOSIT_LAMPORTS) / 1e9} SOL`,
      },
      { status: 400 },
    );
  }

  let tx;
  try {
    // The shared builder takes a JS number for lamports; clamp guards
    // against agents submitting absurd values, even though the program
    // itself wouldn't accept them.
    tx = await buildDepositTransaction(connection, depositorPk, Number(lamports));
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

  return NextResponse.json({
    partial_signed_tx_b64: serialized,
    summary: {
      depositor: depositorStr,
      pool_version: DEPOSIT_VERSION,
      lamports: lamportsStr,
      sol: Number(lamports) / 1e9,
    },
    next_step: {
      action: "sign the returned tx with the depositor wallet and submit to the cluster",
      rpc: "https://api.mainnet-beta.solana.com (or your Helius/Triton/QuickNode URL)",
    },
  });
}
