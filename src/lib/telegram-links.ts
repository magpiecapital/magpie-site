/**
 * Single source of truth for Magpie's two Telegram surfaces.
 *
 * IMPORTANT — these are NOT interchangeable. Anywhere on the site that
 * mentions Telegram MUST be clear about which surface it means.
 *
 *   1. The BOT (@magpie_capital_bot) — your private 1:1 with the bot.
 *      Holds your wallet, processes your loans, runs Pip's AI agent.
 *      Anyone using Magpie has one of these. No one else can see it.
 *
 *   2. The COMMUNITY group (@magpietalk) — public group chat.
 *      Discussion, questions, announcements, hanging out with other
 *      Magpie users. Moderated. Optional — you can use the protocol
 *      without ever joining.
 *
 * Common mistake to avoid: a generic "Telegram" link that ambiguously
 * points to either. Always include a 1-line "what this is" descriptor
 * next to the link.
 */

export const TELEGRAM_BOT = {
  url: "https://t.me/magpie_capital_bot",
  handle: "@magpie_capital_bot",
  label: "Open the bot",
  description: "Your private 1:1 wallet bot — borrow, repay, manage loans",
  shortDescription: "Your wallet bot",
} as const;

export const TELEGRAM_COMMUNITY = {
  url: "https://t.me/magpietalk",
  handle: "@magpietalk",
  label: "Join the community",
  description: "Public chat — discussion, questions, announcements",
  shortDescription: "Community group",
} as const;

/**
 * Back-compat alias: existing code uses `TELEGRAM_URL` expecting it to
 * point at the BOT (the original / main TG surface). Keep that behavior
 * to avoid silently changing what every "Open Telegram" CTA does.
 * NEW code should import TELEGRAM_BOT or TELEGRAM_COMMUNITY directly so
 * the intent is explicit at the call site.
 */
export const TELEGRAM_URL = TELEGRAM_BOT.url;
