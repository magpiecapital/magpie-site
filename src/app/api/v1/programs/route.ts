/**
 * GET /api/v1/programs
 *
 * Per-program (per-pool) protocol breakdown — one row for every deployed
 * lending program. Built for the /stats "Lending programs" section and for
 * third-party monitors: each program is a separate on-chain contract
 * custodying its own funds, so risk, liquidity, and activity deserve
 * per-program visibility.
 *
 * Numbers are COMPUTED, never hardcoded:
 *  - loan counts + SOL-on-loan come from the protocol Postgres
 *  - pool liquidity is read live from each pool's on-chain vault
 *    (nullable if the RPC read times out — the DB figures still serve)
 *
 * Legacy note: the earliest V1 loans predate the program_id column, so
 * lifetime counts COALESCE null → V1.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { query } from "@/lib/db";
import {
  PROGRAM_ID,
  PROGRAM_ID_V2,
  PROGRAM_ID_V3,
  PROGRAM_ID_V4,
  PROGRAM_ID_V4_1,
  LENDER_PUBKEY,
} from "@/lib/solana/constants";
import { poolPda, loanTokenVaultPda } from "@/lib/solana/pdas";

const HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "X-Powered-By": "Magpie Protocol",
};

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

type ProgramRow = {
  key: string;
  name: string;
  status: string;
  statusKind: "flagship" | "active" | "winding_down" | "retired";
  audited: boolean;
  program_id: string;
  active_loans: number;
  active_borrowed_sol: number;
  lifetime_loans: number;
  repaid_loans: number;
  pool_liquidity_sol: number | null;
};

function programSet() {
  const list: Array<{
    key: string; name: string; status: string;
    statusKind: ProgramRow["statusKind"]; audited: boolean; id: PublicKey | null;
  }> = [
    { key: "v41", name: "V4.1 — flagship", status: "All new auto-sell loans + new LP deposits", statusKind: "flagship", audited: true, id: PROGRAM_ID_V4_1 },
    { key: "v4", name: "V4 — prior flagship", status: "Earlier loans to term + RWA auto-sell lane", statusKind: "winding_down", audited: false, id: PROGRAM_ID_V4 },
    { key: "v3", name: "V3 — tokenized stocks / RWA", status: "Plain stock & RWA borrows (Sec3 hardening applied)", statusKind: "active", audited: false, id: PROGRAM_ID_V3 },
    { key: "v1", name: "V1 — memecoin", status: "Plain memecoin borrows (Sec3 hardening applied)", statusKind: "active", audited: false, id: PROGRAM_ID },
    { key: "v2", name: "V2 — legacy", status: "Retired — withdrawals only", statusKind: "retired", audited: false, id: PROGRAM_ID_V2 },
  ];
  return list.filter((p) => p.id != null) as Array<(typeof list)[number] & { id: PublicKey }>;
}

async function vaultBalances(programs: ReturnType<typeof programSet>) {
  const conn = new Connection(RPC_URL, "confirmed");
  const out = new Map<string, number | null>();
  await Promise.all(
    programs.map(async (p) => {
      try {
        const [pool] = poolPda(LENDER_PUBKEY, p.id);
        const [vault] = loanTokenVaultPda(pool, p.id);
        const bal = await Promise.race([
          conn.getTokenAccountBalance(vault),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500)),
        ]);
        out.set(p.key, bal.value.uiAmount ?? null);
      } catch {
        out.set(p.key, null); // fail-soft: DB figures still serve
      }
    }),
  );
  return out;
}

export async function GET() {
  try {
    const programs = programSet();
    const v1Id = PROGRAM_ID.toBase58();
    const [{ rows }, vaults] = await Promise.all([
      query(
        `SELECT COALESCE(program_id, $1) AS program_id,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active_loans,
                COUNT(*)::int AS lifetime_loans,
                COUNT(*) FILTER (WHERE status = 'repaid')::int AS repaid_loans,
                COALESCE(SUM(CASE WHEN status = 'active'
                                   THEN loan_amount_lamports::numeric ELSE 0 END), 0)::text
                  AS active_borrowed_lamports
           FROM loans
          GROUP BY COALESCE(program_id, $1)`,
        [v1Id],
      ),
      vaultBalances(programs),
    ]);
    const byId = new Map(rows.map((r: Record<string, unknown>) => [String(r.program_id), r]));
    const out: ProgramRow[] = programs.map((p) => {
      const r = (byId.get(p.id.toBase58()) ?? {}) as Record<string, unknown>;
      return {
        key: p.key,
        name: p.name,
        status: p.status,
        statusKind: p.statusKind,
        audited: p.audited,
        program_id: p.id.toBase58(),
        active_loans: Number(r.active_loans ?? 0),
        active_borrowed_sol: Number(r.active_borrowed_lamports ?? 0) / 1e9,
        lifetime_loans: Number(r.lifetime_loans ?? 0),
        repaid_loans: Number(r.repaid_loans ?? 0),
        pool_liquidity_sol: vaults.get(p.key) ?? null,
      };
    })
    // retired pools only appear while they still hold anything
    .filter((p) => p.statusKind !== "retired" || p.active_loans > 0 || (p.pool_liquidity_sol ?? 0) > 0.01);
    return NextResponse.json(
      { ok: true, programs: out, generated_at: new Date().toISOString() },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("programs endpoint failed:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500, headers: HEADERS });
  }
}
