/**
 * Web-push subscription client.
 *
 * Registers the service worker, obtains a PushSubscription from the browser,
 * and registers it with the bot under a wallet signature.
 *
 * WHY IT IS SIGNED. A push subscription is a delivery capability. If subscribing
 * were keyed only by wallet address — which is public — anyone could subscribe
 * THEIR browser against SOMEONE ELSE'S wallet and receive that person's loan
 * notifications. The envelope is signed by the wallet itself.
 *
 * WHY THE ENVELOPE CARRIES AN ENDPOINT HASH. A signature that merely said "let
 * me subscribe" could be captured off the wire and replayed with a different
 * endpoint attached. Including SHA-256(endpoint) in the SIGNED bytes means the
 * signature authorises exactly one endpoint; the server recomputes the hash from
 * the submitted subscription and rejects any mismatch.
 *
 * The message uses the same human-readable "Header: value" format as the arm and
 * withdraw envelopes, so a wallet that displays the message shows something a
 * person can actually read before approving.
 */
import bs58 from "bs58";

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

export type PushSupport =
  | "ok"
  /** Browser has no service worker / push API — common in in-app wallet browsers. */
  | "unsupported"
  /** User previously blocked notifications; only they can undo it, in browser settings. */
  | "denied"
  /** Server has no VAPID key configured. */
  | "disabled";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function randomNonceHex(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  // Copy into a freshly-allocated ArrayBuffer. TextEncoder returns
  // Uint8Array<ArrayBufferLike>, which may be backed by a SharedArrayBuffer and
  // so isn't assignable to BufferSource under current lib.dom types.
  const encoded = new TextEncoder().encode(text);
  const buf = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buf).set(encoded);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Returns an ArrayBuffer rather than a Uint8Array: `applicationServerKey` is
 * typed as BufferSource, and a Uint8Array<ArrayBufferLike> (which may be backed
 * by a SharedArrayBuffer) is not assignable to it under current lib.dom types.
 */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

/**
 * Can this browser do web push at all?
 *
 * Returns "unsupported" inside most in-app wallet browsers, which is expected
 * and must be surfaced honestly rather than shown as an error — telling someone
 * their browser is broken when it simply lacks the API is worse than saying
 * nothing.
 */
export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

/** Is this browser already subscribed? Used to render the right state. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  try {
    if (checkPushSupport() !== "ok") return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function fetchVapidKey(botApiUrl: string): Promise<string | null> {
  try {
    const r = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/push/vapid-public-key`);
    const b = await r.json();
    return b?.enabled && typeof b.public_key === "string" ? b.public_key : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe this browser to loan-expiry warnings.
 * Throws with a human-readable message on failure.
 */
export async function subscribeToPush(args: {
  botApiUrl: string;
  signerPubkey: string;
  signMessage: SignMessageFn;
}): Promise<void> {
  const { botApiUrl, signerPubkey, signMessage } = args;
  if (!botApiUrl) throw new Error("Bot API URL not configured");

  const support = checkPushSupport();
  if (support === "denied") {
    throw new Error(
      "Notifications are blocked for this site. Re-enable them in your browser settings, then try again.",
    );
  }
  if (support !== "ok") {
    throw new Error("This browser doesn't support notifications. Try a desktop browser.");
  }

  const vapidKey = await fetchVapidKey(botApiUrl);
  if (!vapidKey) throw new Error("Notifications aren't enabled on the server yet.");

  // Ask permission BEFORE registering anything, so a decline leaves no residue.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications weren't allowed, so we can't warn you before a loan expires.");
  }

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  // Reuse the existing subscription if there is one; re-subscribing the same
  // browser should refresh the server row, not create a second one.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(vapidKey),
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("The browser returned an incomplete subscription.");
  }

  // The signed bytes commit to THIS endpoint — see the file header.
  const lines = [
    "magpie: push-subscribe-v1",
    `From: ${signerPubkey}`,
    `EndpointHash: ${await sha256Hex(endpoint)}`,
    `Nonce: ${randomNonceHex()}`,
    `IssuedAt: ${new Date().toISOString()}`,
  ];
  const messageBytes = new TextEncoder().encode(lines.join("\n"));

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

  const res = await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signerPubkey,
      signatureBase58: bs58.encode(signature),
      signedMessageBase64: bytesToBase64(messageBytes),
      subscription: { endpoint, keys: { p256dh, auth } },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.ok) {
    if (body?.error === "wallet_not_linked") {
      throw new Error("This wallet has no Magpie account yet. Open a loan first.");
    }
    throw new Error(body?.error || `Couldn't enable notifications (HTTP ${res.status})`);
  }
}

/**
 * Unsubscribe this browser. Best-effort on the server side: the local
 * subscription is dropped regardless, because a user who turns notifications
 * off must never still receive them.
 */
export async function unsubscribeFromPush(botApiUrl: string): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await fetch(`${botApiUrl.replace(/\/$/, "")}/api/v1/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    /* server unreachable — still drop it locally below */
  }
  await sub.unsubscribe().catch(() => {});
}
