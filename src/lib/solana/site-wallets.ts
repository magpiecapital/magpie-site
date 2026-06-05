/**
 * Site → bot bridge for /api/v1/wallets/set-active.
 *
 * Signs a JSON payload with the connected wallet and POSTs to the bot.
 * Must match the parser in `magpie-bot/src/api/wallets-api.js`.
 */
import bs58 from "bs58";

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

export async function siteSetActiveWallet(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  targetPubkey: string;
}): Promise<{ activeWallet: string }> {
  const { botApiUrl, signerPubkey, signMessage, targetPubkey } = args;
  if (!botApiUrl) throw new Error("Bot API URL not configured");

  const payload = {
    magpie: "wallets/set-active/v1",
    targetPubkey,
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

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/wallets/set-active`, {
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
    throw new Error(body?.error || `Set-active failed (HTTP ${res.status})`);
  }
  return { activeWallet: body.active_wallet };
}
