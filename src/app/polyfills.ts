import { Buffer } from "buffer";

// Solana libraries expect Buffer to be available globally in the browser.
// Next.js does not polyfill it, so we do it here — this file must be
// imported before any Solana code runs.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).Buffer = Buffer;
}
