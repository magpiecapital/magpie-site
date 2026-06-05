/**
 * Site → bot site-withdraw bridge.
 *
 * Builds the structured authentication message that the bot's
 * `POST /api/v1/withdraw` endpoint expects, gets it signed by the
 * connected wallet's `signMessage`, and posts to the bot.
 *
 * The signed message format MUST match the parser in
 * `magpie-bot/src/api/withdraw.js#parseSignedMessage`. If you change
 * either side, update the other in the same PR.
 */
import bs58 from "bs58";

export type SiteWithdrawAsset = "SOL" | string;

export interface SiteWithdrawRequest {
  from: string; // custodial wallet pubkey (source)
  to: string; // destination pubkey
  asset: SiteWithdrawAsset; // "SOL" or mint pubkey
  rawAmount: bigint; // exact base units (lamports for SOL)
}

export interface SiteWithdrawResult {
  signature: string;
  explorer: string;
}

export interface SignMessageFn {
  (message: Uint8Array): Promise<Uint8Array>;
}

function randomNonceHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildMessage(args: {
  from: string;
  to: string;
  asset: SiteWithdrawAsset;
  rawAmount: bigint;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "Magpie Withdraw v1",
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Asset: ${args.asset}`,
    `Amount: ${args.rawAmount.toString()}`,
    `Nonce: ${args.nonce}`,
    `IssuedAt: ${args.issuedAt}`,
  ].join("\n");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Sign the auth message with the connected wallet and submit to the bot.
 *
 * The bot verifies the signature against `signerPubkey`, checks that
 * wallet is linked to a Magpie account, then signs the on-chain transfer
 * from the user's custodial wallet.
 *
 * Throws on any failure — caller should display `err.message` to the user.
 */
export async function siteWithdraw(args: {
  botApiUrl: string;
  signerPubkey: string; // the connected (linked) wallet that will sign
  signMessage: SignMessageFn;
  request: SiteWithdrawRequest;
}): Promise<SiteWithdrawResult> {
  const { botApiUrl, signerPubkey, signMessage, request } = args;
  if (!botApiUrl) throw new Error("Bot API URL not configured");

  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildMessage({
    from: request.from,
    to: request.to,
    asset: request.asset,
    rawAmount: request.rawAmount,
    nonce,
    issuedAt,
  });

  const messageBytes = new TextEncoder().encode(messageText);
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

  const payload = {
    signedMessageBase64: bytesToBase64(messageBytes),
    signatureBase58: bs58.encode(signature),
    signerPubkey,
  };

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Withdraw failed (HTTP ${res.status})`);
  }
  return { signature: body.signature, explorer: body.explorer };
}
