/**
 * Site → bot bridge for /api/v1/ai/chat.
 *
 * Two paths:
 *   1. mintPipSession() — user signs ONE "Sign in to Pip" message
 *      and gets back a 24h Bearer token. Cached in localStorage
 *      under "magpie-pip-session:<wallet>".
 *   2. siteAiChat() — if a valid session token is cached, sends the
 *      chat with Authorization: Bearer (no Phantom prompt). Falls
 *      back to per-message signature if no token exists.
 */
import bs58 from "bs58";

export interface SignMessageFn {
  (message: Uint8Array): Promise<Uint8Array>;
}

/**
 * A repay action Pip proposed in this response. The site renders this
 * as an inline confirm card; the borrower's wallet does the actual
 * signing. Pip never executes — this is just data.
 */
export interface ProposedRepayAction {
  type: "repay";
  loan_id: string;
  loan_pda: string;
  program_id: string;
  collateral_mint: string;
  collateral_symbol: string | null;
  collateral_amount_raw: string;
  collateral_decimals: number;
  owed_lamports: string;
  owed_sol: string;
  fee_lamports: string;
  fee_sol: string;
  due_at_utc: string;
  hours_to_due: string;
  past_due: boolean;
  expires_at: number;
}

export interface ProposedBorrowAction {
  type: "borrow";
  collateral_mint: string;
  collateral_symbol: string;
  collateral_decimals: number;
  collateral_amount_raw: string;
  collateral_ui_amount: string;
  collateral_value_lamports: string;
  tier_option: 0 | 1 | 2;
  tier_label: string;
  ltv_pct: number;
  duration_days: number;
  fee_bps: number;
  principal_lamports: string;
  principal_sol: string;
  fee_lamports: string;
  fee_sol: string;
  received_lamports: string;
  received_sol: string;
  due_at_utc: string;
  expires_at: number;
}

export interface ProposedTopupAction {
  type: "topup";
  loan_id: string;
  loan_pda: string;
  program_id: string;
  collateral_mint: string;
  collateral_symbol: string | null;
  collateral_decimals: number;
  extra_amount_raw: string;
  extra_ui_amount: string;
  current_collateral_raw: string;
  expires_at: number;
}

export interface ProposedExtendAction {
  type: "extend";
  loan_id: string;
  loan_pda: string;
  program_id: string;
  collateral_symbol: string | null;
  duration_days: number;
  est_fee_sol: string;
  current_due_at_utc: string;
  new_due_at_utc: string;
  expires_at: number;
}

export interface ProposedPartialRepayAction {
  type: "partial_repay";
  loan_id: string;
  loan_pda: string;
  program_id: string;
  collateral_symbol: string | null;
  repay_lamports: string;
  repay_sol: string;
  owed_lamports_before: string;
  owed_sol_before: string;
  owed_lamports_after: string;
  owed_sol_after: string;
  expires_at: number;
}

export type ProposedAction =
  | ProposedRepayAction
  | ProposedBorrowAction
  | ProposedTopupAction
  | ProposedExtendAction
  | ProposedPartialRepayAction;

export interface AiChatResult {
  response: string;
  blockedReason?: string | null;
  spendCapped?: boolean;
  escalatedTicketId?: number | null;
  proposedAction?: ProposedAction | null;
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

/* ─────────────── Pip session token ─────────────── */

const SESSION_STORAGE_PREFIX = "magpie-pip-session:";

interface CachedSession {
  token: string;
  expiresAt: number; // ms
  pubkey: string;
}

function readCachedSession(pubkey: string): CachedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_PREFIX + pubkey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (parsed.pubkey !== pubkey) return null;
    // Treat anything within 5 min of expiry as expired so we
    // re-mint before failing.
    if (parsed.expiresAt - Date.now() < 5 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSession(s: CachedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_PREFIX + s.pubkey, JSON.stringify(s));
  } catch {
    /* quota / blocked — bearer path won't work, falls back to signed */
  }
}

export function clearCachedSession(pubkey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_PREFIX + pubkey);
  } catch { /* silent */ }
}

/** Returns the cached session's expiry timestamp (ms) or null. */
export function getCachedSessionExpiry(pubkey: string): number | null {
  const s = readCachedSession(pubkey);
  return s?.expiresAt ?? null;
}

/**
 * Distinct error class for "the bot doesn't have the session endpoint
 * yet" — lets siteAiChat fall back to the per-message signed path
 * instead of failing the whole chat.
 */
export class PipSessionEndpointUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipSessionEndpointUnavailableError";
  }
}

/**
 * Probe whether the bot exposes /api/v1/auth/pip-session as a public
 * route. We cache the result per pageload so we don't probe twice.
 */
let _sessionEndpointAvailable: boolean | null = null;
async function checkSessionEndpointAvailable(botApiUrl: string): Promise<boolean> {
  if (_sessionEndpointAvailable !== null) return _sessionEndpointAvailable;
  try {
    // OPTIONS preflight will tell us if the route exists + is public.
    // A POST with an empty body returns 400 "missing fields" if the
    // route is public, or 401 "Invalid or missing API key" if the
    // route hits the API-key auth gate (bot not yet redeployed).
    const r = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/auth/pip-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await r.json().catch(() => ({}));
    // 400 = endpoint exists and is public, we just sent bad fields.
    // 401 with "Invalid or missing API key" = endpoint isn't public yet.
    if (r.status === 400) {
      _sessionEndpointAvailable = true;
    } else if (r.status === 401 && /api key/i.test(body?.error || "")) {
      _sessionEndpointAvailable = false;
    } else if (r.status === 404) {
      _sessionEndpointAvailable = false;
    } else {
      // Anything else we treat as "available" — the endpoint
      // responded with SOMETHING that wasn't an auth-gate rejection.
      _sessionEndpointAvailable = true;
    }
  } catch {
    // Network error — assume unavailable so we use the safer path.
    _sessionEndpointAvailable = false;
  }
  return _sessionEndpointAvailable;
}

/**
 * Mint a fresh Pip session via signed message. Prompts Phantom once.
 * Caches the token in localStorage for re-use.
 *
 * Throws PipSessionEndpointUnavailableError if the bot hasn't deployed
 * the session endpoint yet — callers should fall back to per-message
 * signing in that case.
 */
export async function mintPipSession(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
}): Promise<CachedSession> {
  // Probe FIRST so we don't ask the user to sign a session message
  // that the bot can't validate.
  const available = await checkSessionEndpointAvailable(args.botApiUrl);
  if (!available) {
    throw new PipSessionEndpointUnavailableError("pip-session endpoint not deployed yet");
  }

  const payload = {
    magpie: "pip-session/v1",
    nonce: randomNonceHex(),
    issuedAt: new Date().toISOString(),
  };
  const messageBytes = new TextEncoder().encode(JSON.stringify(payload));
  let signature: Uint8Array;
  try {
    signature = await args.signMessage(messageBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Wallet declined to sign: ${msg}`);
  }
  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/auth/pip-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedMessageBase64: bytesToBase64(messageBytes),
      signatureBase58: bs58.encode(signature),
      signerPubkey: args.signerPubkey,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.token) {
    throw new Error(body?.error || `Session mint failed (HTTP ${res.status})`);
  }
  const session: CachedSession = {
    token: body.token,
    expiresAt: Date.now() + (body.expires_in_seconds || 86400) * 1000,
    pubkey: args.signerPubkey,
  };
  writeCachedSession(session);
  return session;
}

/* ─────────────── Chat (Bearer first, signed fallback) ─────────────── */

export async function siteAiChat(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  message: string;
  /** Optional page context — e.g. "/tokens", "/dashboard". Helps
   *  Pip respond more usefully ("you're on the tokens page, so..."). */
  pageContext?: string;
}): Promise<AiChatResult> {
  // Try the Bearer-token path first.
  let session = readCachedSession(args.signerPubkey);
  if (!session) {
    try {
      session = await mintPipSession(args);
    } catch (e) {
      if (e instanceof PipSessionEndpointUnavailableError) {
        // Bot hasn't deployed the session endpoint yet — fall back to
        // per-message signing. UX worse (one Phantom prompt per
        // message) but functional.
        return siteAiChatSignedFallback(args);
      }
      throw e;
    }
  }

  const callWithToken = async (token: string) => {
    const r = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "chat",
        message: args.message,
        page_context: args.pageContext ?? null,
      }),
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  };

  let { status, body } = await callWithToken(session.token);

  // If the bot says the token is expired/invalid, mint a fresh one
  // and retry once. Handles edge cases where the cached expiry
  // math doesn't line up with the server's, or the HMAC secret
  // rotated on a redeploy.
  if (status === 401) {
    clearCachedSession(args.signerPubkey);
    try {
      session = await mintPipSession(args);
    } catch (e) {
      if (e instanceof PipSessionEndpointUnavailableError) {
        return siteAiChatSignedFallback(args);
      }
      throw e;
    }
    ({ status, body } = await callWithToken(session.token));
  }

  if (status !== 200) {
    throw new Error(body?.error || `Chat failed (HTTP ${status})`);
  }
  return {
    response: body.response,
    blockedReason: body.blocked_reason ?? null,
    spendCapped: !!body.spend_capped,
    escalatedTicketId: body.escalated_ticket_id ?? null,
    proposedAction: body.proposed_action ?? null,
  };
}

/* ─────────────── Streaming chat ─────────────── */

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; names: string[] }
  | { type: "replace"; text: string; gated?: string }
  | { type: "done"; result: AiChatResult }
  | { type: "error"; status?: number; text: string };

/**
 * Streaming variant of siteAiChat. Reads NDJSON from
 * /api/v1/ai/chat/stream and calls onEvent for every parsed frame —
 * the floating chat panel appends each text delta to the in-flight
 * agent bubble so Pip's response renders as it generates.
 *
 * Falls back to the non-streaming siteAiChat() if the stream endpoint
 * returns 404 (bot hasn't deployed yet) or 401 with no recoverable
 * session.
 */
export async function siteAiChatStream(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  message: string;
  pageContext?: string;
  onEvent: (e: StreamEvent) => void;
}): Promise<AiChatResult> {
  // Bearer-first, same as siteAiChat.
  let session = readCachedSession(args.signerPubkey);
  if (!session) {
    try {
      session = await mintPipSession(args);
    } catch (e) {
      if (e instanceof PipSessionEndpointUnavailableError) {
        // Bot doesn't have session endpoint — non-streaming fallback.
        const result = await siteAiChat(args);
        args.onEvent({ type: "done", result });
        return result;
      }
      throw e;
    }
  }

  const callStream = async (token: string): Promise<{ status: number; result: AiChatResult | null }> => {
    const r = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Accept": "application/x-ndjson",
      },
      body: JSON.stringify({
        action: "chat",
        message: args.message,
        page_context: args.pageContext ?? null,
      }),
    });

    if (r.status === 404) {
      // Endpoint not deployed yet — caller should fall back.
      return { status: 404, result: null };
    }
    if (r.status === 401) {
      return { status: 401, result: null };
    }

    if (!r.body) {
      // Browser didn't expose a stream reader — treat as a JSON response.
      const body = await r.json().catch(() => ({}));
      const result: AiChatResult = {
        response: body?.result?.response ?? body?.response ?? "",
        blockedReason: body?.result?.blocked_reason ?? null,
        spendCapped: !!body?.result?.spend_capped,
        escalatedTicketId: body?.result?.escalated_ticket_id ?? null,
        proposedAction: body?.result?.proposed_action ?? null,
      };
      args.onEvent({ type: "done", result });
      return { status: r.status, result };
    }

    // Read NDJSON stream
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let finalResult: AiChatResult | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let evt: StreamEvent;
        try { evt = JSON.parse(line); }
        catch { continue; }

        if (evt.type === "done") {
          // The on-wire shape uses snake_case + raw types — normalize
          // to the camelCase AiChatResult the rest of the UI expects.
          const raw = ((evt as unknown) as { type: "done"; result: Record<string, unknown> }).result || {};
          finalResult = {
            response: (raw.response as string) ?? "",
            blockedReason: (raw.blocked_reason as string | null) ?? null,
            spendCapped: !!raw.spend_capped,
            escalatedTicketId: typeof raw.escalated_ticket_id === "number" ? raw.escalated_ticket_id : null,
            proposedAction: (raw.proposed_action as ProposedAction | null) ?? null,
          };
          args.onEvent({ type: "done", result: finalResult });
        } else {
          args.onEvent(evt);
        }
      }
    }
    return { status: r.status, result: finalResult };
  };

  let { status, result } = await callStream(session.token);

  if (status === 404) {
    // Stream endpoint not deployed — use the non-streaming path.
    const fallback = await siteAiChat(args);
    args.onEvent({ type: "done", result: fallback });
    return fallback;
  }

  if (status === 401) {
    clearCachedSession(args.signerPubkey);
    try {
      session = await mintPipSession(args);
    } catch (e) {
      if (e instanceof PipSessionEndpointUnavailableError) {
        const fallback = await siteAiChat(args);
        args.onEvent({ type: "done", result: fallback });
        return fallback;
      }
      throw e;
    }
    ({ status, result } = await callStream(session.token));
  }

  if (!result) {
    throw new Error(`Streaming chat failed (HTTP ${status})`);
  }
  // After the null-guard above TS narrows to AiChatResult.
  return result as AiChatResult;
}

/**
 * Legacy per-message signing path. Used as fallback when the session
 * endpoint isn't deployed yet. Triggers a Phantom prompt per message.
 */
async function siteAiChatSignedFallback(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
  message: string;
  pageContext?: string;
}): Promise<AiChatResult> {
  const body = await postSigned(
    "/api/v1/ai/chat",
    {
      magpie: "ai-chat/v1",
      action: "chat",
      message: args.message,
      page_context: args.pageContext ?? null,
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
    proposedAction: body.proposed_action ?? null,
  };
}

export async function siteAiReset(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
}): Promise<void> {
  // Use the Bearer token if available — same UX as chat (no prompt).
  let session = readCachedSession(args.signerPubkey);
  if (!session) {
    session = await mintPipSession(args);
  }
  const res = await fetch(`${args.botApiUrl.replace(/\/$/, "")}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.token}`,
    },
    body: JSON.stringify({ action: "reset" }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || `Reset failed (HTTP ${res.status})`);
  }
}
