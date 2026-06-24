"use client";

/**
 * /x402/link — "Set up your borrowing agent" wizard.
 *
 * Walks a user from "I have tokens" to "my AI brain can borrow against them
 * over x402", in one guided flow:
 *   1. Connect the wallet that holds your tokens
 *   2. See exactly what's borrowable (your holdings ∩ Magpie's collateral list)
 *   3. Designate your brain's wallet (the keypair your agent signs with)
 *   4. Fund the brain — move the chosen tokens (+ a little SOL for fees) into it
 *   5. Copy the pre-filled MCP config and you're done
 *
 * The ONE hard rule it respects: borrowing on Magpie requires the borrower to
 * own + sign for the collateral. So the brain must hold the wallet it borrows
 * from — there is no "keep your keys, brain borrows" path. This wizard makes
 * the honest model (a dedicated, user-funded brain wallet) genuinely easy.
 */
import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBorrowableHoldings, type BorrowableHolding } from "@/lib/solana/borrowable-holdings";

export default function X402LinkPage() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [holdings, setHoldings] = useState<BorrowableHolding[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [holdingsErr, setHoldingsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brainAddr, setBrainAddr] = useState("");
  const [solForFees, setSolForFees] = useState("0.1");
  const [funding, setFunding] = useState(false);
  const [fundSig, setFundSig] = useState<string | null>(null);
  const [fundErr, setFundErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadHoldings = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setHoldingsErr(null);
    try {
      setHoldings(await getBorrowableHoldings(connection, publicKey));
    } catch (e) {
      setHoldingsErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) void loadHoldings();
  }, [connected, publicKey, loadHoldings]);

  let brainPk: PublicKey | null = null;
  try {
    brainPk = brainAddr.trim() ? new PublicKey(brainAddr.trim()) : null;
  } catch {
    brainPk = null;
  }
  const brainValid = !!brainPk;
  const sameAsConnected = brainValid && publicKey && brainPk!.equals(publicKey);

  const toggle = (mint: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(mint) ? n.delete(mint) : n.add(mint);
      return n;
    });

  const fund = async () => {
    if (!publicKey || !brainPk || !sendTransaction) return;
    setFunding(true);
    setFundErr(null);
    setFundSig(null);
    try {
      const tx = new Transaction();
      for (const h of (holdings ?? []).filter((x) => selected.has(x.mint))) {
        const programId = h.tokenProgram === "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const mintPk = new PublicKey(h.mint);
        const src = getAssociatedTokenAddressSync(mintPk, publicKey, false, programId);
        const dst = getAssociatedTokenAddressSync(mintPk, brainPk, false, programId);
        const dstInfo = await connection.getAccountInfo(dst);
        if (!dstInfo)
          tx.add(createAssociatedTokenAccountInstruction(publicKey, dst, brainPk, mintPk, programId));
        tx.add(
          createTransferCheckedInstruction(src, mintPk, dst, publicKey, BigInt(h.rawAmount), h.decimals, [], programId),
        );
      }
      const sol = Number(solForFees);
      if (Number.isFinite(sol) && sol > 0)
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: brainPk,
            lamports: Math.round(sol * LAMPORTS_PER_SOL),
          }),
        );
      if (tx.instructions.length === 0) {
        setFundErr("Select at least one token (or some SOL) to move into the brain wallet.");
        setFunding(false);
        return;
      }
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setFundSig(sig);
    } catch (e) {
      setFundErr((e as Error).message);
    } finally {
      setFunding(false);
    }
  };

  const mcpConfig = `{
  "mcpServers": {
    "magpie": {
      "command": "npx",
      "args": ["-y", "@magpieloans/magpie-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com",
        "MAGPIE_MCP_PAYER_KEYPAIR": "/path/to/your-brain-wallet.json"
      }
    }
  }
}`;

  return (
    <div className="min-h-screen">
      <Header />
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-3xl px-6 pt-24 pb-10 text-center md:pt-28">
          <div className="mb-4 font-mono text-sm uppercase tracking-widest text-[var(--accent-deep)]">
            x402 · link your agent
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.0] tracking-[-0.04em] md:text-5xl">
            Let your AI brain borrow against your tokens
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
            Borrowing on Magpie requires the borrower to <strong>own and sign</strong> for the
            collateral — so your agent needs its <em>own</em> wallet holding the tokens. This sets that
            up in a couple of minutes, safely.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        {/* STEP 1 — connect */}
        <Step n="1" title="Connect the wallet that holds your tokens">
          {!connected ? (
            <button onClick={() => setVisible(true)} className="btn-accent">
              Connect wallet
            </button>
          ) : (
            <p className="text-[15px] text-[var(--ink-soft)]">
              Connected: <code className="font-mono text-[13px] text-[var(--ink)]">{publicKey?.toBase58()}</code>
            </p>
          )}
        </Step>

        {/* STEP 2 — discover */}
        <Step n="2" title="What you can borrow against" muted={!connected}>
          {!connected ? (
            <P>Connect above to scan your wallet.</P>
          ) : loading ? (
            <P>Scanning your token accounts (incl. Token-2022)…</P>
          ) : holdingsErr ? (
            <Callout>
              <div>Couldn&apos;t load your holdings: {holdingsErr}</div>
              <button onClick={() => void loadHoldings()} className="btn-ghost mt-3" disabled={loading}>
                {loading ? "Retrying…" : "Retry"}
              </button>
            </Callout>
          ) : holdings && holdings.length === 0 ? (
            <Callout>
              No Magpie-eligible collateral found in this wallet. You can still set up the brain wallet —
              just send it tokens from Magpie&apos;s{" "}
              <a href="https://x402.magpie.capital/api/v1/collateral/eligible" target="_blank" rel="noopener noreferrer" className="underline">
                collateral list
              </a>{" "}
              first.
            </Callout>
          ) : (
            <div className="space-y-2">
              <P>
                Tick the tokens you want your brain to be able to borrow against (you&apos;ll move them
                into its wallet next):
              </P>
              {holdings?.map((h) => (
                <label
                  key={h.mint}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <input type="checkbox" checked={selected.has(h.mint)} onChange={() => toggle(h.mint)} />
                  <span className="font-semibold text-[var(--ink)]">{h.symbol}</span>
                  <span className="text-sm text-[var(--ink-soft)]">{h.uiAmount.toLocaleString()} </span>
                  <span className="ml-auto rounded-full border border-[var(--hairline)] px-2 py-0.5 text-xs text-[var(--ink-soft)]">
                    {h.category}
                    {h.tokenProgram === "token-2022" ? " · Token-2022" : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Step>

        {/* STEP 3 — brain wallet */}
        <Step n="3" title="Your brain's wallet address" muted={!connected}>
          <P>
            Your agent signs with its <em>own</em> keypair. Create one with{" "}
            <code className="font-mono text-[13px]">solana-keygen new</code> (or use one you already have),
            then paste its <strong>public address</strong> here. The keypair file stays on your machine —
            never paste a private key on any website.
          </P>
          <input
            value={brainAddr}
            onChange={(e) => setBrainAddr(e.target.value)}
            placeholder="Brain wallet public address (base58)"
            className="mt-3 w-full rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          {brainAddr && !brainValid && <p className="mt-2 text-sm text-red-600">Not a valid Solana address.</p>}
          {sameAsConnected && (
            <Callout>
              That&apos;s the wallet you connected. If the connected wallet <em>is</em> your brain&apos;s
              wallet, you can skip the funding step — it already holds the tokens. Otherwise use a separate
              address.
            </Callout>
          )}
        </Step>

        {/* STEP 4 — fund */}
        <Step n="4" title="Fund the brain" muted={!connected || !brainValid}>
          <Callout>
            <strong>Only move what you&apos;re willing to delegate.</strong> Whoever holds the brain
            wallet&apos;s key controls these tokens and the SOL it borrows. It&apos;s a normal wallet you
            control — you can send everything back anytime.
          </Callout>
          <P>
            This moves the <strong>full balance</strong> of each ticked token into the brain wallet, plus a
            little SOL for x402 fees + gas:
          </P>
          <div className="mt-3 flex items-center gap-2 text-[15px] text-[var(--ink-soft)]">
            <span>SOL for fees:</span>
            <input
              value={solForFees}
              onChange={(e) => setSolForFees(e.target.value)}
              className="w-24 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <span>SOL</span>
          </div>
          <button
            onClick={() => void fund()}
            disabled={!connected || !brainValid || funding || (selected.size === 0 && Number(solForFees) <= 0)}
            className="btn-accent mt-4 disabled:opacity-40"
          >
            {funding ? "Sending…" : `Move ${selected.size} token${selected.size === 1 ? "" : "s"} + ${solForFees} SOL →`}
          </button>
          {fundErr && <p className="mt-3 text-sm text-red-600">{fundErr}</p>}
          {fundSig && (
            <Callout>
              ✓ Funded the brain wallet.{" "}
              <a href={`https://solscan.io/tx/${fundSig}`} target="_blank" rel="noopener noreferrer" className="underline">
                View transaction
              </a>
            </Callout>
          )}
          <P>
            Prefer to send manually? Just transfer those tokens to{" "}
            <code className="font-mono text-[13px] break-all">{brainAddr || "your brain address"}</code> from
            any wallet — same result.
          </P>
        </Step>

        {/* STEP 5 — wire up */}
        <Step n="5" title="Point your brain at Magpie x402" muted={!connected || !brainValid}>
          <P>
            Drop this into your AI host&apos;s MCP config (Claude Desktop / Cursor / Windsurf), pointing
            <code className="mx-1 font-mono text-[13px]">MAGPIE_MCP_PAYER_KEYPAIR</code>
            at your brain&apos;s keypair file. Restart, and your brain can borrow against the tokens you just
            moved:
          </P>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5 font-mono text-[13px] leading-relaxed text-[var(--ink)]">
            <code>{mcpConfig}</code>
          </pre>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(mcpConfig);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="btn-ghost mt-3"
          >
            {copied ? "Copied ✓" : "Copy config"}
          </button>
          <P>
            Full instructions live on the{" "}
            <a href="/x402/setup" className="underline">
              setup guide
            </a>
            . That&apos;s it — your brain is linked to x402.
          </P>
        </Step>
      </section>
      <Footer />
    </div>
  );
}

/* ---- local presentational helpers ---- */
function Step({
  n,
  title,
  muted,
  children,
}: {
  n: string;
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-display text-sm font-bold text-[var(--ink)]">
          {n}
        </div>
        <h2 className="font-display text-xl font-medium tracking-tight text-[var(--ink)]">{title}</h2>
      </div>
      <div className="mt-4 pl-11">{children}</div>
    </div>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)] first:mt-0">{children}</p>;
}
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-5 py-4 text-[15px] leading-relaxed text-[var(--ink-soft)]">
      {children}
    </div>
  );
}
