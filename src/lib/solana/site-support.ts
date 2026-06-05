/**
 * Site → bot signed-support bridge.
 *
 * Builds the JSON auth payload for POST /api/v1/support/ask, signs it
 * with the connected wallet via `signMessage`, and posts it. Three
 * actions are supported: open (new ticket), follow_up, close.
 *
 * Format must match the parser in `magpie-bot/src/api/support-ask.js`.
 */
import bs58 from "bs58";

export type SupportAction = "open" | "follow_up" | "close";

export interface SignMessageFn {
  (message: Uint8Array): Promise<Uint8Array>;
}

export interface SupportAskResult {
  ticketId: number;
  action: SupportAction;
  aiResponse: string | null;
  aiError?: string | null;
  escalatedTicketId?: number | null;
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

export async function siteSupportAsk(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  action: SupportAction;
  ticketId?: number;
  message?: string;
}): Promise<SupportAskResult> {
  const { botApiUrl, signerPubkey, signMessage, action, ticketId, message } = args;
  if (!botApiUrl) throw new Error("Bot API URL not configured");

  const payload = {
    magpie: "support/v1",
    action,
    ticketId: ticketId ?? null,
    message: message ?? null,
    nonce: randomNonceHex(),
    issuedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(payload);
  const messageBytes = new TextEncoder().encode(json);

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

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/support/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Support request failed (HTTP ${res.status})`);
  }
  return {
    ticketId: body.ticketId,
    action: body.action,
    aiResponse: body.ai_response ?? null,
    aiError: body.ai_error ?? null,
    escalatedTicketId: body.escalated_ticket_id ?? null,
  };
}
