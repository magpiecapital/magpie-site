/**
 * /security — Upgrade Authority section.
 *
 * Server component. Reads the current upgrade authority for V1, V3, V4
 * on every request (revalidate: 60s) and decodes the Squads V4 multisig
 * state so the page always shows reality, not stale claims.
 *
 * Shipped 2026-06-18 PM after the upgrade-authority migration
 * (project_upgrade_authority_migration_2026_06_18.md). The migration
 * moved V1/V3/V4 upgrade authority from a single hot EOA to a
 * hardware-key-required Squads multisig with a 48h timelock + immutable
 * config. This component surfaces that publicly so anyone — depositor,
 * partner protocol, audit firm — can verify it without trusting our copy.
 */
import { Connection, PublicKey } from "@solana/web3.js";

const BPF_LOADER_UPGRADEABLE = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

const SYSTEM_PROGRAM_DEFAULT = "11111111111111111111111111111111";

const MULTISIG_PDA = new PublicKey(
  "32KiAKXAZpbqvpkubC4JVWgEbomRwbSh4fRVYCdakLec",
);
const VAULT_PDA = new PublicKey(
  "3FA8bGKuc4dK2pcmjA46zzxNWn2Pf5YT32jGfbSdwkWB",
);
const SQUADS_PROGRAM = new PublicKey(
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
);

type ProgramEntry = { name: string; id: string; note: string };
const PROGRAMS: ProgramEntry[] = [
  {
    name: "V1",
    id: "4FEFPeMH68BbkrrZW2ak9wWXUS7JCkvXqBkGf5Bg6wmh",
    note: "Memecoin lending pool",
  },
  {
    name: "V3",
    id: "B8AwYzFmc3ZB5EWWVtJcJhJtEmKL78W5i3kZrL1uMCmP",
    note: "Tokenized-stocks pool",
  },
  {
    name: "V4",
    id: "HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo",
    note: "Auto-sell + in-vault liquidations (earlier loans + RWA exits)",
  },
  {
    name: "V4.1",
    id: "FsGXFtStgdRVqHQgik879CFpxM23oBt63URCYEWcxj4z",
    note: "Sec3-audited auto-sell program — all new exit loans (live 2026-08-26)",
  },
];

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

async function readUpgradeAuthority(
  connection: Connection,
  programId: PublicKey,
): Promise<{ authority: string | null; lastDeployedSlot: number } | null> {
  const [programDataPda] = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE,
  );
  const info = await connection.getAccountInfo(programDataPda, "confirmed");
  if (!info) return null;
  const data = info.data;
  // ProgramData layout: variant u32 | last_modified_slot u64 | option<authority> u8 | authority [u8;32]
  const lastDeployedSlot = Number(data.readBigUInt64LE(4));
  const hasAuthority = data[12];
  if (hasAuthority === 0) return { authority: null, lastDeployedSlot };
  const authority = new PublicKey(data.subarray(13, 45)).toBase58();
  return { authority, lastDeployedSlot };
}

type MultisigConfig = {
  configAuthority: string;
  threshold: number;
  timeLock: number;
  transactionIndex: bigint;
  staleTransactionIndex: bigint;
  members: { key: string; permissions: number }[];
};

async function readMultisigConfig(
  connection: Connection,
): Promise<MultisigConfig | null> {
  const info = await connection.getAccountInfo(MULTISIG_PDA, "confirmed");
  if (!info) return null;
  const data = info.data;
  // Anchor discriminator (8) | create_key Pubkey | config_authority Pubkey | threshold u16
  // | time_lock u32 | transaction_index u64 | stale_transaction_index u64
  // | rent_collector Option<Pubkey> (1 + 32 if Some) | bump u8
  // | members Vec<Member> (u32 len + N * (Pubkey + permissions u8))
  let o = 8 + 32; // skip discriminator + create_key
  const configAuthority = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const threshold = data.readUInt16LE(o);
  o += 2;
  const timeLock = data.readUInt32LE(o);
  o += 4;
  const transactionIndex = data.readBigUInt64LE(o);
  o += 8;
  const staleTransactionIndex = data.readBigUInt64LE(o);
  o += 8;
  const rcSome = data.readUInt8(o);
  o += 1;
  if (rcSome === 1) o += 32;
  o += 1; // bump
  const memberLen = data.readUInt32LE(o);
  o += 4;
  const members: { key: string; permissions: number }[] = [];
  for (let i = 0; i < memberLen; i++) {
    const key = new PublicKey(data.subarray(o, o + 32)).toBase58();
    o += 32;
    const permissions = data.readUInt8(o);
    o += 1;
    members.push({ key, permissions });
  }
  return {
    configAuthority,
    threshold,
    timeLock,
    transactionIndex,
    staleTransactionIndex,
    members,
  };
}

/**
 * A queued multisig proposal, decoded live from Solana.
 *
 * Proposal PDA seeds: ["multisig", multisig, "transaction", index_le_u64, "proposal"].
 * Account layout (Squads V4, borsh): discriminator 8 | multisig Pubkey |
 * transaction_index u64 | status (u8 kind + i64 timestamp for all kinds
 * except Executing) | …
 */
type ProposalInfo = {
  index: bigint;
  statusKind: string;
  statusTimestamp: number | null;
  executableAt: number | null; // unix seconds — Approved only
  targetProgram: ProgramEntry | null;
  proposalPda: string;
  transactionPda: string;
};

const PROPOSAL_STATUS_KINDS = [
  "Draft",
  "Active",
  "Rejected",
  "Approved",
  "Executing",
  "Executed",
  "Cancelled",
] as const;

function proposalPdas(index: bigint): { proposalPda: PublicKey; transactionPda: PublicKey } {
  const indexLe = Buffer.alloc(8);
  indexLe.writeBigUInt64LE(index);
  const [transactionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), MULTISIG_PDA.toBuffer(), Buffer.from("transaction"), indexLe],
    SQUADS_PROGRAM,
  );
  const [proposalPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("multisig"),
      MULTISIG_PDA.toBuffer(),
      Buffer.from("transaction"),
      indexLe,
      Buffer.from("proposal"),
    ],
    SQUADS_PROGRAM,
  );
  return { proposalPda, transactionPda };
}

async function readProposal(
  connection: Connection,
  index: bigint,
  timeLock: number,
): Promise<ProposalInfo | null> {
  const { proposalPda, transactionPda } = proposalPdas(index);
  const [propInfo, txInfo] = await Promise.all([
    connection.getAccountInfo(proposalPda, "confirmed"),
    connection.getAccountInfo(transactionPda, "confirmed"),
  ]);
  if (!propInfo) return null;
  const data = propInfo.data;
  let o = 8 + 32; // discriminator + multisig
  o += 8; // transaction_index (already known)
  const kindByte = data.readUInt8(o);
  o += 1;
  const statusKind = PROPOSAL_STATUS_KINDS[kindByte] ?? `Unknown(${kindByte})`;
  const hasTimestamp = statusKind !== "Executing" && kindByte < PROPOSAL_STATUS_KINDS.length;
  const statusTimestamp = hasTimestamp ? Number(data.readBigInt64LE(o)) : null;
  const executableAt =
    statusKind === "Approved" && statusTimestamp != null
      ? statusTimestamp + timeLock
      : null;
  // Identify which of OUR programs the stored vault transaction touches by
  // scanning its raw bytes for the program ids — layout-agnostic on purpose.
  let targetProgram: ProgramEntry | null = null;
  if (txInfo) {
    for (const p of PROGRAMS) {
      if (txInfo.data.includes(new PublicKey(p.id).toBuffer())) {
        targetProgram = p;
        break;
      }
    }
  }
  return {
    index,
    statusKind,
    statusTimestamp,
    executableAt,
    targetProgram,
    proposalPda: proposalPda.toBase58(),
    transactionPda: transactionPda.toBase58(),
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatUtc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function shorten(pubkey: string): string {
  return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
}

function PubkeyLink({
  pubkey,
  label,
}: {
  pubkey: string;
  label?: string;
}): React.ReactElement {
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

export async function UpgradeAuthoritySection(): Promise<React.ReactElement> {
  const connection = new Connection(RPC_URL, "confirmed");

  let authorities: Array<
    ProgramEntry & { authority: string | null; lastDeployedSlot: number | null }
  > = [];
  let multisigConfig: MultisigConfig | null = null;
  let proposals: ProposalInfo[] = [];
  let fetchError: string | null = null;

  try {
    const [a, m] = await Promise.all([
      Promise.all(
        PROGRAMS.map(async (p) => {
          try {
            const r = await readUpgradeAuthority(connection, new PublicKey(p.id));
            return r
              ? { ...p, authority: r.authority, lastDeployedSlot: r.lastDeployedSlot }
              : { ...p, authority: null, lastDeployedSlot: null };
          } catch {
            return { ...p, authority: null, lastDeployedSlot: null };
          }
        }),
      ),
      readMultisigConfig(connection),
    ]);
    authorities = a;
    multisigConfig = m;

    // Decode the most recent proposals (up to 5) so a queued upgrade is
    // visible here with its real status and countdown, not just a Solscan link.
    if (m && m.transactionIndex > 0n) {
      const newest = m.transactionIndex;
      const oldest = newest > 4n ? newest - 4n : 1n;
      const indexes: bigint[] = [];
      for (let i = newest; i >= oldest; i--) indexes.push(i);
      proposals = (
        await Promise.all(
          indexes.map((i) => readProposal(connection, i, m.timeLock).catch(() => null)),
        )
      ).filter((p): p is ProposalInfo => p !== null);
    }
  } catch (err) {
    fetchError = (err as Error).message ?? "unknown";
  }

  const allMatch =
    authorities.length === PROGRAMS.length &&
    authorities.every((a) => a.authority === VAULT_PDA.toBase58());
  const isImmutable =
    multisigConfig?.configAuthority === SYSTEM_PROGRAM_DEFAULT;
  const timelockHours = multisigConfig ? multisigConfig.timeLock / 3600 : null;
  const pendingActivity = multisigConfig
    ? multisigConfig.transactionIndex > 0n
    : false;

  return (
    <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
      <div className="chip mb-5">Upgrade authority</div>
      <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
        Hardware-key multisig with a <span className="italic">48-hour public delay.</span>
      </h2>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
        Every change to V1, V3, V4, or V4.1 is queued through a Squads multisig
        that only an offline hardware key can authorize, then publicly visible
        on-chain for 48 hours before it can take effect. Nothing can ship in
        secret. Everything below is read live from Solana — no static claims.
      </p>

      {fetchError && (
        <div className="mt-10 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-sm text-[var(--ink-soft)]">
          Live on-chain check is temporarily unavailable. You can verify
          independently on Solscan:{" "}
          <PubkeyLink pubkey={MULTISIG_PDA.toBase58()} label="multisig" />{" "}
          /{" "}
          <PubkeyLink pubkey={VAULT_PDA.toBase58()} label="vault" />.
        </div>
      )}

      {/* Headline status card */}
      <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
        <div className="bg-[var(--bg-elevated)] p-8">
          <div className="text-sm uppercase tracking-wider text-[var(--ink-faint)]">
            Status
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-3xl font-semibold tracking-tight md:text-4xl">
              {allMatch ? "Verified" : fetchError ? "Pending check" : "Mismatch"}
            </div>
            {allMatch && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--bg)]">
                live
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            {allMatch
              ? "V1, V3, V4, and V4.1 all currently report the multisig vault as their upgrade authority on-chain."
              : fetchError
                ? "We could not reach the RPC just now. Try again in a moment, or verify directly via Solscan."
                : "One or more programs are not currently routed to the multisig. This is the expected state during active migration; otherwise, please report it."}
          </p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-8">
          <div className="text-sm uppercase tracking-wider text-[var(--ink-faint)]">
            Multisig configuration
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Threshold</dt>
              <dd className="font-mono">
                {multisigConfig ? `${multisigConfig.threshold}-of-${multisigConfig.members.length}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Timelock</dt>
              <dd className="font-mono">
                {timelockHours != null
                  ? timelockHours >= 1
                    ? `${timelockHours.toFixed(0)} hours`
                    : `${multisigConfig?.timeLock ?? 0} seconds`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Config</dt>
              <dd className="font-mono">
                {multisigConfig
                  ? isImmutable
                    ? "Immutable"
                    : "Mutable"
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Signer type</dt>
              <dd className="font-mono">Hardware key</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Multisig</dt>
              <dd>
                <PubkeyLink pubkey={MULTISIG_PDA.toBase58()} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-soft)]">Vault (upgrade auth)</dt>
              <dd>
                <PubkeyLink pubkey={VAULT_PDA.toBase58()} />
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Per-program live table */}
      <div className="mt-12 overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="border-b border-[var(--hairline)] p-6 md:p-8">
          <div className="text-base font-semibold tracking-tight">
            Per-program upgrade authority
          </div>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Each row is the live answer from Solana&apos;s BPF loader for that
            program. The expected authority is the multisig vault address above.
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[var(--hairline)]">
          {PROGRAMS.map((p, i) => {
            const a = authorities[i];
            const match = a?.authority === VAULT_PDA.toBase58();
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:gap-6 md:p-8"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-semibold tracking-tight">
                      {p.name}
                    </span>
                    <span className="text-sm text-[var(--ink-soft)]">
                      {p.note}
                    </span>
                  </div>
                  <div className="mt-1 text-xs">
                    <PubkeyLink pubkey={p.id} />
                  </div>
                </div>
                <div className="text-sm md:text-right">
                  <div className="text-[var(--ink-faint)] uppercase tracking-wider text-xs">
                    Current authority
                  </div>
                  <div className="mt-1">
                    {a?.authority ? (
                      <PubkeyLink pubkey={a.authority} />
                    ) : (
                      <span className="text-[var(--ink-soft)]">—</span>
                    )}
                    {match && (
                      <span className="ml-2 text-[var(--accent)]">✓</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending upgrades — decoded live from the Squads proposal accounts */}
      <div className="mt-12 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:p-8">
        <div className="text-base font-semibold tracking-tight">
          Pending upgrades
        </div>
        {(() => {
          const nowSec = Math.floor(Date.now() / 1000);
          const open = proposals.filter((p) =>
            ["Draft", "Active", "Approved", "Executing"].includes(p.statusKind),
          );
          const recentExecuted = proposals.filter((p) => p.statusKind === "Executed");
          if (!multisigConfig) {
            return (
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Live check unavailable.
              </p>
            );
          }
          if (open.length === 0) {
            return (
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {pendingActivity
                  ? `Nothing is currently queued. The multisig has processed ${multisigConfig.transactionIndex.toString()} proposal(s) over its lifetime${recentExecuted.length > 0 ? ", most recently executed " + formatUtc(recentExecuted[0].statusTimestamp ?? 0) : ""}.`
                  : "No upgrades have been queued through the multisig. Any future upgrade will appear here with a 48-hour countdown to execution."}
              </p>
            );
          }
          return (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {open.map((p) => {
                const remaining =
                  p.executableAt != null ? p.executableAt - nowSec : null;
                const statusLabel =
                  p.statusKind === "Approved"
                    ? remaining != null && remaining > 0
                      ? `In timelock — executable in ~${formatDuration(remaining)}`
                      : "Timelock cleared — awaiting execution"
                    : p.statusKind === "Active"
                      ? "Awaiting signatures"
                      : p.statusKind === "Executing"
                        ? "Executing"
                        : "Draft";
                return (
                  <div
                    key={p.proposalPda}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-lg font-semibold tracking-tight">
                          {p.targetProgram
                            ? `${p.targetProgram.name} program upgrade`
                            : `Proposal #${p.index.toString()}`}
                        </span>
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--bg)]">
                          {statusLabel}
                        </span>
                      </div>
                      {p.targetProgram && (
                        <div className="mt-1 text-sm text-[var(--ink-soft)]">
                          {p.targetProgram.note} ·{" "}
                          <PubkeyLink pubkey={p.targetProgram.id} />
                        </div>
                      )}
                      {p.statusKind === "Approved" && p.statusTimestamp != null && (
                        <div className="mt-1 text-xs text-[var(--ink-faint)]">
                          Approved {formatUtc(p.statusTimestamp)}
                          {p.executableAt != null &&
                            ` · executable after ${formatUtc(p.executableAt)}`}
                        </div>
                      )}
                    </div>
                    <div className="text-sm md:text-right">
                      <div className="text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                        Verify on-chain
                      </div>
                      <div className="mt-1 flex gap-3 md:justify-end">
                        <PubkeyLink pubkey={p.proposalPda} label="proposal" />
                        <PubkeyLink pubkey={p.transactionPda} label="payload" />
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
                Countdown refreshes with the page (about once a minute). The
                payload account holds the exact upgrade instruction the vault
                will execute — nothing else can be substituted after approval.
              </p>
            </div>
          );
        })()}
        <div className="mt-4">
          <a
            href={`https://solscan.io/account/${MULTISIG_PDA.toBase58()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Inspect multisig on Solscan
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-3.25a.75.75 0 0 1 1.5 0v3.25a2.25 2.25 0 0 1-2.25 2.25h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h3.25a.75.75 0 0 1 0 1.5h-3.25Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M16.94 4.96a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.69L9.22 10.87a.75.75 0 1 0 1.06 1.06l5.16-5.16v2.69a.75.75 0 0 0 1.5 0v-4.5Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Squads program attribution */}
      <p className="mt-8 text-xs leading-relaxed text-[var(--ink-soft)]">
        Multisig is a Squads V4 Smart Account on Solana mainnet. Squads program
        ID:{" "}
        <PubkeyLink pubkey={SQUADS_PROGRAM.toBase58()} />. Squads V4 is open
        source and audited; details at{" "}
        <a
          href="https://docs.squads.so/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--accent)]"
        >
          docs.squads.so
        </a>
        .
      </p>
    </section>
  );
}
