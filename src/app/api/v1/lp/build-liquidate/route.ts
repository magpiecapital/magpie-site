/**
 * POST /api/v1/lp/build-liquidate
 *
 * Build an unsigned liquidate-loan transaction. Permissionless on
 * the Anchor side — any wallet can sign + submit. The keeper (the
 * agent's wallet) receives the keeper-bounty portion of the seized
 * collateral; the rest goes to the lender authority for pool
 * recovery (operator swaps off-chain).
 *
 * Body:
 *   { keeper: <pubkey>, loan_pda: <pubkey> }
 *
 * Server-side guards before building:
 *   - Loan exists at loan_pda
 *   - Loan status is "active" (not already repaid/liquidated)
 *   - Loan is past its due_at (the program will reject otherwise,
 *     but rejecting here saves the agent paying for a doomed build)
 *
 * Response:
 *   200 { partial_signed_tx_b64, summary, keeper_reward_info }
 *   400 { error, detail? }
 *   404 { error: "loan_not_active" | "loan_not_found" }
 *   503 { error: "rpc_unavailable" }
 *
 * Safety:
 *   - Keeper is the only signer; server never touches a keypair.
 *   - The server's "is past due" check is advisory — even if a
 *     clock-drift edge case lets a not-actually-due-yet build slip
 *     through, the on-chain program is the source of truth and
 *     will reject. Agent pays the network fee but not the loan.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  buildLiquidateTransaction,
  fetchLiquidatableLoan,
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
  const keeperStr = String(b.keeper ?? "");
  const loanPdaStr = String(b.loan_pda ?? "");

  if (!keeperStr || !loanPdaStr) {
    return NextResponse.json(
      { error: "missing_params", required: ["keeper", "loan_pda"] },
      { status: 400 },
    );
  }

  let keeper: PublicKey, loanPubkey: PublicKey;
  try {
    keeper = new PublicKey(keeperStr);
  } catch {
    return NextResponse.json({ error: "invalid_keeper_pubkey" }, { status: 400 });
  }
  try {
    loanPubkey = new PublicKey(loanPdaStr);
  } catch {
    return NextResponse.json({ error: "invalid_loan_pda" }, { status: 400 });
  }

  const loan = await fetchLiquidatableLoan(connection, loanPubkey).catch(
    () => null,
  );
  if (!loan) {
    return NextResponse.json(
      {
        error: "loan_not_active",
        detail:
          "Loan not found, already repaid, or already liquidated. " +
          "Use GET /api/v1/markets/liquidatable to discover currently-eligible loans.",
      },
      { status: 404 },
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (loan.dueAtUnix > nowSec) {
    return NextResponse.json(
      {
        error: "loan_not_yet_due",
        detail: `Loan due at ${new Date(loan.dueAtUnix * 1000).toISOString()} — ${loan.dueAtUnix - nowSec}s in the future`,
        loan_due_at_unix: loan.dueAtUnix,
        seconds_until_due: loan.dueAtUnix - nowSec,
      },
      { status: 400 },
    );
  }

  let tx;
  try {
    tx = await buildLiquidateTransaction(
      connection,
      keeper,
      loanPubkey,
      loan.collateralMint,
    );
  } catch (err) {
    return NextResponse.json(
      { error: "tx_build_failed", detail: (err as Error).message?.slice(0, 300) },
      { status: 503 },
    );
  }

  const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

  return NextResponse.json({
    partial_signed_tx_b64: serialized,
    summary: {
      keeper: keeperStr,
      loan_pda: loanPubkey.toBase58(),
      borrower: loan.borrower.toBase58(),
      collateral_mint: loan.collateralMint.toBase58(),
      collateral_amount_raw: loan.collateralAmount.toString(),
      seconds_past_due: nowSec - loan.dueAtUnix,
    },
    keeper_reward_info: {
      note:
        "Keeper receives keeper_reward_bps share of the seized collateral. " +
        "Read keeper_reward_bps from GET /api/v1/pool. Rest goes to the lender authority for pool recovery.",
    },
    next_step: {
      action: "sign the returned tx with the keeper wallet, then submit to the cluster",
      submit: "Direct sendRawTransaction is fine — liquidate_loan is permissionless and idempotent at the program level (a second attempt on an already-liquidated loan reverts cleanly).",
    },
  });
}
