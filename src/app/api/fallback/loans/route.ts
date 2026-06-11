/**
 * GET /api/fallback/loans?wallet=<pubkey>
 *
 * Reads a wallet's active loans directly from on-chain via Anchor.
 * No bot dependency — uses Helius RPC + the same IDL the dashboard
 * uses for borrow tx building.
 *
 * Bot's /api/v1/loans returns enriched data (USD valuations, social
 * proof, etc.) that we can't easily reproduce here. The fallback
 * returns the canonical on-chain truth — enough for Pip to answer
 * "what loans do I have right now" / "how much do I owe."
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PROGRAM_ID, PROGRAM_ID_V2 } from "@/lib/solana/constants";
import { makeResilientConnection } from "@/lib/fallback/rpc-with-backup";
import idl from "@/lib/solana/magpie.json";
import idlV2 from "@/lib/solana/magpie-v2.json";

export const revalidate = 15;

function makeProvider(connection: Connection, fakePk: PublicKey) {
  return new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicKey: fakePk, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: "confirmed" },
  );
}

/** Decode a Loan account from on-chain bytes via Anchor. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadProgramLoans(connection: Connection, programId: PublicKey, programIdl: any, borrower: PublicKey) {
  const provider = makeProvider(connection, borrower);
  const program = new Program(programIdl, provider);

  // Anchor's getProgramAccounts with a discriminator-based filter +
  // a borrower-key offset filter. Loan struct layout has the borrower
  // pubkey at offset 8 (right after the 8-byte discriminator).
  // Each Loan = ~245 bytes; getProgramAccounts returns all matching
  // accounts in one RPC call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLoans = await (program.account as any).loan.all([
    { memcmp: { offset: 8, bytes: borrower.toBase58() } },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allLoans.map((a: any) => {
    const loan = a.account;
    return {
      loan_pda: a.publicKey.toBase58(),
      loan_id: loan.loanId.toString(),
      borrower_wallet: loan.borrower.toBase58(),
      collateral_mint: loan.collateralMint.toBase58(),
      collateral_amount: loan.collateralAmount.toString(),
      loan_amount_lamports: loan.loanAmount.toString(),
      repay_amount_lamports: loan.repayAmount.toString(),
      ltv_bps: loan.ltvBps,
      duration_days: Number(loan.durationDays),
      created_at: Number(loan.createdAt) * 1000,
      due_at: Number(loan.dueAt) * 1000,
      status: loan.status?.active != null ? "active"
            : loan.status?.repaid != null ? "repaid"
            : loan.status?.liquidated != null ? "liquidated"
            : "unknown",
      program_id: programId.toBase58(),
    };
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const walletStr = url.searchParams.get("wallet") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletStr)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  let borrower: PublicKey;
  try { borrower = new PublicKey(walletStr); }
  catch { return NextResponse.json({ error: "invalid_wallet" }, { status: 400 }); }

  try {
    const connection = makeResilientConnection();
    // Pull from BOTH program versions and merge — RWA loans live on
    // V2, memecoin loans live on V1. A single wallet can have both.
    const [v1, v2] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadProgramLoans(connection, PROGRAM_ID, idl as any, borrower).catch(() => []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadProgramLoans(connection, PROGRAM_ID_V2, idlV2 as any, borrower).catch(() => []),
    ]);
    const loans = [...v1, ...v2];
    return NextResponse.json({
      ok: true,
      source: "on-chain (fallback)",
      wallet: walletStr,
      count: loans.length,
      loans,
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
