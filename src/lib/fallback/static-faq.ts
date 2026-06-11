/**
 * Static FAQ fallback — third tier below Claude.
 *
 * Activation chain:
 *   Bot up   → siteAiChatStream (full Pip, all tools)
 *   Bot down → /api/fallback/chat → Claude with cached knowledge
 *   Bot down + Claude down → matchStaticFaq() returns a hardcoded answer
 *
 * The static answers cover the most common Magpie questions users
 * actually ask. They're truthful and brief — same tone as the
 * fallback knowledge base. When matched, Pip emits a single response
 * with a footer noting Pip is in extra-limited mode, so the user
 * knows to retry later for deeper questions.
 *
 * Matching is keyword-based with a small ranking so partial matches
 * don't trigger generic answers. We never claim to fully answer the
 * user's question — we hand them what we KNOW, then point them at
 * the TG bot for anything else.
 */

export interface StaticFaqMatch {
  answer: string;
  matchedIntent: string;
  confidence: "high" | "medium" | "low";
}

interface Intent {
  id: string;
  // All keywords must appear (logical AND) for the intent to match.
  // Use array-of-arrays for "any of these phrases" semantics.
  keywords: (string | string[])[];
  answer: string;
}

const INTENTS: Intent[] = [
  {
    id: "what_is_magpie",
    keywords: [["what is magpie", "tell me about magpie", "how does magpie work", "explain magpie"]],
    answer:
      "Magpie is a permissionless lending protocol on Solana. You post SPL tokens as collateral and borrow SOL from a shared pool. Three tiers: Express (30% LTV, 2d, 3% fee), Quick (25% LTV, 3d, 2% fee), Standard (20% LTV, 7d, 1.5% fee). No interest — just the upfront tier fee. Repay anytime, get your collateral back.",
  },
  {
    id: "fees",
    keywords: [["fee", "fees", "cost", "how much does it cost"]],
    answer:
      "Magpie charges a one-time fee at borrow, based on the loan tier: Express 3%, Quick 2%, Standard 1.5%. No ongoing interest. If you let a loan go past due, it gets liquidated (someone repays it for you in exchange for your collateral).",
  },
  {
    id: "tiers_ltv",
    keywords: [["ltv", "tier", "tiers", "duration", "loan size"]],
    answer:
      "Three tiers, trading off duration for LTV: Express (30% LTV / 2 days), Quick (25% LTV / 3 days), Standard (20% LTV / 7 days). Higher LTV = more SOL per dollar of collateral but shorter window before liquidation.",
  },
  {
    id: "liquidation",
    keywords: [["liquidat", "liquidation", "what happens if i don't repay", "past due"]],
    answer:
      "A loan is liquidatable when (1) its due_at timestamp passes, OR (2) the collateral's value drops to where the LTV exceeds the liquidation threshold. Anyone can liquidate a past-due loan — they get a small keeper reward, the lender is repaid, and the borrower keeps any surplus.",
  },
  {
    id: "collateral",
    keywords: [["collateral", "what can i use", "supported tokens", "what tokens"]],
    answer:
      "Approved memecoins on Solana, plus Backed Finance xStocks (stocks, ETFs, metals) routed through a separate RWA pool. The full list is in /supported on the Telegram bot.",
  },
  {
    id: "magpie_token",
    keywords: [["$magpie", "magpie token", "tokenomics", "buy magpie"]],
    answer:
      "$MAGPIE is the protocol token. Holders get fee discounts and a share of protocol revenue via the LP-loyalty distribution. Launched March 2026.",
  },
  {
    id: "telegram_vs_dashboard",
    keywords: [["telegram", "tg bot", "dashboard", "non-custodial", "custodial"]],
    answer:
      "Two ways to use Magpie: (1) Telegram bot @magpie_capital_bot — custodial, the bot holds an encrypted keypair for you, simpler UX. (2) Dashboard at magpie.capital — non-custodial, connect Phantom/Solflare/etc and sign your own txs.",
  },
  {
    id: "limit_close",
    keywords: [["limit close", "limitclose", "take profit", "auto sell", "limit order"]],
    answer:
      "Set a take-profit on a Telegram loan with /limitclose. When your collateral hits a target market cap or price, the engine auto-repays the loan and sells the collateral. Slippage caps are enforced and the protocol takes a 1% fee on proceeds.",
  },
  {
    id: "wallet_connection",
    keywords: [["how do i connect", "connect wallet", "phantom", "solflare"]],
    answer:
      "Open magpie.capital → click 'Connect Wallet' top-right → pick Phantom, Solflare, Backpack, or whatever you have. The dashboard is non-custodial — your keys never leave the wallet.",
  },
  {
    id: "deposit_lp",
    keywords: [["deposit", "lp", "earn yield", "lend", "lending pool"]],
    answer:
      "Deposit SOL into the LendingPool to earn the borrower-side fees. Your shares appreciate in real terms as borrowers pay fees. Withdraw anytime via /withdraw on Telegram or the dashboard.",
  },
  {
    id: "credit_score",
    keywords: [["credit score", "creditworthy", "credit"]],
    answer:
      "Magpie tracks your borrow + repay history into a credit score (0-100). Higher score = lower fees and bigger limits over time. Repay on time, don't get liquidated. Check yours with /credit on the bot.",
  },
  {
    id: "is_it_safe",
    keywords: [["safe", "audit", "secure", "trust", "risk"]],
    answer:
      "The lending program is on-chain Anchor code; logs + exploits are publicly auditable. Defense in depth at multiple layers (oracle attestations, slippage caps, anti-exploit gauntlet on borrow). No yield strategy is risk-free, especially with memecoin collateral — borrow what you can afford to repay and watch your due dates.",
  },
];

const HEDGE_FOOTER =
  "\n\n(Pip is in extra-limited mode right now — the main backend AND the AI service are both unreachable. This was the best answer I could give from cached info. Try again in a couple of minutes, OR use the Telegram bot @magpie_capital_bot for anything urgent.)";

const NO_MATCH_FALLBACK =
  "Magpie's AI service is temporarily unreachable, on top of the main backend being down. I can answer basics about Magpie (lending tiers, fees, how it works) — try rephrasing your question with one of those keywords. " +
  "Or use the Telegram bot @magpie_capital_bot for anything that needs live data." +
  HEDGE_FOOTER;

/**
 * Match a user message against the static FAQ. Returns the best
 * intent's answer + a confidence tier, or null if nothing matched.
 *
 * Confidence:
 *   - high: 2+ phrase matches
 *   - medium: 1 phrase match
 *   - low: keyword overlap only (we return the no-match fallback)
 */
export function matchStaticFaq(message: string): StaticFaqMatch {
  const lower = message.toLowerCase();
  let best: { intent: Intent; hits: number } | null = null;
  for (const intent of INTENTS) {
    let hits = 0;
    for (const k of intent.keywords) {
      if (Array.isArray(k)) {
        if (k.some((phrase) => lower.includes(phrase.toLowerCase()))) hits++;
      } else if (lower.includes(k.toLowerCase())) {
        hits++;
      }
    }
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { intent, hits };
    }
  }
  if (!best) {
    return {
      answer: NO_MATCH_FALLBACK,
      matchedIntent: "no_match",
      confidence: "low",
    };
  }
  return {
    answer: best.intent.answer + HEDGE_FOOTER,
    matchedIntent: best.intent.id,
    confidence: best.hits >= 2 ? "high" : "medium",
  };
}
