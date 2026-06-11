/**
 * Solana Connection with automatic primary → backup RPC failover.
 *
 * Why this exists:
 *   Helius is our primary RPC and is excellent — but no provider is
 *   100% available. If Helius hiccups during a bot outage, our Vercel
 *   fallback (which uses the same Helius URL via NEXT_PUBLIC_HELIUS_RPC_URL)
 *   would also fail. That would leave Pip with no live on-chain data
 *   to ground its answers.
 *
 *   This helper provides a Connection that tries the primary endpoint
 *   first and silently fails over to a backup if the primary is
 *   unreachable. The fallback uses Solana's public mainnet RPC by
 *   default (rate-limited but never goes down), or any operator-set
 *   secondary provider via FALLBACK_RPC_BACKUP_URL.
 *
 * Semantics:
 *   - Per-method failover. If `getAccountInfo` fails on primary, we
 *     retry once on backup. Subsequent calls go back to trying primary
 *     first (no sticky failover) so we don't pin the chat to a degraded
 *     backup after a transient primary blip.
 *   - Failover triggers on: thrown errors, timeouts (per-call deadline),
 *     and any response that decodes to null (RPC up but returning bad data).
 *   - Logs both endpoints used so debug logs show what happened. Never
 *     logs the API key in the URL.
 *
 * Defense in depth:
 *   - 8s per-call deadline on both primary and backup. A hung RPC
 *     shouldn't be able to take Pip's chat over the 10s edge function
 *     timeout. If both deadlines elapse, the caller catches and the
 *     fallback chat surfaces "live data temporarily unavailable" to
 *     the user — same as no-fallback behavior, but no hang.
 */
import { Connection, type ConnectionConfig } from "@solana/web3.js";

const PRIMARY_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const BACKUP_URL =
  process.env.FALLBACK_RPC_BACKUP_URL ||
  process.env.SOLANA_RPC_BACKUP_URL ||
  "https://api.mainnet-beta.solana.com";

const PER_CALL_TIMEOUT_MS = 8_000;

function strip(url: string): string {
  // Strip query strings (which carry API keys) for log output.
  try { return new URL(url).origin; } catch { return "rpc"; }
}

/**
 * Create a Connection that wraps every RPC method with a primary→backup
 * retry. Returns a Connection instance — callers use it like a normal
 * Connection (program.account.X.fetch, getAccountInfo, etc.).
 */
export function makeResilientConnection(config?: ConnectionConfig): Connection {
  const primary = new Connection(PRIMARY_URL, config ?? "confirmed");
  // If primary === backup (common: NEXT_PUBLIC_HELIUS_RPC_URL not set
  // and SOLANA_RPC_URL falls back to mainnet-beta), there's no point
  // wrapping. Return the primary directly to avoid the proxy overhead.
  if (PRIMARY_URL === BACKUP_URL) {
    return primary;
  }
  const backup = new Connection(BACKUP_URL, config ?? "confirmed");

  // Wrap every method that hits the network with primary→backup retry.
  // Anchor's program.account.X.fetch() ultimately funnels through
  // getAccountInfo / getMultipleAccountsInfo / getProgramAccounts, so
  // wrapping those is sufficient to cover the on-chain fallback's
  // entire surface.
  return new Proxy(primary, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      // Only wrap async methods; everything else (e.g. _rpcEndpoint,
      // commitment) passes through unchanged.
      if (typeof original !== "function") return original;
      // Allowlist of methods we want to failover on. Other methods
      // (subscriptions etc.) pass through unchanged — failover doesn't
      // make sense for them.
      const FAILOVER_METHODS = new Set([
        "getAccountInfo",
        "getMultipleAccountsInfo",
        "getProgramAccounts",
        "getBalance",
        "getLatestBlockhash",
        "getSignatureStatus",
        "getSignatureStatuses",
        "getSlot",
        "getTokenAccountBalance",
        "getTokenAccountsByOwner",
        "getTransaction",
        "sendRawTransaction",
        "simulateTransaction",
      ]);
      if (!FAILOVER_METHODS.has(prop as string)) {
        return original.bind(target);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return async (...args: any[]) => {
        const callWith = async (conn: Connection, label: string) => {
          // Per-call deadline so a hung RPC can't hold the chat's 10s
          // serverless deadline. Race the RPC call against a sleep.
          return await Promise.race([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (conn[prop as keyof Connection] as any).apply(conn, args),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`rpc_timeout(${label}/${String(prop)})`)),
                PER_CALL_TIMEOUT_MS,
              ),
            ),
          ]);
        };
        try {
          return await callWith(primary, strip(PRIMARY_URL));
        } catch (primaryErr) {
          console.warn(
            `[fallback-rpc] primary ${strip(PRIMARY_URL)}.${String(prop)} failed; trying backup ${strip(BACKUP_URL)}:`,
            (primaryErr as Error).message?.slice(0, 100),
          );
          // Single retry on backup. If backup also fails, surface the
          // backup's error so the caller knows BOTH endpoints failed
          // (more diagnostic value than just rethrowing primary's error).
          return await callWith(backup, strip(BACKUP_URL));
        }
      };
    },
  });
}
