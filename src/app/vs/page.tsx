import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

export const metadata: Metadata = {
  title: "Magpie vs other Solana lenders | Magpie",
  description:
    "Side-by-side: collateral types, LTV, terms, fees, custody model, default rate. Why Magpie is built for memecoin holders that other lenders won't serve.",
  openGraph: {
    title: "Magpie vs Marginfi, Kamino, Mango",
    description:
      "The only Solana lender built for memecoin holders. Web dashboard + Telegram bot. Sub-1% liquidation rate by design.",
  },
};

interface Comparison {
  feature: string;
  magpie: string;
  marginfi: string;
  kamino: string;
  mango: string;
  magpieHighlight?: boolean;
}

const ROWS: Comparison[] = [
  {
    feature: "Memecoin collateral",
    magpie: "Yes — every approved Solana memecoin",
    marginfi: "Blue-chips only (SOL, USDC, etc.)",
    kamino: "Blue-chips only",
    mango: "Blue-chips + perps",
    magpieHighlight: true,
  },
  {
    feature: "Interface",
    magpie: "Web dashboard + Telegram bot",
    marginfi: "Web app",
    kamino: "Web app",
    mango: "Web app",
    magpieHighlight: true,
  },
  {
    feature: "Onboarding time",
    magpie: "<30 seconds (web wallet OR TG)",
    marginfi: "Wallet install + bridge + setup",
    kamino: "Wallet install + bridge + setup",
    mango: "Wallet install + bridge + setup",
    magpieHighlight: true,
  },
  {
    feature: "Loan model",
    magpie: "Fixed-term · low LTV · flat fee",
    marginfi: "Variable APR · health-factor",
    kamino: "Variable APR · health-factor",
    mango: "Margin · variable APR · perps",
  },
  {
    feature: "Max LTV",
    magpie: "30% (Express) · 25% · 20%",
    marginfi: "Up to 70-80% on blue-chips",
    kamino: "Up to 70-80% on blue-chips",
    mango: "Up to 90% (margin)",
  },
  {
    feature: "Liquidation track record",
    magpie: "0 ever (by design)",
    marginfi: "Regular, expected",
    kamino: "Regular, expected",
    mango: "Routine in volatility",
    magpieHighlight: true,
  },
  {
    feature: "Anti-liquidation auto-protect",
    magpie: "Built-in opt-in (auto-tops up)",
    marginfi: "No",
    kamino: "No",
    mango: "No",
    magpieHighlight: true,
  },
  {
    feature: "Holder rewards",
    magpie: "$MAGPIE → 10% of fees, auto-distributed",
    marginfi: "No native token rewards",
    kamino: "KMNO emissions (variable)",
    mango: "MNGO governance",
  },
  {
    feature: "Referral program",
    magpie: "5% lifetime, on-chain",
    marginfi: "Points",
    kamino: "Points",
    mango: "—",
  },
  {
    feature: "Custody",
    magpie: "Non-custodial · keys via /export",
    marginfi: "Non-custodial",
    kamino: "Non-custodial",
    mango: "Non-custodial",
  },
  {
    feature: "Audit",
    magpie: "Audit in progress",
    marginfi: "Audited (OtterSec, Trail of Bits)",
    kamino: "Audited (OtterSec)",
    mango: "Audited",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="chip mb-6">Honest comparison</div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Magpie vs <span className="italic text-[var(--ink-soft)]">the rest</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Marginfi, Kamino, and Mango are excellent lenders for blue-chip
            collateral. Magpie is built for the holder they don&apos;t serve:
            the one with a memecoin bag who doesn&apos;t want to sell.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-accent">
              Start borrowing
              <span aria-hidden>→</span>
            </Link>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Or use Telegram
            </a>
            <Link href="/stats" className="btn-ghost">View live stats</Link>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="overflow-x-auto rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-[var(--hairline)] bg-[var(--surface)]">
                <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Feature</th>
                <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--accent-deep)]">
                  Magpie 🪶
                </th>
                <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Marginfi</th>
                <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Kamino</th>
                <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Mango</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {ROWS.map((row) => (
                <tr key={row.feature} className={row.magpieHighlight ? "bg-[var(--accent-dim)]/30" : ""}>
                  <td className="px-5 py-4 font-medium text-[var(--ink)]">{row.feature}</td>
                  <td className={`px-5 py-4 ${row.magpieHighlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}`}>
                    {row.magpie}
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">{row.marginfi}</td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">{row.kamino}</td>
                  <td className="px-5 py-4 text-[var(--ink-soft)]">{row.mango}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-[var(--ink-faint)]">
          Sources: each protocol&apos;s public docs as of {new Date().toISOString().slice(0, 10)}.
          Have a correction? Open a PR or DM us. We&apos;ll update.
        </p>
      </section>

      {/* The honest pitch */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl px-6 py-20 md:py-24">
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em] md:text-4xl">
            When to use which
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="card p-6">
              <div className="font-display text-xl font-medium tracking-[-0.01em]">
                Use Marginfi / Kamino / Mango if
              </div>
              <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                <li>• You hold SOL, USDC, or other blue-chips and want high LTV</li>
                <li>• You&apos;re comfortable with variable APR + ongoing health management</li>
                <li>• You want margin / perps / leveraged strategies</li>
                <li>• You&apos;re used to managing positions through a web app</li>
              </ul>
            </div>

            <div className="card p-6 border-[var(--accent-deep)] ring-2 ring-[var(--accent)]">
              <div className="font-display text-xl font-medium tracking-[-0.01em]">
                Use Magpie if
              </div>
              <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                <li>• You hold memecoins (or $MAGPIE) and want liquidity without selling</li>
                <li>• You want a flat one-time fee, no variable interest creeping up</li>
                <li>• You want to borrow in seconds — on the web dashboard or in a Telegram chat, your call</li>
                <li>• You want a built-in auto-protect that prevents liquidation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
          <h2 className="font-display text-4xl font-medium tracking-[-0.03em] text-[var(--bg-elevated)] md:text-6xl">
            Built for the bags <span className="italic text-[var(--accent)]">other lenders</span> won&apos;t touch.
          </h2>
          <div className="mt-10 flex flex-col items-center gap-4 md:flex-row md:justify-center">
            <Link href="/dashboard" className="btn-accent text-base">
              Open the dashboard
              <span aria-hidden>→</span>
            </Link>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10">
              Or use Telegram
            </a>
            <Link href="/calculate" className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10">
              See what your bag is worth
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
