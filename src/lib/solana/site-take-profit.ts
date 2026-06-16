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
  /** Eligible to arm a take-profit (upside, "above" trigger). */
  is_eligible_for_takeprofit: boolean;
  /** Reasons TP can't be armed (e.g. ["take_profit_already_armed"]). */
  ineligibility_reasons: string[];
  /** Eligible to arm a stop-loss (downside, "below" trigger). 2026-06-13. */
  is_eligible_for_stoploss?: boolean;
  /** Reasons SL can't be armed (e.g. ["stop_loss_already_armed"]). 2026-06-13. */
  stoploss_ineligibility_reasons?: string[];
}

export interface TakeProfitOrder {
  id: number;
  loan_id: number;
  trigger_kind: "mc_usd" | "price_usd" | "price_sol";
  trigger_value_micro: string;
  /**
   * "above" = take-profit (default; back-compat with pre-2026-06-13
   * responses that didn't include the field). "below" = stop-loss.
   */
  trigger_direction?: "above" | "below";
  slippage_bps: number;
  sell_destination: "sol" | "usdc";
  status: "armed" | "firing" | "twap_in_progress" | "awaiting_user" | "fired" | "cancelled";
  armed_at: string;
  /** Slice in basis points (10000 = 100% sell). Defaults to 10000 when
   *  the order isn't part of a ladder. */
  slice_pct?: number;
  /** Same group_id across all legs of a single ladder arming. NULL for
   *  non-ladder orders. */
  ladder_group_id?: string | null;
  /** Fire receipts — populated only when status = 'fired'. */
  fired_at?: string | null;
  proceeds_lamports?: string | null;
  net_to_user_lamports?: string | null;
  tx_signature_swap?: string | null;
  tx_signature_repay?: string | null;
  expires_at: string | null;
  source: "tg" | "site" | "agent_x402";
  source_agent_pubkey: string | null;
  /**
   * Trailing-stop distance in basis points (50-5000). When non-null,
   * the trigger_value_micro floats with the highest observed price
   * (peak_price_micros). Engine writes both fields on the same tick
   * when peak rises. Always null on take-profit orders (TP fires at
   * a fixed target by definition).
   */
  trailing_distance_bps?: number | null;
  /** Highest price observed since arm. Updated by the watcher. */
  peak_price_micros?: string | null;
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
  /** "above" = take-profit (default), "below" = stop-loss */
  direction?: "above" | "below";
  target?:                 // ONE of (or omitted when trailingDistanceBps is set):
    | { kind: "multiplier"; multiplier: number }     // 2 = "2x" TP, 0.7 = "0.7x" SL
    | { kind: "price_usd";  usd: number }            // explicit USD/token
    | { kind: "mc_usd";     mcDollars: number };     // explicit MC
  /**
   * Trailing-stop distance in basis points (50-5000). ONLY valid with
   * direction='below'. When set, target is ignored — the watcher seeds
   * peak = current price at arm and the trigger floats with the high.
   */
  trailingDistanceBps?: number;
  slippageBps?: number;    // default 200
  sellDestination?: "sol" | "usdc";
  expire?: string;         // "30d" / "12h" — optional
  /**
   * Ladder leg slice in basis points. Default 10000 = 100% = full close
   * (single-leg arm; unchanged from pre-ladder behavior). Set <10000 to
   * arm a ladder leg that sells slice/10000 of original collateral when
   * the trigger hits. Multiple legs on the same loan/direction with
   * sum(slicePctBps) <= 10000 are stitched together by the bot via a
   * shared ladder_group_id. The bot's site-limit-close handler reads
   * the Slice envelope field and forwards to arm-core.
   */
  slicePctBps?: number;
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
  direction: "above" | "below";
  target?: ArmTakeProfitRequest["target"];
  trailingDistanceBps?: number;
  slippageBps: number;
  dest: "sol" | "usdc";
  expire?: string;
  nonce: string;
  issuedAt: string;
  /** Ladder leg slice in basis points (1..10000). Default 10000 = full
   *  close; omit the Slice field on the wire entirely when the leg is
   *  a single full-close arm so older bot deploys still parse cleanly. */
  slicePctBps?: number;
}): string {
  const lines = [
    "magpie: limit-close-arm/v1",
    `From: ${args.from}`,
    `LoanId: ${args.loanIdChain}`,
  ];
  // Only emit Direction when SL is requested. Omitting it for TP keeps
  // the wire format identical to pre-2026-06-13 messages and ensures
  // older bot deploys (mid-deploy window) still parse cleanly.
  if (args.direction === "below") {
    lines.push(`Direction: below`);
  }
  // Trailing supersedes target — emit only Trailing when set.
  if (args.trailingDistanceBps != null) {
    lines.push(`Trailing: ${args.trailingDistanceBps}`);
  } else if (args.target) {
    if (args.target.kind === "multiplier") {
      lines.push(`Target: ${args.target.multiplier}x`);
    } else if (args.target.kind === "price_usd") {
      lines.push(`Price: ${args.target.usd}`);
    } else {
      // Express MC as raw dollars; bot accepts the unsuffixed value too
      // via the regex. Easier than picking M/B suffixes client-side.
      lines.push(`MC: ${args.target.mcDollars}`);
    }
  }
  lines.push(`Slippage: ${args.slippageBps}`);
  lines.push(`Dest: ${args.dest}`);
  if (args.expire) lines.push(`Expire: ${args.expire}`);
  // Omit Slice field entirely for default full-close arms (Slice=10000)
  // so the envelope is byte-identical to pre-ladder messages — older bot
  // deploys mid-rollout still parse cleanly.
  if (args.slicePctBps != null && args.slicePctBps < 10000) {
    lines.push(`Slice: ${args.slicePctBps}`);
  }
  lines.push(`Nonce: ${args.nonce}`);
  lines.push(`IssuedAt: ${args.issuedAt}`);
  return lines.join("\n");
}

/* ────────────────────────────────────────────────────────────────
 * Arm preflight — dry-run validator
 * ──────────────────────────────────────────────────────────────── */

export interface ArmPreflightResult {
  ok: boolean;
  /** Populated when ok:true — the resolved trigger + distance preview. */
  would_arm?: {
    loan_db_id: number;
    loan_id_chain: string;
    program_id: string | null;
    is_v4_loan: boolean;
    collateral_mint: string;
    collateral_symbol: string | null;
    trigger_kind: "price_usd" | "mc_usd" | "price_sol";
    trigger_value_micro: string;
    trigger_direction: "above" | "below";
    slippage_bps: number;
    slice_pct_bps: number;
    trailing_distance_bps: number | null;
    target_usd: number | null;
    current_usd: number | null;
    distance_pct: number | null;
  };
  /** Populated when ok:false — same shape the real arm would return. */
  error?: string;
  detail?: string;
}

/**
 * Dry-run check that the planned arm WOULD succeed. Calls the bot's
 * /api/v1/site/limit-close/arm-preflight endpoint which mirrors armOrder's
 * eligibility gates without requiring a signMessage envelope.
 *
 * Use this BEFORE armTakeProfit so the dashboard can surface failures
 * (loan_not_found_for_signer, exits_require_v4_loan, slice_overflow,
 * take_profit_already_armed, etc.) inline instead of asking Phantom to
 * sign a doomed envelope.
 *
 * V4 Hardening T3 (operator-mandated 2026-06-15 PM): no silent arm
 * failures, ever. Preflight is the first gate.
 */
export async function preflightArmTakeProfit(args: {
  botApiUrl: string;
  wallet: string;
  request: ArmTakeProfitRequest;
}): Promise<ArmPreflightResult> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");

  // Translate the typed ArmTakeProfitRequest to the preflight wire shape.
  // Same fields the real arm endpoint parses; preflight is symmetric.
  const target = args.request.target;
  const wireBody: Record<string, unknown> = {
    wallet: args.wallet,
    loan_id_chain: args.request.loanIdChain,
    direction: args.request.direction ?? "above",
    slippage_bps: args.request.slippageBps ?? 200,
    slice_pct_bps: args.request.slicePctBps,
    trailing_distance_bps: args.request.trailingDistanceBps,
  };
  if (target?.kind === "multiplier") {
    wireBody.target = `${target.multiplier}x`;
  } else if (target?.kind === "price_usd") {
    wireBody.price = target.usd;
  } else if (target?.kind === "mc_usd") {
    wireBody.mc = target.mcDollars;
  }

  let res: Response;
  try {
    res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/arm-preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wireBody),
    });
  } catch (err) {
    // Network-level failure — return a non-ok result so the caller knows
    // to surface a network error rather than proceed to signMessage.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "preflight_network_error", detail: msg.slice(0, 120) };
  }

  let body: ArmPreflightResult;
  try {
    body = (await res.json()) as ArmPreflightResult;
  } catch {
    return { ok: false, error: "preflight_invalid_response", detail: `HTTP ${res.status}` };
  }
  return body;
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
  const direction = args.request.direction ?? "above";
  if (args.request.trailingDistanceBps != null && direction !== "below") {
    throw new Error("Trailing stops are only valid with direction='below' (stop-loss).");
  }
  if (args.request.trailingDistanceBps == null && !args.request.target) {
    throw new Error("Provide either target or trailingDistanceBps.");
  }
  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildArmMessage({
    from: args.request.from,
    loanIdChain: args.request.loanIdChain,
    direction,
    target: args.request.target,
    trailingDistanceBps: args.request.trailingDistanceBps,
    slippageBps,
    dest,
    expire: args.request.expire,
    nonce,
    issuedAt,
    slicePctBps: args.request.slicePctBps,
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
      // Unreachable since 2026-06-13 bot PR #161 — the gate was flipped
      // and the engine V2 fill path landed. Kept as a defensive case in
      // the switch with a retry-prompt instead of the stale copy.
      return "Take-profit on this collateral is now live — please try again.";
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

/* ────────────────────────────────────────────────────────────────
 * POST modify — in-place tweak armed order's trigger / slippage / etc.
 *
 * 2026-06-13: TG and x402 agent surfaces have always had modify; the
 * site only had arm + cancel. Users wanting to tighten a stop-loss
 * after a rally had to cancel + re-arm, which left a market-move gap
 * where the order was unprotected. modify closes that gap.
 *
 * Envelope mirrors the bot's handleSiteLimitCloseModify expectation.
 * At least one of price / slippageBps / sellDestination / expire must
 * be supplied — the bot rejects no_changes_supplied otherwise.
 * ──────────────────────────────────────────────────────────────── */

export interface ModifyTakeProfitRequest {
  orderId: number;
  /** New trigger USD price/token. Pass either this OR mcUsd, not both. */
  priceUsd?: number;
  /** New market-cap trigger in raw USD (e.g. 150_000_000 for $150M). */
  mcUsd?: number;
  /** New initial slippage bps (10-2500). */
  slippageBps?: number;
  /** Change sell destination. */
  sellDestination?: "sol" | "usdc";
  /** New expiry ISO timestamp, or "none" to clear expiry. */
  expires?: string | "none";
  /**
   * New trailing distance in bps (50-5000), or null to clear trailing
   * (back to a regular fixed-floor stop-loss). Only valid on stop-loss
   * direction orders. First-time enable seeds peak from live price;
   * later changes recompute trigger from existing peak.
   */
  trailingDistanceBps?: number | null;
}

function buildModifyMessage(args: {
  from: string;
  orderId: number;
  priceUsd?: number;
  mcUsd?: number;
  slippageBps?: number;
  sellDestination?: "sol" | "usdc";
  expires?: string | "none";
  trailingDistanceBps?: number | null;
  nonce: string;
  issuedAt: string;
}): string {
  const lines = [
    "magpie: limit-close-modify/v1",
    `From: ${args.from}`,
    `OrderId: ${args.orderId}`,
  ];
  // Trigger updates are mutually exclusive. Site UI uses Price; MC is
  // here for parity with the bot envelope.
  if (args.priceUsd != null) lines.push(`Price: ${args.priceUsd}`);
  else if (args.mcUsd != null) lines.push(`MC: ${args.mcUsd}`);
  if (args.slippageBps != null) lines.push(`Slippage: ${args.slippageBps}`);
  if (args.sellDestination) lines.push(`Dest: ${args.sellDestination}`);
  if (args.expires) lines.push(`Expires: ${args.expires}`);
  // Trailing: null = clear back to fixed SL, number = new distance bps.
  // The bot endpoint accepts "none" or the bps value.
  if (args.trailingDistanceBps === null) lines.push(`Trailing: none`);
  else if (args.trailingDistanceBps != null) lines.push(`Trailing: ${args.trailingDistanceBps}`);
  lines.push(`Nonce: ${args.nonce}`);
  lines.push(`IssuedAt: ${args.issuedAt}`);
  return lines.join("\n");
}

export async function modifyTakeProfit(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  request: ModifyTakeProfitRequest;
}): Promise<{ order_id: number; trigger_value_micro?: string; slippage_bps?: number }> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");
  const { orderId, priceUsd, mcUsd, slippageBps, sellDestination, expires, trailingDistanceBps } = args.request;
  if (
    priceUsd == null &&
    mcUsd == null &&
    slippageBps == null &&
    !sellDestination &&
    !expires &&
    trailingDistanceBps === undefined
  ) {
    throw new Error("Nothing to modify — supply at least one of price / slippage / dest / expires / trailing.");
  }
  // Trailing must be null (clear), or an integer in the valid range.
  // Mirror the bot's gate so a typo'd value gets caught client-side.
  if (trailingDistanceBps !== undefined && trailingDistanceBps !== null) {
    if (!Number.isInteger(trailingDistanceBps) || trailingDistanceBps < 50 || trailingDistanceBps > 5000) {
      throw new Error("trailingDistanceBps must be an integer in [50, 5000] bps, or null to clear.");
    }
  }
  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildModifyMessage({
    from: args.signerPubkey,
    orderId,
    priceUsd,
    mcUsd,
    slippageBps,
    sellDestination,
    expires,
    trailingDistanceBps,
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
  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/modify`, {
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
    throw new Error(body?.error || `Modify failed (HTTP ${res.status})`);
  }
  return body as { order_id: number; trigger_value_micro?: string; slippage_bps?: number };
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
