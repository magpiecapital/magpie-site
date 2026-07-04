/**
 * Site → bot signed referral bridge.
 *
 * Builds the JSON auth payload for POST /api/v1/referral/set-code, signs it
 * with the connected wallet via `signMessage`, and posts it. Lets a dashboard
 * user claim a custom vanity referral code (a free message signature — no SOL,
 * no transaction). Format must match `magpie-bot/src/api/referral-set-code.js`.
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

/** Claim a custom vanity referral code. Resolves to the normalized code. */
export async function siteSetReferralCode(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  code: string;
}): Promise<{ code: string }> {
  const { botApiUrl, signerPubkey, signMessage, code } = args;
  if (!botApiUrl) throw new Error("Referral service not configured");
  const clean = code.trim();
  if (clean.length < 3 || clean.length > 20) {
    throw new Error("Code must be 3–20 characters.");
  }

  const payload = {
    magpie: "referral/set-code/v1",
    code: clean,
    nonce: randomNonceHex(),
    issuedAt: new Date().toISOString(),
  };
  const messageBytes = new TextEncoder().encode(JSON.stringify(payload));

  let signature: Uint8Array;
  try {
    signature = await signMessage(messageBytes);
  } catch (err) {
    throw new Error(`Wallet declined to sign: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!signature || signature.length !== 64) {
    throw new Error("Wallet returned an invalid signature");
  }

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/referral/set-code`, {
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
    throw new Error(body?.detail || body?.error || `Failed (HTTP ${res.status})`);
  }
  return { code: body.code };
}
