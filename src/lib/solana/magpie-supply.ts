/**
 * $MAGPIE supply accounting for CoinMarketCap / CoinGecko submissions.
 *
 * Listing reviewers require a machine-readable circulating-supply
 * endpoint to compute market cap. This module centralizes the supply
 * math so /api/v1/supply, /api/v1/supply/circulating, and the public
 * token page all report the same numbers.
 *
 * Conservative definition of "circulating":
 *   circulating = total_supply
 *                 - tokens held at the pump.fun bonding-curve address
 *                 - tokens at the burn / System address
 *
 * Token-2022 mint (extensions enabled) — all calls go through
 * TOKEN_2022_PROGRAM_ID, not legacy SPL Token.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export const MAGPIE_MINT_STR = "9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump";
export const MAGPIE_MINT = new PublicKey(MAGPIE_MINT_STR);
export const MAGPIE_DECIMALS = 6;

/**
 * Wallets whose holdings are excluded from circulating supply.
 * Kept in sync with the bot's EXCLUDED_WALLETS for the holder-rewards
 * snapshot, minus the lender wallet (lender holdings ARE operational
 * and tradeable — they're not treasury).
 */
const NON_CIRCULATING_WALLETS = [
  // Burn / System
  "11111111111111111111111111111111",
  // Pump.fun bonding-curve mint authority — would hold pre-graduation
  // supply that's reserved by the curve mechanism. Usually 0 post-grad.
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
];

function getRpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

export interface SupplyBreakdown {
  /** Raw u64 totals (string to preserve precision in JSON). */
  total_supply_raw: string;
  circulating_supply_raw: string;
  non_circulating_raw: string;
  /** UI amounts (total_supply_raw / 10^decimals), JS number. */
  total_supply: number;
  circulating_supply: number;
  non_circulating: number;
  decimals: number;
  /** Per-wallet contribution to non-circulating, for transparency. */
  non_circulating_components: Array<{
    wallet: string;
    label: string;
    balance_raw: string;
    balance: number;
  }>;
  fetched_at: string;
}

export async function getMagpieSupplyBreakdown(): Promise<SupplyBreakdown> {
  const connection = new Connection(getRpcUrl(), "confirmed");
  const supplyResp = await connection.getTokenSupply(MAGPIE_MINT);
  const totalRaw = BigInt(supplyResp.value.amount);

  // Fetch balance for each non-circulating wallet in parallel. Wallets
  // with no $MAGPIE ATA contribute 0; we don't fail the request on a
  // missing ATA.
  const labelByAddr: Record<string, string> = {
    "11111111111111111111111111111111": "Burn / System",
    "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM": "pump.fun bonding curve",
  };

  const components: SupplyBreakdown["non_circulating_components"] = [];
  let nonCircRaw = 0n;
  await Promise.all(
    NON_CIRCULATING_WALLETS.map(async (addr) => {
      try {
        const accounts = await connection.getTokenAccountsByOwner(
          new PublicKey(addr),
          { mint: MAGPIE_MINT, programId: TOKEN_2022_PROGRAM_ID },
          { commitment: "confirmed" },
        );
        let bal = 0n;
        for (const a of accounts.value) {
          const data = a.account.data;
          if (data.length < 72) continue;
          bal += data.readBigUInt64LE(64);
        }
        components.push({
          wallet: addr,
          label: labelByAddr[addr] ?? addr,
          balance_raw: bal.toString(),
          balance: Number(bal) / Math.pow(10, MAGPIE_DECIMALS),
        });
        nonCircRaw += bal;
      } catch {
        components.push({
          wallet: addr,
          label: labelByAddr[addr] ?? addr,
          balance_raw: "0",
          balance: 0,
        });
      }
    }),
  );

  const circRaw = totalRaw > nonCircRaw ? totalRaw - nonCircRaw : 0n;
  const denom = Math.pow(10, MAGPIE_DECIMALS);
  return {
    total_supply_raw: totalRaw.toString(),
    circulating_supply_raw: circRaw.toString(),
    non_circulating_raw: nonCircRaw.toString(),
    total_supply: Number(totalRaw) / denom,
    circulating_supply: Number(circRaw) / denom,
    non_circulating: Number(nonCircRaw) / denom,
    decimals: MAGPIE_DECIMALS,
    non_circulating_components: components,
    fetched_at: new Date().toISOString(),
  };
}
