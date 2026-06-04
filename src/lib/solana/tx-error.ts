/**
 * Translate Solana / Anchor / wallet-adapter errors into clean,
 * user-actionable messages for the /earn flow.
 *
 * Mirrors the pattern from the bot's src/services/tx-error-translator.js
 * — recognize the most common patterns, return a structured object the
 * UI can render warmly (heading + body + suggested action).
 */

export interface FriendlyError {
  /** Short heading for the alert (no emoji — UI adds one) */
  title: string;
  /** Body text with the explanation. Plain text + line breaks; UI styles. */
  body: string;
  /** Optional action label (e.g. "Try again", "View tx") */
  action?: { label: string; href?: string };
}

function fmtSol(lamports: bigint | number) {
  const n = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (n / 1e9).toFixed(4);
}

/**
 * @param raw — the caught error or rpc-returned `r.err` (string OR object)
 * @param ctx — flow context: "deposit" | "withdraw"
 */
export function translateTxError(
  raw: unknown,
  ctx: { flow: "deposit" | "withdraw"; sig?: string } = { flow: "deposit" },
): FriendlyError {
  const flow = ctx.flow;
  const message = raw instanceof Error ? raw.message : (typeof raw === "string" ? raw : JSON.stringify(raw));
  const logs = (raw as { logs?: string[] })?.logs?.join("\n") || "";
  const blob = `${message}\n${logs}`;

  // 1) User rejected in wallet (most common — Phantom/Solflare cancel)
  if (/user rejected|user denied|user declined|rejected the request|wallet rejected/i.test(blob)) {
    return {
      title: "Cancelled",
      body: "You declined the transaction in your wallet. No funds moved.",
      action: { label: "Try again" },
    };
  }

  // 2) Insufficient SOL (most common real failure)
  const insufficientMatch = blob.match(/insufficient lamports\s+(\d+),\s*need\s+(\d+)/i);
  if (insufficientMatch || /custom program error: 0x1\b/i.test(blob)) {
    const have = insufficientMatch ? BigInt(insufficientMatch[1]) : null;
    const need = insufficientMatch ? BigInt(insufficientMatch[2]) : null;
    const short = have != null && need != null ? need - have : null;
    if (flow === "deposit") {
      return {
        title: "Not enough SOL in your wallet",
        body: [
          "You need the deposit amount + ~0.003 SOL for Solana network fees + ATA rent.",
          have != null ? `Your wallet has: ${fmtSol(have)} SOL` : "",
          need != null ? `Transaction needed: ${fmtSol(need)} SOL` : "",
          short != null ? `Short by: ${fmtSol(short)} SOL` : "",
          "",
          "Top up your wallet a bit and try again — the extra is just for the network, not for the pool.",
        ].filter(Boolean).join("\n"),
      };
    }
    return {
      title: "Wallet doesn't have enough SOL for fees",
      body: "Withdrawing still costs a tiny amount of SOL (~0.003) for network fees. Send a bit of SOL to your wallet and retry.",
    };
  }

  // 3) Blockhash expired
  if (/blockhash not found|BlockhashNotFound|block height exceeded/i.test(blob)) {
    return {
      title: "Transaction expired",
      body: "You took longer than ~90 seconds to confirm. Solana invalidated the transaction. No funds moved — just click " + (flow === "deposit" ? "Deposit" : "Withdraw") + " again.",
      action: { label: "Try again" },
    };
  }

  // 4) Anchor named errors — pool paused, position constraints, etc.
  const anchorMatch = blob.match(/Error Code:\s*([A-Za-z][A-Za-z0-9_]+)/i) || blob.match(/AnchorError.*?(?:Error Code:|Error Number:|code:)\s*([A-Za-z][A-Za-z0-9_]+)/i);
  if (anchorMatch) {
    const code = anchorMatch[1];
    const codeMessages: Record<string, FriendlyError> = {
      PoolPaused: {
        title: "Pool is paused",
        body: "The lending pool is temporarily paused (admin maintenance or emergency). Deposits/withdrawals are blocked until it resumes. Check the Telegram channel for updates.",
      },
      InsufficientLiquidity: {
        title: "Pool doesn't have enough liquidity right now",
        body: "Some of the pool's SOL is currently lent out. You can withdraw what's available, or wait for borrowers to repay (usually within hours).",
      },
      InsufficientShares: {
        title: "Withdrawal exceeds your position",
        body: "You're trying to withdraw more than you have in the pool. Lower the amount or use Max.",
      },
      ZeroAmount: {
        title: "Amount must be greater than zero",
        body: "Enter a positive amount and try again.",
      },
    };
    if (codeMessages[code]) return codeMessages[code];
    return {
      title: `Transaction rejected: ${code}`,
      body: "The program declined this transaction. Refresh the page and try again — if it persists, ping us in Telegram with this code.",
    };
  }

  // 5) Account does not exist (e.g., position PDA) — usually first-time withdraw
  if (/AccountNotInitialized|account.*does not exist|3012/i.test(blob)) {
    if (flow === "withdraw") {
      return {
        title: "No deposit found on this wallet",
        body: "We don't see an LP position for this wallet on-chain. Either you've never deposited, or you're connected with a different wallet than the one you deposited from.",
      };
    }
  }

  // 6) Network / RPC blip
  if (/fetch failed|ECONNRESET|ETIMEDOUT|getaddrinfo|429|503|connection.*reset/i.test(message)) {
    return {
      title: "Network hiccup",
      body: "Solana RPC had a brief blip. No funds moved. Retry in 15-30 seconds.",
      action: { label: "Try again" },
    };
  }

  // 7) Confirmation timeout (already pre-formatted by the page in some cases)
  if (/not confirmed in/i.test(blob)) {
    return {
      title: "Transaction submitted but slow to confirm",
      body: ctx.sig
        ? `It usually still lands. Check the transaction on Solscan in a minute — if it shows Success, your ${flow} is in.`
        : "It usually still lands. Refresh in a minute — if your balance updated, you're good.",
      action: ctx.sig ? { label: "View on Solscan", href: `https://solscan.io/tx/${ctx.sig}` } : undefined,
    };
  }

  // Fallback — cleaned-up generic message
  return {
    title: flow === "deposit" ? "Deposit failed" : "Withdrawal failed",
    body: `${message.slice(0, 200)}\n\nRefresh and try again. If it keeps failing, ping us in the Telegram channel and we'll dig in.`,
  };
}
