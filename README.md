# Magpie Capital — Site

The web app for [Magpie Capital](https://magpie.capital) — a permissionless Solana lending protocol. Borrow SOL against approved memecoins and tokenized stocks, manage loans, deposit into the LP pool, and verify protocol state on-chain.

## Official accounts

- **Site** (this repo) — [magpie.capital](https://magpie.capital)
- **Wallet bot** — [@magpie_capital_bot](https://t.me/magpie_capital_bot) · private 1:1 with the bot, holds your Magpie wallet
- **Community** — [@magpietalk](https://t.me/magpietalk) · public group chat
- **X** — [@MagpieLoans](https://x.com/MagpieLoans)

Anything claiming to be Magpie outside these four is impersonation.

## What the site does

The site mirrors most of what the Telegram bot does, plus a dashboard view:

- **Borrow** — pick a tier, pick collateral, get SOL co-signed in seconds
- **Repay / extend / top-up** — manage active loans
- **Earn** — deposit SOL into the LP pool
- **Stats** — live protocol numbers (active loans, repaid, liquidated, LP TVL)
- **Tokens** — approved collateral with live prices and tier limits
- **Credit** — your 300-850 on-chain credit score

Most user actions are co-signed by the protocol's authority so they execute in one click without a wallet popup per step.

## Stack

- **Next.js 16** (App Router) on **Vercel**
- **Tailwind 4**
- **@solana/wallet-adapter-react** for wallet connection
- **PostgreSQL** (Railway) — shared with the bot repo
- **Anthropic Claude** — site-side AI chat ("Pip")

## Setup

```bash
cp .env.example .env.local
# Fill in values
npm install
npm run dev
```
