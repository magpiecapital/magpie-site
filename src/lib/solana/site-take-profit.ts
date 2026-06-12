/**
 * Site-side take-profit (limit-close) SDK.
 *
 * Three calls:
 *   - fetchTakeProfitState(wallet) → loans + armed orders + custodial flag
 *   - armTakeProfit({ from, loanIdChain, target, ... }) → signed POST arm
 *   - cancelTakeProfit({ from, orderId }) → signed DELETE cancel
 *
 * The arm + cancel paths sign a structured Ed25519 envelope the user's
 * wallet adapter shows them BEFORE they confirm — same UX as
 * site-withdraw / site-prefs / site-export.
 *
 * The arm envelope's `magpie: limit-close-arm/v1` header binds the
 * signature to the specific action. The bot rejects any envelope where
 * that tag is wrong, so an arm signature can't be replayed as a cancel.
 *
 * All API errors come back as readable strings — callers should
 * display `err.message` directly to the user.
 */
import bs58 from "bs58";
import type { SignMessageFn } from "./site-ai-chat";

type Hex = string;

function randomNonceHex(): Hex {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────── */

export interface TakeProfitLoan {
  id: number;
  loan_id: string;
  loan_pda: string;
  collateral_mint: string;
  collateral_symbol: string | null;
  collateral_decimals: number | null;
  collateral_amount: string;
  owed_lamports: string;
  owed_sol: number;
  start_timestamp: string;
  due_timestamp: string;
  is_eligible_for_takeprofit: boolean;
  ineligibility_reasons: string[];
}

export interface TakeProfitOrder {
  id: number;
  loan_id: number;
  trigger_kind: "mc_usd" | "price_usd" | "price_sol";
  trigger_value_micro: string;
  slippage_bps: number;
  sell_destination: "sol" | "usdc";
  status: "armed" | "firing" | "twap_in_progress" | "awaiting_user";
  armed_at: string;
  expires_at: string | null;
  source: "tg" | "site" | "agent_x402";
  source_agent_pubkey: string | null;
}

export interface TakeProfitState {
  linked: boolean;
  custodial: boolean;
  loans: TakeProfitLoan[];
  orders: TakeProfitOrder[];
  generated_at?: string;
}

/* ────────────────────────────────────────────────────────────────
 * GET state
 * ──────────────────────────────────────────────────────────────── */

export async function fetchTakeProfitState(args: {
  botApiUrl: string;
  wallet: string;
}): Promise<TakeProfitState> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");
  const url = `${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close?wallet=${encodeURIComponent(args.wallet)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `take-profit state fetch failed (HTTP ${res.status})`);
  return body as TakeProfitState;
}

/* ────────────────────────────────────────────────────────────────
 * POST arm
 * ──────────────────────────────────────────────────────────────── */

export interface ArmTakeProfitRequest {
  from: string;            // signer wallet pubkey
  loanIdChain: string;     // chain loan_id
  target:                  // EXACTLY ONE of:
    | { kind: "multiplier"; multiplier: number }     // 2 = "2x"
    | { kind: "price_usd";  usd: number }            // explicit USD/token
    | { kind: "mc_usd";     mcDollars: number };     // explicit MC
  slippageBps?: number;    // default 200
  sellDestination?: "sol" | "usdc";
  expire?: string;         // "30d" / "12h" — optional
}

export interface ArmedTakeProfitResult {
  order_id: number;
  armed_at: string;
  loan_id: string;
  collateral_symbol: string | null;
  trigger_kind: string;
  trigger_value_micro: string;
  slippage_bps: number;
  sell_destination: string;
  expires_at: string | null;
  multiplier?: number | null;
  current_usd?: number | null;
  target_usd?: number | null;
  source: "site";
}

function buildArmMessage(args: {
  from: string;
  loanIdChain: string;
  target: ArmTakeProfitRequest["target"];
  slippageBps: number;
  dest: "sol" | "usdc";
  expire?: string;
  nonce: string;
  issuedAt: string;
}): string {
  const lines = [
    "magpie: limit-close-arm/v1",
    `From: ${args.from}`,
    `LoanId: ${args.loanIdChain}`,
  ];
  if (args.target.kind === "multiplier") {
    lines.push(`Target: ${args.target.multiplier}x`);
  } else if (args.target.kind === "price_usd") {
    lines.push(`Price: ${args.target.usd}`);
  } else {
    // Express MC as raw dollars; bot accepts the unsuffixed value too
    // via the regex. Easier than picking M/B suffixes client-side.
    lines.push(`MC: ${args.target.mcDollars}`);
  }
  lines.push(`Slippage: ${args.slippageBps}`);
  lines.push(`Dest: ${args.dest}`);
  if (args.expire) lines.push(`Expire: ${args.expire}`);
  lines.push(`Nonce: ${args.nonce}`);
  lines.push(`IssuedAt: ${args.issuedAt}`);
  return lines.join("\n");
}

export async function armTakeProfit(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  request: ArmTakeProfitRequest;
}): Promise<ArmedTakeProfitResult> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");

  const slippageBps = args.request.slippageBps ?? 200;
  const dest = args.request.sellDestination ?? "sol";
  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildArmMessage({
    from: args.request.from,
    loanIdChain: args.request.loanIdChain,
    target: args.request.target,
    slippageBps,
    dest,
    expire: args.request.expire,
    nonce,
    issuedAt,
  });

  const messageBytes = new TextEncoder().encode(messageText);
  let signature: Uint8Array;
  try { signature = await args.signMessage(messageBytes); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Wallet declined to sign: ${msg}`);
  }
  if (!signature || signature.length !== 64) {
    throw new Error("Wallet returned an invalid signature");
  }

  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/arm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey: args.signerPubkey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(translateArmError(body));
  }
  return body as ArmedTakeProfitResult;
}

export function translateArmError(body: { error?: string; detail?: string; suggested_slippage_bps?: number }): string {
  const code = body?.error;
  switch (code) {
    case "requires_linked_custodial_wallet":
      return "Take-profit needs a Magpie custodial keypair. Connect via the Telegram bot first, then come back.";
    case "wallet_not_linked":
      return "This wallet isn't linked to a Magpie account yet. Link via /link on the TG bot first.";
    case "loan_not_found_for_signer":
    case "loan_not_found_for_user":
      return "We couldn't find that loan on your linked account.";
    case "loan_below_minimum_size":
      return "This loan is below the 1 SOL minimum for take-profit orders.";
    case "loan_already_has_active_order":
      return "You already have an armed take-profit on this loan. Cancel it first.";
    case "rwa_collateral_not_supported_in_v1":
      return "Take-profit isn't available for xStocks / RWA collateral yet — memecoin loans only.";
    case "user_concurrency_cap_reached":
      return "You've hit the limit of 10 armed take-profits. Cancel one to arm another.";
    case "slippage_too_low":
      return body.detail || `Slippage too low at current liquidity. Suggested: ${body.suggested_slippage_bps! / 100}%.`;
    case "liquidity_insufficient":
      return body.detail || "Current liquidity can't cover this loan even at 10% slippage.";
    case "too_fast":
      return "Too many take-profit requests in a row. Give it a few seconds.";
    case "stale_signed_message":
      return "Your signature expired before reaching the server. Try again.";
    case "signature_does_not_match":
      return "Signature verification failed. Reconnect your wallet and try again.";
    case "from_signer_mismatch":
      return "Signed message mismatch. Reconnect your wallet and try again.";
    case "multiplier_resolve_failed":
      return body.detail || "Couldn't fetch the current price for the multiplier target — try an explicit price.";
    default:
      return body?.error || body?.detail || "Take-profit arm failed.";
  }
}

/* ────────────────────────────────────────────────────────────────
 * DELETE cancel
 * ──────────────────────────────────────────────────────────────── */

function buildCancelMessage(args: { from: string; orderId: number; nonce: string; issuedAt: string }): string {
  return [
    "magpie: limit-close-cancel/v1",
    `From: ${args.from}`,
    `OrderId: ${args.orderId}`,
    `Nonce: ${args.nonce}`,
    `IssuedAt: ${args.issuedAt}`,
  ].join("\n");
}

export async function cancelTakeProfit(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  orderId: number;
}): Promise<{ cancelled_order_id: number }> {
  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildCancelMessage({
    from: args.signerPubkey,
    orderId: args.orderId,
    nonce,
    issuedAt,
  });
  const messageBytes = new TextEncoder().encode(messageText);
  let signature: Uint8Array;
  try { signature = await args.signMessage(messageBytes); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Wallet declined to sign: ${msg}`);
  }
  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/cancel`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey: args.signerPubkey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body?.error || `Cancel failed (HTTP ${res.status})`);
  return body as { cancelled_order_id: number };
}
