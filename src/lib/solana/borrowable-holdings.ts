/**
 * borrowable-holdings.ts
 * ─────────────────────────────────────────────────────────────────────────
 * "What in this wallet can I borrow against on Magpie?"
 *
 * Magpie has no holdings endpoint, so this is the missing helper: it enumerates
 * a wallet's SPL token accounts (BOTH the classic Token program AND Token-2022,
 * since xStocks / RWAs are frequently Token-2022) and intersects them with
 * Magpie's live collateral catalog. The result is exactly the set of tokens the
 * wallet already holds that an x402 brain could borrow against.
 */
import type { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Same-origin proxy (src/app/api/collateral/route.ts) — fetching the x402
// service directly from the browser is blocked by CORS.
const CATALOG_URL = "/api/collateral";

export interface CatalogToken {
  mint: string;
  symbol: string;
  decimals: number;
  category: string; // memecoin | stock | etf | metal | ...
}

export interface BorrowableHolding {
  mint: string;
  symbol: string;
  category: string;
  decimals: number;
  rawAmount: string; // u64 base units, as a string
  uiAmount: number;
  tokenProgram: "spl" | "token-2022";
}

/** Magpie's live "what can I borrow against?" list, keyed by mint. */
export async function fetchCollateralCatalog(): Promise<Map<string, CatalogToken>> {
  const res = await fetch(CATALOG_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Magpie collateral catalog returned ${res.status}`);
  const data = (await res.json()) as { tokens?: CatalogToken[] };
  return new Map((data.tokens ?? []).map((t) => [t.mint, t]));
}

/** Tokens the wallet HOLDS that are also approved Magpie collateral. */
export async function getBorrowableHoldings(
  connection: Connection,
  owner: PublicKey,
): Promise<BorrowableHolding[]> {
  const catalog = await fetchCollateralCatalog();
  const out: BorrowableHolding[] = [];

  const programs: Array<[typeof TOKEN_PROGRAM_ID, "spl" | "token-2022"]> = [
    [TOKEN_PROGRAM_ID, "spl"],
    [TOKEN_2022_PROGRAM_ID, "token-2022"],
  ];

  for (const [programId, tag] of programs) {
    let resp;
    try {
      resp = await connection.getParsedTokenAccountsByOwner(owner, { programId });
    } catch {
      continue; // a program with no accounts can throw on some RPCs — skip
    }
    for (const { account } of resp.value) {
      const info = (account.data as { parsed?: { info?: Record<string, unknown> } }).parsed?.info;
      const mint = info?.mint as string | undefined;
      const amt = info?.tokenAmount as
        | { amount: string; decimals: number; uiAmount: number | null }
        | undefined;
      if (!mint || !amt) continue;
      const cat = catalog.get(mint);
      if (!cat) continue; // not borrowable on Magpie
      if (!amt.amount || amt.amount === "0") continue; // zero balance

      const decimals = cat.decimals ?? amt.decimals;
      out.push({
        mint,
        symbol: cat.symbol,
        category: cat.category,
        decimals,
        rawAmount: amt.amount,
        uiAmount: amt.uiAmount ?? Number(amt.amount) / 10 ** decimals,
        tokenProgram: tag,
      });
    }
  }
  // Biggest positions first.
  return out.sort((a, b) => b.uiAmount - a.uiAmount);
}
