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
 * Mint a fresh Pip session via signed message. Prompts Phantom once.
 * Caches the token in localStorage for re-use.
 */
export async function mintPipSession(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
}): Promise<CachedSession> {
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
  // Prefer Bearer if we have a cached session.
  let session = readCachedSession(args.signerPubkey);
  if (!session) {
    // Mint a new one — this triggers Phantom ONCE for the day.
    session = await mintPipSession(args);
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
  // and retry once. This handles the edge case where our cached
  // expiry math doesn't line up with the server's.
  if (status === 401) {
    clearCachedSession(args.signerPubkey);
    session = await mintPipSession(args);
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
