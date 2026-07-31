import type {
  Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

type AnyTx = Transaction | VersionedTransaction;
type SignFn = <T extends AnyTx>(tx: T) => Promise<T>;
type WalletSendFn = (tx: AnyTx, connection: Connection) => Promise<string>;

export type ConfirmResult = {
  ok: boolean;
  sig: string;
  pending?: boolean;
  err?: unknown;
};

const DEFAULT_TIMEOUT_MS = 90_000;
// Rebroadcast cadence. The site's RPC proxy (src/app/api/rpc/route.ts)
// rate-limits broadcast ("sendTransaction") calls as MUTATING
// (RATE_LIMIT_MUTATING_MAX per minute), so a single congested flow must
// stay comfortably under that window. At 12s we resend ~7 times across a
// blockhash's ~80s life — plenty of coverage under congestion while well
// under the mutating cap. (Resending a signed tx does NOT re-charge the
// fee: a Solana tx pays once, on its single confirmation.)
const DEFAULT_REBROADCAST_MS = 12_000;
const POLL_INTERVAL_MS = 1_500;

function getBlockhash(tx: AnyTx): string | undefined {
  const legacy = (tx as Transaction).recentBlockhash;
  if (legacy) return legacy;
  const msg = (tx as VersionedTransaction).message as
    | { recentBlockhash?: string }
    | undefined;
  return msg?.recentBlockhash;
}

/**
 * Send a user-signed transaction and confirm it robustly under Solana
 * congestion.
 *
 * Unlike a one-shot `sendTransaction` + status-poll (or the default
 * `confirmTransaction`, which gives up at blockhash-expiry even while the
 * tx is still confirming), this REBROADCASTS the same signed transaction
 * on an interval until it lands or its blockhash provably expires. A tx
 * dropped by a congested leader gets re-delivered instead of silently
 * timing out on "Landing your transaction…".
 *
 * Rebroadcast needs the raw signed bytes, so we prefer `signTransaction`
 * (sign locally → send + resend). When a wallet only exposes
 * `sendTransaction`, we fall back to a single send + poll — still using
 * `searchTransactionHistory` so we don't miss a slow confirmation. Never
 * worse than the prior send-once behaviour.
 *
 * Returns `{ ok:true, sig }` on confirm, `{ ok:false, err }` on an
 * on-chain failure, `{ ok:false, pending:true }` if the blockhash expired
 * / timed out with no resolution (caller directs the user to retry or
 * check Solscan). The early give-up is gated on `isBlockhashValid` so we
 * never abandon a tx that could still land — which is what prevents a
 * user from accidentally submitting the same loan/repay twice.
 */
export async function sendAndConfirmWithRebroadcast(
  connection: Connection,
  transaction: Transaction,
  opts: {
    sendTransaction: WalletSendFn;
    signTransaction?: SignFn;
    commitment?: "confirmed" | "finalized";
    timeoutMs?: number;
    rebroadcastIntervalMs?: number;
  },
): Promise<ConfirmResult> {
  const commitment = opts.commitment ?? "confirmed";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rebroadcastMs = opts.rebroadcastIntervalMs ?? DEFAULT_REBROADCAST_MS;
  const isDone = (level?: string | null) =>
    level === "finalized" ||
    (commitment === "confirmed" &&
      (level === "confirmed" || level === "finalized"));

  const blockhash = getBlockhash(transaction);

  // Serialize once for rebroadcast when we can sign locally.
  let raw: Uint8Array | null = null;
  let sig: string;
  if (opts.signTransaction) {
    const signed = await opts.signTransaction(transaction);
    raw = signed.serialize();
    // First send keeps preflight so a deterministic program revert is
    // surfaced (and classified by translateTxError) instead of being
    // rebroadcast in a loop.
    sig = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: commitment,
      maxRetries: 5,
    });
  } else {
    // Wallet has no signTransaction: single send, no rebroadcast.
    sig = await opts.sendTransaction(transaction, connection);
  }

  const start = Date.now();
  let lastRebroadcast = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await connection.getSignatureStatuses([sig], {
        searchTransactionHistory: true,
      });
      const s = res?.value?.[0];
      if (s) {
        if (s.err) return { ok: false, sig, err: s.err };
        if (isDone(s.confirmationStatus)) return { ok: true, sig };
      }
    } catch {
      /* transient RPC error — keep polling */
    }

    // Give up early (as pending) only once the blockhash provably can no
    // longer land — never while the tx could still confirm — so we can't
    // double-submit a second loan/repay.
    if (blockhash) {
      try {
        const v = await connection.isBlockhashValid(blockhash, { commitment });
        if (v && v.value === false) break;
      } catch {
        /* isBlockhashValid unsupported/transient — rely on the timeout */
      }
    }

    if (raw && Date.now() - lastRebroadcast >= rebroadcastMs) {
      try {
        await connection.sendRawTransaction(raw, {
          skipPreflight: true,
          maxRetries: 5,
        });
      } catch {
        /* a failed rebroadcast is non-fatal — keep polling */
      }
      lastRebroadcast = Date.now();
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // One last authoritative check before declaring pending.
  try {
    const res = await connection.getSignatureStatuses([sig], {
      searchTransactionHistory: true,
    });
    const s = res?.value?.[0];
    if (s?.err) return { ok: false, sig, err: s.err };
    if (s && isDone(s.confirmationStatus)) return { ok: true, sig };
  } catch {
    /* ignore — fall through to pending */
  }
  return { ok: false, sig, pending: true };
}
