/**
 * GET /api/v1/eligible-collateral?wallet=<address>
 *
 * Returns the wallet's eligible collateral — the intersection of:
 *   • Tokens the wallet currently holds (from the bot's Helius-backed
 *     /api/v1/wallet/balance endpoint)
 *   • Tokens approved as collateral (supported_mints WHERE enabled=TRUE)
 *
 * Server-side intersection eliminates client-side race conditions and
 * type-mismatch failure modes. Dashboard just renders the array.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";

interface BotToken {
  mint: string;
  raw_amount: string;
  decimals: number;
  amount: number;
  symbol?: string;
  name?: string;
  image?: string | null;
  category?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Missing ?wallet=<solana_address>" },
      { status: 400 },
    );
  }

  if (!BOT_API_URL) {
    return NextResponse.json(
      { ok: false, error: "BOT_API_URL not configured" },
      { status: 500 },
    );
  }

  // Fan out the two reads in parallel.
  const [balanceRes, approvedRes] = await Promise.allSettled([
    fetch(`${BOT_API_URL}/api/v1/wallet/balance?wallet=${wallet}`, {
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json()),
    query(
      `SELECT mint, symbol, name, decimals, category, image_url
         FROM supported_mints
        WHERE enabled = TRUE`,
    ),
  ]);

  const balance = balanceRes.status === "fulfilled" ? balanceRes.value : null;
  const approved = approvedRes.status === "fulfilled" ? approvedRes.value.rows : [];
  const heldTokens: BotToken[] = (balance?.tokens ?? []) as BotToken[];

  // Build mint → approved metadata map, then intersect with holdings.
  const approvedByMint = new Map(
    approved.map((row: { mint: string; symbol: string; name: string; decimals: number; category: string | null; image_url: string | null }) => [row.mint, row]),
  );

  const eligible = heldTokens
    .filter((t) => approvedByMint.has(t.mint))
    .map((t) => {
      const meta = approvedByMint.get(t.mint)! as { mint: string; symbol: string; name: string; decimals: number; category: string | null; image_url: string | null };
      return {
        mint: t.mint,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        image: meta.image_url || null,
        category: meta.category || "memecoin",
        raw_amount: t.raw_amount,
        amount: t.amount,
      };
    })
    .sort((a, b) => (b.amount || 0) - (a.amount || 0));

  return NextResponse.json(
    {
      ok: true,
      wallet,
      sol: balance?.sol ?? null,
      held_count: heldTokens.length,
      approved_count: approved.length,
      eligible_count: eligible.length,
      eligible,
    },
    { headers: HEADERS },
  );
}
