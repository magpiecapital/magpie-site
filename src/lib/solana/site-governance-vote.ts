/**
 * Site → bot bridge for governance vote submission.
 *
 * Signs a JSON payload with the connected wallet and POSTs it to the
 * bot API. The bot verifies the signature, stores the signed payload,
 * and the operator's tally job folds it in at vote close.
 *
 * Payload shape (must match `magpie-bot/src/api/governance-api.js`):
 *   {
 *     "magpie": "gov-vote/v1",
 *     "proposal_id": "MGP-001",
 *     "question_id": "Vote",     // per-question for multi-Q proposals
 *     "vote": "YES" | "NO" | "ABSTAIN",
 *     "nonce": "...16-byte hex...",
 *     "issuedAt": "ISO-8601"
 *   }
 *
 * Wallet-signed messages are the v0 voting mechanism. v1+ will
 * progressively move verification on-chain.
 */
import bs58 from "bs58";

export type VoteChoice = "YES" | "NO" | "ABSTAIN" | "A" | "B" | "C" | "D" | "E";

/**
 * A ballot option as SHOWN to the voter. `value` is what gets signed + sent to
 * the bot; `label` + `description` are what the human reads. EVERY ballot option
 * must carry a label and a plain-English description — a voter must never face a
 * bare letter and have to guess what it means.
 */
export interface VoteOption {
  value: VoteChoice;
  label: string;
  description: string;
}

export interface SignMessageFn {
  (message: Uint8Array): Promise<Uint8Array>;
}

function randomNonceHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function siteCastVote(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  proposalId: string;
  questionId: string;
  vote: VoteChoice;
}): Promise<{ ok: true; recorded_at: string }> {
  const { botApiUrl, signerPubkey, signMessage, proposalId, questionId, vote } = args;
  if (!botApiUrl) throw new Error("Bot API URL not configured");

  const payload = {
    magpie: "gov-vote/v1",
    proposal_id: proposalId,
    question_id: questionId,
    vote,
    nonce: randomNonceHex(),
    issuedAt: new Date().toISOString(),
  };
  const messageBytes = new TextEncoder().encode(JSON.stringify(payload));

  let signature: Uint8Array;
  try {
    signature = await signMessage(messageBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Wallet declined to sign: ${msg}`);
  }
  if (!signature || signature.length !== 64) {
    throw new Error("Wallet returned an invalid signature");
  }

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/governance/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as
    | { ok?: boolean; recorded_at?: string; error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `Vote submission failed (HTTP ${res.status})`);
  }
  return { ok: true, recorded_at: body.recorded_at || new Date().toISOString() };
}
