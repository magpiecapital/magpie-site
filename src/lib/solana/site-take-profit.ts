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
  /**
   * V4 remainder watcher (operator-mandated 2026-06-16 PM). Mirrors
   * on-chain `loan.current_collateral_amount` — the SPL collateral
   * still in the vault, decremented per convert_collateral_slice fire.
   * Equals `collateral_amount` on V1/V2/V3 (no partial fills) and on
   * V4 loans that haven't fired any leg yet. Drives the "Y TOKEN
   * remaining" display on partial-fire loan cards.
   */
  current_collateral_amount?: string;
  /**
   * Lamports accumulated in the per-loan `sol_proceeds_vault` PDA from
   * all `convert_collateral_slice` fires, net of the 1% protocol fee.
   * The user receives this at repay time alongside any remaining SPL.
   */
  sol_proceeds_amount?: string;
  /** Diagnostic counter: number of convert_collateral_slice fires. */
  auto_sells_fired?: number;
  owed_lamports: string;
  owed_sol: number;
  start_timestamp: string;
  due_timestamp: string;
  /**
   * The on-chain lending program id this loan was opened on. Matters
   * for V4 detection: V4 loans (program_id === PROGRAM_ID_V4) only
   * exist because the user requested an exit. So a V4 loan with no
   * orders is a silent auto-arm failure, not an empty state — see
   * feedback_v4_loans_never_show_exit_not_set.md. Bot endpoint
   * returns this from loans.program_id.
   */
  program_id?: string | null;
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
  status:
    | "armed"
    | "firing"
    | "twap_in_progress"
    | "awaiting_user"
    | "fired"
    // A TWAP/chunked exit that sold SOME collateral into the vault (audit
    // 2026-06-28 P1 #3) — a FIRED (terminal) state with real proceeds.
    | "partial_fired"
    | "cancelled"
    | "failed"
    | "max_retries_exceeded";
  armed_at: string;
  /** When status = 'failed' or 'max_retries_exceeded', the engine's
   *  classified reason (e.g. "route_failure", "slippage_exceeded"). */
  failure_reason?: string | null;
  failure_count?: number | null;
  cancellation_reason?: string | null;
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

/**
 * Pending arm intent — the beacon record we keep BEFORE Phantom is
 * asked to sign. If an intent stays `pending` after the signed arm
 * was expected to land, that's empirical proof of a silent-leg-drop
 * (Phantom session blip, network failure mid-fetch, etc.). The
 * dashboard reads these to render the intent-aware recovery banner.
 */
export interface TakeProfitPendingIntent {
  id: number;
  loan_id_chain: string;
  direction: "above" | "below";
  target_kind: "multiplier" | "price_usd" | "mc_usd" | "price_sol" | "trailing";
  target_value_micro: string;
  slice_pct_bps: number | null;
  source: string;
  created_at: string;
}

/**
 * Tier-2 architectural fix (defense C in
 * feedback_loan_830_full_postmortem_and_defenses.md). When the
 * server queues an arm because the borrow's DB-write hadn't landed
 * yet, it returns these rows so the dashboard knows to render an
 * "Arming…" pill on the loan card instead of the recovery banner.
 * The background watcher will replay them every 10s for up to 5 min.
 */
export interface PendingArm {
  id: number;
  loan_id_chain: string;
  status: "pending" | "armed" | "expired" | "failed";
  legs: unknown[];
  intent_ids: number[] | null;
  envelope_issued_at: string;
  retry_count: number;
  last_retry_at: string | null;
  last_retry_error: string | null;
  order_ids: number[] | null;
  seconds_remaining: number;
}

export interface TakeProfitState {
  linked: boolean;
  custodial: boolean;
  loans: TakeProfitLoan[];
  orders: TakeProfitOrder[];
  /** Recent (24h) pending arm intents — used for V4 recovery banner. */
  pending_intents?: TakeProfitPendingIntent[];
  /** Tier-2: in-flight pending_arms — render as "Arming…" not "failed". */
  pending_arms?: PendingArm[];
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

/**
 * Beacon endpoint — POSTs a lightweight intent record to the server
 * BEFORE any Phantom signing. Operator-mandated 2026-06-16 PM
 * (feedback_every_arm_envelope_must_reach_server.md). Server has a
 * durable record of "the user requested this exit" even if the
 * subsequent signed arm chain silently fails (Phantom session blip,
 * useEffect timing race, network hiccup mid-fetch).
 *
 * Best-effort: if the intent beacon fails, we PROCEED to the signed
 * arm anyway (don't want to gate the user's exit on intent telemetry).
 * The dashboard reconciliation banner is the safety net.
 */
export async function postArmIntent(args: {
  botApiUrl: string;
  wallet: string;
  loanIdChain: string;
  request: ArmTakeProfitRequest;
}): Promise<{ ok: boolean; intent_id?: number; error?: string }> {
  if (!args.botApiUrl) return { ok: false, error: "no_bot_api_url" };
  const target = args.request.target;
  let target_kind: string | null = null;
  let target_value_micro: string | null = null;
  if (args.request.trailingDistanceBps != null) {
    target_kind = "trailing";
    target_value_micro = String(args.request.trailingDistanceBps);
  } else if (target?.kind === "multiplier") {
    target_kind = "multiplier";
    target_value_micro = String(Math.round(target.multiplier * 1e6));
  } else if (target?.kind === "price_usd") {
    target_kind = "price_usd";
    target_value_micro = String(Math.round(target.usd * 1e6));
  } else if (target?.kind === "mc_usd") {
    target_kind = "mc_usd";
    target_value_micro = String(Math.round(target.mcDollars * 1e6));
  } else {
    return { ok: false, error: "no_target" };
  }
  try {
    const res = await fetch(
      `${args.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: args.wallet,
          loan_id_chain: args.loanIdChain,
          direction: args.request.direction ?? "above",
          target_kind,
          target_value_micro,
          slice_pct_bps: args.request.slicePctBps,
          source: "site",
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `intent_http_${res.status}` };
    }
    const body = (await res.json()) as { intent_id?: number };
    return { ok: true, intent_id: body.intent_id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 80) };
  }
}

export async function armTakeProfit(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  request: ArmTakeProfitRequest;
}): Promise<ArmedTakeProfitResult> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");

  // Beacon the intent BEFORE asking Phantom to sign. Best-effort:
  // failure here is logged but does NOT abort the arm — the signed
  // arm is the authoritative path; intent is the safety-net record.
  // Operator-mandated 2026-06-16 PM.
  postArmIntent({
    botApiUrl: args.botApiUrl,
    wallet: args.signerPubkey,
    loanIdChain: args.request.loanIdChain,
    request: args.request,
  }).catch((e) => {
    console.warn(
      "[arm] intent beacon failed (continuing to signed arm):",
      e instanceof Error ? e.message : String(e),
    );
  });

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

/* ────────────────────────────────────────────────────────────────
 * Batch arming — operator-mandated NON-NEGOTIABLE 2026-06-16 PM
 * (feedback_one_signature_for_n_legs_always.md). One Phantom signature
 * arms ALL legs of a multi-leg ladder atomically. Replaces the
 * N-popups-for-N-legs pattern that caused silent leg-drops on loans
 * 798 + 802 when Phantom sessions died between sequential signs.
 *
 * Each leg specifies: direction, kind (price_usd/mc_usd/price_sol),
 * value (the literal price/mc number — converted to micros here),
 * slice_pct_bps, slippage_bps.
 *
 * Returns the resolved order ids in batch order so the caller can
 * map them back onto their picker leg list.
 * ──────────────────────────────────────────────────────────────── */

export interface ArmBatchLegSpec {
  direction: "above" | "below";
  /**
   * Trigger kind. Either a literal price_usd / mc_usd / price_sol (in
   * which case `value` is the literal number to convert to micros), or
   * `multiplier` (in which case `value` is the multiplier and the bot
   * resolves it against the cross-source oracle at batch time).
   */
  kind: "price_usd" | "mc_usd" | "price_sol" | "multiplier";
  value: number;            // literal price OR multiplier (e.g. 2 for 2x)
  sliceBps: number;         // 1..10000
  slippageBps?: number;     // default 200 for above, 300 for below
  expire?: string;          // ISO timestamp
  intent_id?: number;       // optional pending intent to reconcile
}

export interface ArmBatchResult {
  ok: true;
  order_ids: number[];
  ladder_group_ids: { above: string | null; below: string | null };
  legs: Array<{
    orderId: number;
    direction: "above" | "below";
    triggerKind: string;
    triggerValueMicro: string;
    slicePctBps: number;
    slippageBps: number;
  }>;
  /**
   * Tier-2 architectural defense (B in
   * feedback_loan_830_full_postmortem_and_defenses.md). When true, the
   * batch arm was queued on the server because the borrow's DB-write
   * hadn't landed yet. The pending-arm watcher will replay every 10s
   * until orders land OR the signature freshness window (5 min)
   * elapses. UI should switch the loan card to an "Arming…" state and
   * poll the dashboard until the orders appear — NO recovery banner
   * until envelope expires.
   */
  pending?: boolean;
  pending_arm_id?: number;
  envelope_expires_at_ms?: number;
  retry_in_ms?: number;
}

function buildArmBatchMessage(args: {
  from: string;
  loanIdChain: string;
  legs: ArmBatchLegSpec[];
  nonce: string;
  issuedAt: string;
}): string {
  // Compact JSON shape on the wire — bot parses Legs as JSON.
  // For multiplier kind, send the raw multiplier (e.g. 2.0 for 2x) and
  // the bot resolves it through the cross-source oracle. For literal
  // price/mc/sol kinds, send micros.
  const wireLegs = args.legs.map((l) => {
    if (l.kind === "multiplier") {
      return {
        d: l.direction,
        k: "multiplier",
        v: String(l.value),
        multiplier: l.value,
        s: l.sliceBps,
        slip: l.slippageBps ?? (l.direction === "below" ? 300 : 200),
        ...(l.expire ? { exp: l.expire } : {}),
      };
    }
    const valueMicro = Math.round(l.value * 1e6);
    return {
      d: l.direction,
      k: l.kind,
      v: String(valueMicro),
      s: l.sliceBps,
      slip: l.slippageBps ?? (l.direction === "below" ? 300 : 200),
      ...(l.expire ? { exp: l.expire } : {}),
    };
  });
  const lines = [
    "magpie: limit-close-arm-batch/v1",
    `From: ${args.from}`,
    `LoanId: ${args.loanIdChain}`,
    `Legs: ${JSON.stringify(wireLegs)}`,
    `Nonce: ${args.nonce}`,
    `IssuedAt: ${args.issuedAt}`,
  ];
  return lines.join("\n");
}

/**
 * A batch arm envelope that has already been SIGNED by the wallet but not
 * yet submitted to the bot. Produced by {@link prepareArmBatch} and consumed
 * by {@link submitArmBatch}. Splitting sign-from-submit lets the borrow flow
 * collect the arm signature back-to-back with the borrow signature (both
 * wallet prompts before the cosign/confirm pause), then POST the pre-signed
 * envelope only after the loan has actually landed on-chain — so V4 users
 * never hit a surprise "second approval" after a long confirmation wait.
 *
 * The server's freshness window is 5 min (FRESH_WINDOW_MS), and a borrow
 * confirms in ~15-45s, so the pre-signed envelope is always well within the
 * staleness wall by submit time.
 */
export interface SignedArmBatch {
  botApiUrl: string;
  signedMessageBase64: string;
  signatureBase58: string;
  signerPubkey: string;
  intent_ids: (number | null)[];
  loanIdChain: string;
  legCount: number;
  issuedAtMs: number;
}

/**
 * Post intents, build the batch message, and ask the wallet to sign it —
 * but do NOT submit to the bot. Returns a {@link SignedArmBatch} to hand to
 * {@link submitArmBatch} once the borrow has confirmed. This is the "prompt"
 * half; no on-chain loan is required to exist yet (the LoanId is derived
 * pre-borrow), which is exactly what lets us collect both signatures up front.
 */
export async function prepareArmBatch(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  loanIdChain: string;
  legs: ArmBatchLegSpec[];
}): Promise<SignedArmBatch> {
  if (!args.botApiUrl) throw new Error("Bot API URL not configured");
  if (args.legs.length === 0) {
    throw new Error("prepareArmBatch requires at least one leg");
  }
  if (args.legs.length > 8) {
    throw new Error("prepareArmBatch max 8 legs per batch");
  }

  // Beacon every leg as an intent BEFORE asking Phantom to sign. Best-
  // effort — if any intent post fails the signed batch still proceeds.
  // We capture the returned intent_id per leg and thread it into the
  // batch request body so the server can mark each intent armed when the
  // matching insert lands (otherwise intents stay 'pending' forever even
  // when the legs arm cleanly — observability lie).
  const intentResults = await Promise.all(
    args.legs.map((l) =>
      postArmIntent({
        botApiUrl: args.botApiUrl,
        wallet: args.signerPubkey,
        loanIdChain: args.loanIdChain,
        request: {
          from: args.signerPubkey,
          loanIdChain: args.loanIdChain,
          direction: l.direction,
          target:
            l.kind === "price_usd"
              ? { kind: "price_usd", usd: l.value }
              : l.kind === "mc_usd"
                ? { kind: "mc_usd", mcDollars: l.value }
                : { kind: "multiplier", multiplier: l.value },
          slippageBps: l.slippageBps,
          sellDestination: "sol",
          slicePctBps: l.sliceBps < 10000 ? l.sliceBps : undefined,
        },
      }).catch(() => ({ ok: false as const, intent_id: undefined })),
    ),
  );
  args.legs.forEach((l, i) => {
    if (l.intent_id == null && intentResults[i]?.ok && intentResults[i].intent_id != null) {
      l.intent_id = intentResults[i].intent_id;
    }
  });

  const nonce = randomNonceHex();
  const issuedAt = new Date().toISOString();
  const messageText = buildArmBatchMessage({
    from: args.signerPubkey,
    loanIdChain: args.loanIdChain,
    legs: args.legs,
    nonce,
    issuedAt,
  });

  const messageBytes = new TextEncoder().encode(messageText);
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

  // Surface any intent_ids the caller passed so the server can
  // reconcile each one atomically with the matching insert.
  const intent_ids = args.legs.map((l) => l.intent_id ?? null);

  return {
    botApiUrl: args.botApiUrl,
    signedMessageBase64: bytesToBase64(messageBytes),
    signatureBase58: bs58.encode(signature),
    signerPubkey: args.signerPubkey,
    intent_ids,
    loanIdChain: args.loanIdChain,
    legCount: args.legs.length,
    issuedAtMs: Date.parse(issuedAt),
  };
}

/**
 * Submit a pre-signed {@link SignedArmBatch} to the bot. No wallet
 * interaction — pure network. Call this after the borrow has confirmed.
 */
export async function submitArmBatch(signed: SignedArmBatch): Promise<ArmBatchResult> {
  const allNullIntents = signed.intent_ids.every((x) => x == null);
  const res = await fetch(
    `${signed.botApiUrl.replace(/\/$/, "")}/api/v1/site/limit-close/arm-batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signedMessageBase64: signed.signedMessageBase64,
        signatureBase58: signed.signatureBase58,
        signerPubkey: signed.signerPubkey,
        ...(allNullIntents ? {} : { intent_ids: signed.intent_ids }),
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(translateArmError(body) + (body.failed_leg_index != null ? ` (leg ${body.failed_leg_index + 1})` : ""));
  }
  return body as ArmBatchResult;
}

export async function armTakeProfitBatch(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  loanIdChain: string;
  legs: ArmBatchLegSpec[];
}): Promise<ArmBatchResult> {
  const signed = await prepareArmBatch(args);
  return submitArmBatch(signed);
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
