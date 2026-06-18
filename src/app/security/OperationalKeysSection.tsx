/**
 * /security — Operational Keys section.
 *
 * Complements the UpgradeAuthoritySection. Where that one says "no one
 * can secretly upgrade the code," this one says "here's what the key
 * that handles day-to-day operations can and cannot do." Honest framing
 * that surfaces the gap (single hot wallet) AND the bounded scope (it
 * cannot upgrade programs, drain pools, or move collateral outside the
 * documented liquidation path) AND the planned hardening (Q3 2026).
 *
 * Pure server component — no live data needed beyond static addresses.
 * Shipped 2026-06-18 PM alongside the upgrade-authority migration so
 * the public X-post announcement landing at /security has the full
 * operational-key story available too.
 */
import { PublicKey } from "@solana/web3.js";

const LENDER_WALLET = new PublicKey(
  "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx",
);

function shorten(pubkey: string): string {
  return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
}

function PubkeyLink({ pubkey, label }: { pubkey: string; label?: string }) {
  return (
    <a
      href={`https://solscan.io/account/${pubkey}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs underline decoration-dotted underline-offset-2 hover:text-[var(--accent)] transition"
      title={pubkey}
    >
      {label ?? shorten(pubkey)}
    </a>
  );
}

const CAN_DO = [
  {
    label: "Cosign borrow transactions",
    detail:
      "Program logic enforces what borrows are valid — LTV ladder, TWAP price guard, allowlist, exposure caps. The cosign signature is one input, not the final say.",
  },
  {
    label: "Sign price attestations",
    detail:
      "Prices flow through an on-chain TWAP window. The program rejects any attestation that moves outside the window's tolerance.",
  },
  {
    label: "Receive fees",
    detail:
      "Origination and extension fees collect in this wallet as borrowers transact.",
  },
  {
    label: "Run pool admin instructions",
    detail:
      "Rate changes, allowlist updates, pause / unpause, admin_withdraw of the protocol-reserved share.",
  },
];

const CANNOT_DO = [
  {
    label: "Upgrade the lending programs",
    detail:
      "Upgrade authority lives with the hardware-key multisig (above), with a 48-hour public timelock and an immutable configuration.",
  },
  {
    label: "Move user collateral outside the liquidation path",
    detail:
      "Each loan's collateral lives in a loan-scoped PDA enforced by the on-chain program. There is no instruction that lets this wallet pull a borrower's collateral.",
  },
  {
    label: "Lend more SOL than the pool holds",
    detail:
      "On-chain program logic gates loan size against pool reserves at every borrow. No off-chain override exists.",
  },
  {
    label: "Bypass the TWAP price guard",
    detail:
      "Even with the attestation signature, the on-chain TWAP validation rejects manipulated prices. The guard is enforced by the program, not the off-chain bot.",
  },
];

export function OperationalKeysSection() {
  return (
    <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
      <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <div className="chip mb-5">Operational keys</div>
        <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
          Day-to-day signing comes from a hot wallet — with{" "}
          <span className="italic">bounded scope.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
          Magpie&apos;s programs need to sign hundreds of operational
          transactions per day — cosigning borrows, attesting prices,
          distributing fees, running admin instructions — and most of those
          have to happen in milliseconds. A multisig with a timelock can&apos;t
          meet that latency budget. Like every other major Solana protocol, a
          single hot wallet (
          <PubkeyLink pubkey={LENDER_WALLET.toBase58()} />) handles these
          operational signatures. What matters is how narrow its scope is.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* CAN DO */}
          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg)]">
            <div className="border-b border-[var(--hairline)] p-6 md:p-8">
              <div className="text-sm uppercase tracking-wider text-[var(--ink-faint)]">
                What this wallet CAN do
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">
                Day-to-day operational scope
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-[var(--hairline)]">
              {CAN_DO.map((item) => (
                <div key={item.label} className="p-6 md:p-8">
                  <div className="text-sm font-semibold tracking-tight">
                    {item.label}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CANNOT DO */}
          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg)]">
            <div className="border-b border-[var(--hairline)] p-6 md:p-8">
              <div className="text-sm uppercase tracking-wider text-[var(--ink-faint)]">
                What this wallet CANNOT do
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight text-[var(--accent)]">
                Protected by on-chain program logic
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-[var(--hairline)]">
              {CANNOT_DO.map((item) => (
                <div key={item.label} className="p-6 md:p-8">
                  <div className="text-sm font-semibold tracking-tight">
                    {item.label}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Planned hardening */}
        <div className="mt-12 rounded-3xl border border-[var(--hairline)] bg-[var(--bg)] p-6 md:p-8">
          <div className="text-sm uppercase tracking-wider text-[var(--ink-faint)]">
            Planned hardening
          </div>
          <div className="mt-1 text-base font-semibold tracking-tight">
            Further reducing operational-key blast radius
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                A separate admin multisig for{" "}
                <span className="font-mono text-xs">admin_withdraw</span>, rate
                changes, and pause — moving the highest-impact instructions
                off the operational wallet
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                Daily auto-sweep of accumulated fees to a cold treasury vault,
                bounding the worst-case loss from a hot-key compromise to a
                single day of fee accumulation
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                The cosign hot wallet retains only the narrow, latency-critical
                signing surface — cosign-borrow and price attestations
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
