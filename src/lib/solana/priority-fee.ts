/**
 * Client-side dynamic Solana priority fee.
 *
 * WHY (2026-07-15): every loan transaction the site builds used a hardcoded
 * `setComputeUnitPrice({ microLamports: 100_000 })`. During a mainnet
 * congestion spike, under-priced transactions get dropped and expire, so a
 * borrow sits on "signing" forever (the bot-side attestor fix landed in
 * magpie-bot #596/#597; this is the matching site-side change so the user's
 * own transaction is priced to land too).
 *
 * The fee tracks real demand instead of a flat guess:
 *   - primary: Helius `getPriorityFeeEstimate` against the connection's own RPC
 *   - fallback: native `getRecentPrioritizationFees` (works on any RPC)
 *   - last resort: the floor
 * Result is scaled for headroom and clamped to [floor, cap]. In calm markets
 * the estimate is usually BELOW the old flat 100k, so the user pays LESS; it
 * only rises (up to the cap) when the network actually demands it. These are
 * user-paid transactions — the fee comes out of the borrower's wallet, not the
 * protocol's.
 *
 * Tunable at build time via NEXT_PUBLIC_* env (all optional).
 */
import {
  ComputeBudgetProgram,
  PublicKey,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";

const numEnv = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const FLOOR = numEnv(process.env.NEXT_PUBLIC_MIN_PRIORITY_FEE_MICROLAMPORTS, 25_000);
const CAP = numEnv(process.env.NEXT_PUBLIC_MAX_PRIORITY_FEE_MICROLAMPORTS, 1_000_000);
const MULTIPLIER = numEnv(process.env.NEXT_PUBLIC_PRIORITY_FEE_MULTIPLIER, 1.5);
const CACHE_TTL_MS = 8_000;

// Cache the RAW network estimate so rapid successive builds share one lookup.
let _cache: { raw: number; source: string; at: number } | null = null;

async function heliusEstimate(endpoint: string, accountKeys: string[]): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [{ options: { recommended: true } }];
  if (accountKeys.length) params[0].accountKeys = accountKeys;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getPriorityFeeEstimate", params }),
  });
  const j = await res.json();
  const est = j?.result?.priorityFeeEstimate;
  if (typeof est !== "number" || !Number.isFinite(est)) throw new Error("no Helius estimate");
  return est;
}

async function nativeEstimate(connection: Connection, accountKeys: string[]): Promise<number> {
  const keys = accountKeys.slice(0, 128).map((k) => new PublicKey(k));
  const recent = await connection.getRecentPrioritizationFees(
    keys.length ? { lockedWritableAccounts: keys } : {},
  );
  const fees = (recent || [])
    .map((r) => Number(r.prioritizationFee) || 0)
    .filter((f) => f > 0)
    .sort((a, b) => a - b);
  if (!fees.length) throw new Error("no native fee samples");
  return fees[Math.min(fees.length - 1, Math.floor(fees.length * 0.75))];
}

/**
 * Current recommended priority fee (microLamports per compute unit), scaled for
 * headroom and clamped to [FLOOR, CAP]. Cached briefly.
 */
export async function getDynamicPriorityFee(
  connection: Connection,
  opts: { accountKeys?: string[]; label?: string } = {},
): Promise<number> {
  const { accountKeys = [], label = "tx" } = opts;
  const now = Date.now();

  let raw = _cache?.raw ?? FLOOR;
  let source = _cache?.source ?? "floor";
  if (!_cache || now - _cache.at >= CACHE_TTL_MS) {
    try {
      raw = await heliusEstimate(connection.rpcEndpoint, accountKeys);
      source = "helius";
    } catch {
      try {
        raw = await nativeEstimate(connection, accountKeys);
        source = "native";
      } catch {
        raw = FLOOR;
        source = "floor";
      }
    }
    _cache = { raw, source, at: now };
  }

  const fee = Math.max(FLOOR, Math.min(CAP, Math.ceil(raw * MULTIPLIER)));
  if (typeof console !== "undefined") {
    console.debug(
      `[priority-fee] ${label}: ${fee} µL/CU (src=${source} raw=${Math.round(raw)} x${MULTIPLIER}, floor=${FLOOR} cap=${CAP})`,
    );
  }
  return fee;
}

/**
 * ComputeBudget instructions (price + limit) for the current dynamic fee.
 * Prepend to any transaction. `cuLimit` should sit comfortably above the tx's
 * real compute usage.
 */
export async function priorityFeeInstructions(
  connection: Connection,
  cuLimit: number,
  opts: { accountKeys?: string[]; label?: string } = {},
): Promise<TransactionInstruction[]> {
  const microLamports = await getDynamicPriorityFee(connection, opts);
  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  ];
  if (cuLimit && Number.isFinite(cuLimit)) {
    ixs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: Math.ceil(cuLimit) }));
  }
  return ixs;
}
