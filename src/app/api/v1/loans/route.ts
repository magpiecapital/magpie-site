/**
 * GET /api/v1/loans?wallet=<address>
 *
 * Returns the active loans and recent history for a Magpie-managed wallet.
 * Strategy mirrors /api/v1/tokens:
 *   1. Direct DB query (preferred — same Railway Postgres the bot uses)
 *   2. Bot API on Railway (fallback if DB unreachable)
 *   3. Empty zero-state response (unknown wallet or total outage)
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey("4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh");
const PROGRAM_ID_V2 = new PublicKey("7tapneCmNwRVEtdeZks4649Q2rf8W1t9tshMN9yHX99P");

/** Derive the loan PDA from borrower + loan_id (+ program). Matches
 *  the bot's seed scheme: ["loan", borrower, loan_id_le_u64]. */
function deriveLoanPda(borrower: PublicKey, loanId: string, programId: PublicKey): PublicKey {
  const idBuf = Buffer.alloc(8);
  new BN(loanId).toArrayLike(Buffer, "le", 8).copy(idBuf);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), borrower.toBuffer(), idBuf],
    programId,
  );
  return pda;
}

/** Keep only loans whose on-chain PDA matches what `wallet` would
 *  derive — i.e., loans actually borrowed by THIS wallet. Defensive:
 *  loans we can't verify pass through (don't drop). */
function filterLoansForWallet<T extends { loan_id: string | number | null; loan_pda: string; program_id?: string | null }>(rows: T[], walletStr: string): T[] {
  if (!rows.length) return rows;
  let walletPk: PublicKey;
  try { walletPk = new PublicKey(walletStr); }
  catch { return rows; }
  return rows.filter((r) => {
    try {
      if (!r.loan_id || !r.loan_pda) return true;
      let progId: PublicKey;
      try { progId = r.program_id ? new PublicKey(r.program_id) : PROGRAM_ID; }
      catch { progId = PROGRAM_ID; }
      const derived = deriveLoanPda(walletPk, String(r.loan_id), progId);
      return derived.toBase58() === r.loan_pda;
    } catch {
      return true; // unverifiable → don't drop
    }
  });
}

// Active-loan freshness is load-bearing for the dashboard: when a user just
// borrowed (or just repaid), seeing the state mirror chain within seconds is
// the difference between trust and "did my funds vanish?". Tight s-maxage so
// the edge cache can never hide a fresh borrow for more than ~3s. Combined
// with the client's `?_t=` cache-buster + visibilitychange re-fetch, worst-
// case latency from borrow-landed → dashboard-shows is one poll interval.
const HEADERS = {
  "Cache-Control": "public, s-maxage=3, stale-while-revalidate=5",
  "X-Powered-By": "Magpie Protocol",
};

const BOT_API_URL = process.env.BOT_API_URL ?? "";
const SOL_MINT = "So11111111111111111111111111111111111111112";
// Loans get auto-liquidated when collateral value drops to 1.10x the
// owed amount (10% buffer). Mirrored from the bot's risk engine.
const LIQUIDATION_THRESHOLD = 1.10;

/**
 * Batch-fetch token prices in SOL via DexScreener. Returns a map of
 * mint → priceSol. Best-effort: missing mints just don't appear in
 * the map, and callers should skip health computation for those loans.
 */
async function fetchPricesInSol(mints: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (mints.length === 0) return result;
  const unique = Array.from(new Set([SOL_MINT, ...mints]));
  try {
    // DexScreener supports comma-separated up to 30 mints per request.
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
    const responses = await Promise.all(
      chunks.map((c) =>
        fetch(`https://api.dexscreener.com/tokens/v1/solana/${c.join(",")}`, {
          signal: AbortSignal.timeout(5_000),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ),
    );
    // Combine + pick best (highest-liquidity) pair per mint.
    const bestByMint = new Map<string, { priceUsd: number; liquidityUsd: number }>();
    for (const data of responses) {
      const pairs = Array.isArray(data) ? data : (data?.pairs ?? []);
      for (const p of pairs) {
        const mint = p.baseToken?.address;
        if (!mint) continue;
        const priceUsd = parseFloat(p.priceUsd);
        const liquidityUsd = p.liquidity?.usd || 0;
        if (!isFinite(priceUsd) || priceUsd <= 0) continue;
        const existing = bestByMint.get(mint);
        if (!existing || liquidityUsd > existing.liquidityUsd) {
          bestByMint.set(mint, { priceUsd, liquidityUsd });
        }
      }
    }
    const solPriceUsd = bestByMint.get(SOL_MINT)?.priceUsd;
    if (!solPriceUsd || solPriceUsd <= 0) return result; // can't price without SOL
    for (const [mint, { priceUsd }] of bestByMint) {
      if (mint === SOL_MINT) continue;
      result.set(mint, priceUsd / solPriceUsd);
    }
  } catch {
    // Network/timeout — return whatever we have, callers degrade gracefully.
  }
  return result;
}

interface LoanRow {
  loan_id: string | number | null;
  loan_pda: string;
  program_id: string | null;
  collateral_mint: string;
  collateral_amount: string | number;
  // V4 mixed-collateral columns (migration 066). Default-backfilled for
  // V1/V2/V3 to current_collateral_amount = collateral_amount,
  // sol_proceeds_amount = 0, auto_sells_fired = 0.
  current_collateral_amount: string | number | null;
  sol_proceeds_amount: string | number | null;
  auto_sells_fired: number | null;
  loan_amount_lamports: string | number;
  original_loan_amount_lamports: string | number;
  ltv_percentage: number;
  duration_days: number;
  start_timestamp: Date;
  due_timestamp: Date;
  status: string;
  tx_signature: string | null;
  updated_at: Date;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  image_url: string | null;
  category: string | null;
}

function shape(l: LoanRow, priceSol: number | null) {
  // Compute live health for active loans where we have a price.
  // Health = collateral_value_in_lamports / owed_lamports.
  // Liquidation price = owed_amount × LIQUIDATION_THRESHOLD / collateral_amount.
  let healthRatio: number | null = null;
  let collateralValueLamports: string | null = null;
  let liquidationPriceSol: number | null = null;
  if (
    l.status === "active" &&
    priceSol != null &&
    priceSol > 0 &&
    l.decimals != null &&
    l.collateral_amount &&
    l.original_loan_amount_lamports
  ) {
    try {
      // V4 mixed-collateral handling: use REMAINING SPL for the price-
      // priced value, then add already-realized SOL proceeds 1:1. For
      // V1/V2/V3 (and V4 pre-fire) both reduce to the original
      // expression: current === amount, sol_proceeds === 0.
      const isMixed = Number(l.auto_sells_fired ?? 0) > 0;
      const splAmountRaw = isMixed
        ? (l.current_collateral_amount ?? l.collateral_amount)
        : l.collateral_amount;
      const vaultLamports = Number(l.sol_proceeds_amount ?? 0);
      const splTokens = Number(splAmountRaw) / Math.pow(10, l.decimals);
      const splValueSol = splTokens * priceSol;
      const splValueLamports = Math.floor(splValueSol * 1e9);
      const valueLamports = splValueLamports + vaultLamports;
      const owedLamports = Number(l.original_loan_amount_lamports);
      if (owedLamports > 0 && isFinite(valueLamports)) {
        collateralValueLamports = valueLamports.toString();
        healthRatio = valueLamports / owedLamports;
        // Liquidation price = price at which TOTAL collateral value hits
        // LIQUIDATION_THRESHOLD × owed. The vault SOL is fixed; only the
        // SPL side moves with the price. So:
        //   splValueAtLiq + vaultLamports = THRESHOLD × owedLamports
        //   splValueAtLiq = THRESHOLD × owedLamports - vaultLamports
        //   price_per_token = (splValueAtLiq / 1e9) / splTokens
        // If vault already covers the threshold (rare but possible after
        // many auto-sells), liquidation_price collapses to 0.
        const targetSplValueLamports = LIQUIDATION_THRESHOLD * owedLamports - vaultLamports;
        liquidationPriceSol = targetSplValueLamports > 0 && splTokens > 0
          ? (targetSplValueLamports / 1e9) / splTokens
          : 0;
      }
    } catch {
      // Fall through with nulls — UI shows "—" instead of crashing.
    }
  }
  return {
    loan_id: l.loan_id?.toString?.() ?? null,
    loan_pda: l.loan_pda,
    program_id: l.program_id ?? null,
    status: l.status,
    collateral: {
      mint: l.collateral_mint,
      symbol: l.symbol,
      name: l.name,
      decimals: l.decimals,
      image: l.image_url || null,
      category: l.category || "memecoin",
      amount: l.collateral_amount?.toString?.() ?? null,
      // V4 mixed-collateral fields. For V1/V2/V3 / pre-fire V4 these
      // mirror the original amounts so the dashboard's mixed-display
      // branch (gated on auto_sells_fired > 0) never trips.
      current_amount: (l.current_collateral_amount ?? l.collateral_amount)?.toString?.() ?? null,
      sol_proceeds_lamports: (l.sol_proceeds_amount ?? 0)?.toString?.() ?? "0",
      auto_sells_fired: Number(l.auto_sells_fired ?? 0),
    },
    loan: {
      amount_lamports: l.loan_amount_lamports?.toString?.() ?? null,
      original_amount_lamports: l.original_loan_amount_lamports?.toString?.() ?? null,
      ltv_percentage: l.ltv_percentage,
      duration_days: l.duration_days,
    },
    timestamps: {
      started_at: l.start_timestamp,
      due_at: l.due_timestamp,
      updated_at: l.updated_at,
    },
    // Live health snapshot — null for non-active loans or when price is unavailable.
    // Frontend should treat null as "data unavailable" and render "—".
    health: healthRatio == null ? null : {
      ratio: healthRatio,
      collateral_value_lamports: collateralValueLamports,
      liquidation_price_sol: liquidationPriceSol,
      liquidation_threshold: LIQUIDATION_THRESHOLD,
      current_price_sol: priceSol,
    },
    tx_signature: l.tx_signature,
  };
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

  /* Strategy 1: direct DB query */
  try {
    const { rows } = await query(
      `SELECT l.loan_id, l.loan_pda, l.program_id, l.collateral_mint, l.collateral_amount,
              l.current_collateral_amount, l.sol_proceeds_amount, l.auto_sells_fired,
              l.loan_amount_lamports, l.original_loan_amount_lamports,
              l.ltv_percentage, l.duration_days,
              l.start_timestamp, l.due_timestamp,
              l.status, l.tx_signature, l.updated_at,
              sm.symbol, sm.name, sm.decimals, sm.image_url, sm.category
         FROM loans l
         JOIN wallets w ON w.user_id = l.user_id
         LEFT JOIN supported_mints sm ON sm.mint = l.collateral_mint
        WHERE w.public_key = $1
        ORDER BY l.start_timestamp DESC
        LIMIT 100`,
      [wallet],
    );

    // CRITICAL: scope to ONLY this wallet's loans. The JOIN above
    // matches on user_id, which means a multi-wallet user gets every
    // loan across every linked wallet. Filter down to those whose
    // borrower-derived PDA matches the requesting wallet. Credit /
    // points / holder rewards remain user-scoped (intentional);
    // loans + collateral are per-wallet.
    const scopedRows = filterLoansForWallet(rows as LoanRow[], wallet);

    // Count active loans on OTHER linked wallets so the dashboard can
    // surface a "1 loan on another wallet — switch to manage it" hint
    // without users wondering why their "Active Loans" count looks
    // wrong. Computed BEFORE we drop the history rows.
    const allActiveRows = (rows as LoanRow[]).filter((r) => r.status === "active");
    const scopedActiveRows = scopedRows.filter((r: LoanRow) => r.status === "active");
    const otherWalletsActiveCount = Math.max(
      0,
      allActiveRows.length - scopedActiveRows.length,
    );

    // Batch-fetch prices for every unique collateral mint across the
    // user's active loans so the response carries a live health snapshot.
    // Best-effort: if pricing fails, we still return the loans (no health
    // data — UI degrades to "—" cleanly).
    const activeRows = scopedActiveRows;
    const historyRows = scopedRows.filter((r: LoanRow) => r.status !== "active");
    const activeMints = Array.from(new Set(activeRows.map((r: LoanRow) => r.collateral_mint)));
    const priceMap = await fetchPricesInSol(activeMints);

    return NextResponse.json(
      {
        ok: true,
        wallet,
        active: activeRows.map((r: LoanRow) => shape(r, priceMap.get(r.collateral_mint) ?? null)),
        history: historyRows.map((r: LoanRow) => shape(r, null)),
        other_wallets_active_count: otherWalletsActiveCount,
        source: "database",
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("[api/loans] DB error:", (err as Error).message);
  }

  /* Strategy 2: bot API */
  if (BOT_API_URL) {
    try {
      const res = await fetch(`${BOT_API_URL}/api/v1/loans?wallet=${wallet}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(
          { ok: true, ...data, source: "bot_api" },
          { headers: HEADERS },
        );
      }
    } catch (err) {
      console.error("[api/loans] Bot API error:", (err as Error).message);
    }
  }

  /* Strategy 3: empty zero state */
  return NextResponse.json(
    { ok: true, wallet, active: [], history: [], source: "fallback_empty" },
    { headers: HEADERS },
  );
}
