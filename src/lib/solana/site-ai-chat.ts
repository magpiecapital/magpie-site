/**
 * Site → bot bridge for /api/v1/ai/chat.
 *
 * Signs a JSON payload and POSTs to the bot. Used by the floating
 * chat widget for ephemeral Q&A that doesn't create a ticket.
 */
import bs58 from "bs58";

export interface SignMessageFn {
  (message: Uint8Array): Promise<Uint8Array>;
}

export interface AiChatResult {
  response: string;
  blockedReason?: string | null;
  spendCapped?: boolean;
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

async function postSigned(
  endpoint: string,
  payload: Record<string, unknown>,
  args: { botApiUrl: string; signerPubkey: string; signMessage: SignMessageFn },
) {
  const messageBytes = new TextEncoder().encode(JSON.stringify(payload));
  let signature: Uint8Array;
  try {
    signature = await args.signMessage(messageBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Wallet declined to sign: ${msg}`);
  }
  if (!signature || signature.length !== 64) {
    throw new Error("Wallet returned an invalid signature");
  }
  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey: args.signerPubkey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (HTTP ${res.status})`);
  }
  return body;
}

export async function siteAiChat(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  message: string;
}): Promise<AiChatResult> {
  const body = await postSigned(
    "/api/v1/ai/chat",
    {
      magpie: "ai-chat/v1",
      action: "chat",
      message: args.message,
      nonce: randomNonceHex(),
      issuedAt: new Date().toISOString(),
    },
    args,
  );
  return {
    response: body.response,
    blockedReason: body.blocked_reason ?? null,
    spendCapped: !!body.spend_capped,
    escalatedTicketId: body.escalated_ticket_id ?? null,
  };
}

export async function siteAiReset(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
}): Promise<void> {
  await postSigned(
    "/api/v1/ai/chat",
    {
      magpie: "ai-chat/v1",
      action: "reset",
      nonce: randomNonceHex(),
      issuedAt: new Date().toISOString(),
    },
    args,
  );
}
