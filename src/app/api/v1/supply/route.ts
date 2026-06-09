/**
 * GET /api/v1/supply
 *
 * Full JSON breakdown of $MAGPIE supply for human auditors. CMC /
 * CoinGecko reviewers reference this during the listing review to
 * understand what's included or excluded from circulating supply.
 *
 * Companion to the plain-text endpoints they actually poll:
 *   /api/v1/supply/circulating
 *   /api/v1/supply/total
 */
import { NextResponse } from "next/server";
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await getMagpieSupplyBreakdown();
    return NextResponse.json(
      {
        ok: true,
        mint: MAGPIE_MINT_STR,
        ...data,
        notes: {
          methodology:
            "Circulating supply = on-chain total supply minus balances at the pump.fun bonding-curve address and the System / burn address. The lender wallet is NOT excluded — its holdings are operational, not treasury.",
          collateralized_treatment:
            "Tokens currently locked as loan collateral in the Magpie program ARE included in circulating supply. Borrowers retain economic ownership and can repay to reclaim.",
          decimals: 6,
          token_program: "Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)",
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}
