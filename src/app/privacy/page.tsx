import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy & data | Magpie",
  description:
    "What Magpie stores, what we don't, and the controls you have over your data. Plain English, no dark patterns.",
  openGraph: {
    title: "Privacy & data | Magpie",
    description:
      "Magpie stores wallet pubkeys + encrypted custodial secrets + loan history + support messages. You can export or delete it.",
  },
};

const SECTIONS = [
  {
    h: "What we store",
    items: [
      ["Wallet pubkeys", "Public addresses of every wallet linked to your account."],
      ["Encrypted custodial secrets", "For bot-managed wallets only. AES-encrypted at rest; the decryption key lives in an environment variable on our server, not in the database."],
      ["Loan history", "Already public on Solana — mirrored to our database for fast lookups."],
      ["Support tickets", "Your messages and the team's replies."],
      ["Notification + Auto-Protect prefs", "Toggles for which DMs you receive and whether Auto-Protect is on."],
      ["Telegram user id + username", "So the bot can reach you."],
    ],
  },
  {
    h: "What we don't store",
    items: [
      ["Plaintext private keys", "Custodial keys are encrypted at rest with a key the server holds in env. Database dumps are useless without the encryption key."],
      ["Externally-held wallet keys", "Phantom-style wallets sign locally — your private key never leaves your device, let alone reaches our server."],
      ["Anything outside your bot account + dashboard activity", "We don't track you across the web, sell your data, or share it with advertisers."],
    ],
  },
  {
    h: "Your controls",
    items: [
      ["Kill-switch (/lock)", "Run /lock 24 in the Telegram bot to freeze every site signed action for 24 hours. Telegram is a separate auth surface from Phantom, so a stolen seed can't suppress the lock. Move funds, rotate keys, then /lock 0 to clear."],
      ["Per-action security DMs", "Every site-initiated withdraw, wallet change, ticket delete, or Auto-Protect toggle fires a Telegram DM with a one-tap Lock button — so an unauthorized action is visible within seconds."],
      ["Download my data", "On the dashboard, the PrefsPanel has a Download button that fetches a signed JSON dump of everything we hold for your account."],
      ["Delete tickets", "Closed tickets can be permanently removed from the dashboard or via the bot. Open tickets stay until resolved so the team can finish in-flight investigations."],
      ["Disconnect wallets", "Use /wallets in the bot to remove a wallet from your account at any time."],
    ],
  },
  {
    h: "If you suspect compromise",
    items: [
      ["1. /lock 24 (immediately)", "Freezes site signed actions for 24 hours."],
      ["2. Move any funds out of the suspect wallet", "To a fresh wallet that the attacker doesn't control."],
      ["3. /lock 0 once you've rotated", "Reopens site signed actions on your new wallet."],
      ["4. /support if you need help", "The AI agent can walk you through it, and the team takes over if it can't help."],
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Privacy & data</div>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            What we know about you
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-white/60 leading-relaxed">
            Plain English. No dark patterns. If a question isn't answered here, ask the AI agent on{" "}
            <Link href="/dashboard" className="underline hover:text-white">
              the dashboard
            </Link>{" "}
            or message the team via /support in the bot.
          </p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl font-semibold tracking-tight text-white">{s.h}</h2>
              <ul className="mt-4 space-y-3">
                {s.items.map(([title, body]) => (
                  <li key={title} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="mt-1 text-sm text-white/60 leading-relaxed">{body}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          <div className="font-semibold text-white">Questions?</div>
          <div className="mt-1 leading-relaxed">
            Ask the floating AI chat on{" "}
            <Link href="/dashboard" className="underline hover:text-white">
              your dashboard
            </Link>
            , or run <code className="rounded bg-white/10 px-1">/privacy</code> in{" "}
            <a
              href="https://t.me/magpie_capital_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              @magpie_capital_bot
            </a>{" "}
            for the same content with action buttons.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
