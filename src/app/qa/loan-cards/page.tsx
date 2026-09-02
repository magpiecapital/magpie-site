"use client";

/**
 * /qa/loan-cards — the ActiveLoanCard gallery that CI actually looks at.
 *
 * Every fixture here is chosen to break layouts the way real production data
 * has: 16-char memecoin symbols, 9-digit token amounts, exponential
 * liquidation prices, overdue + mixed-collateral V4 loans, and a full
 * TP/SL/ladder order stack. If a change makes any text overlap or overflow
 * at any breakpoint, scripts/check-loan-overlap.mjs fails the build.
 *
 * The operator's 2026-09-01 mandate after a live loan card rendered "all out
 * of whack": this class of cosmetic defect must be structurally impossible
 * to ship again. This page is that structure — the card renders here on
 * every PR, under worse data than production will ever produce.
 */

import { WalletProvider } from "@/components/WalletProvider";
import { ActiveLoanCard, type ActiveLoan } from "@/app/dashboard/loan-card";
import type { TakeProfitState } from "@/lib/solana/site-take-profit";

const HOUR = 3_600_000;
const DAY = 86_400_000;

type FixtureOver = Omit<Partial<ActiveLoan>, "collateral" | "loan"> & {
  collateral?: Partial<ActiveLoan["collateral"]>;
  loan?: Partial<ActiveLoan["loan"]>;
};

function loanFixture(over: FixtureOver): ActiveLoan {
  return {
    loan_id: "116755458128207700",
    loan_pda: "FixturePda1111111111111111111111111111111111",
    ...over,
    collateral: {
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "WIF",
      decimals: 6,
      amount: "123456789000",
      current_amount: null,
      sol_proceeds_lamports: "0",
      auto_sells_fired: 0,
      ...(over.collateral ?? {}),
    },
    loan: { original_amount_lamports: "2500000000", ltv_percentage: 60, duration_days: 14, ...(over.loan ?? {}) },
    timestamps: over.timestamps ?? { due_at: new Date(Date.now() + 5 * DAY).toISOString() },
    health: "health" in over ? over.health : { ratio: 2.41, liquidation_price_sol: 0.00042 },
  };
}

const FIXTURES: { label: string; loan: ActiveLoan }[] = [
  {
    label: "healthy · plain",
    loan: loanFixture({}),
  },
  {
    label: "overdue · danger · mixed V4 vault · 16-char symbol",
    loan: loanFixture({
      loan_id: "216755458128207701",
      loan_pda: "FixturePda2222222222222222222222222222222222",
      collateral: {
        symbol: "BABYWIFHATCOIN26",
        decimals: 5,
        amount: "999999999999999",
        current_amount: "123456789012",
        sol_proceeds_lamports: "1234567890",
        auto_sells_fired: 2,
      },
      loan: { original_amount_lamports: "98765432109", ltv_percentage: 45, duration_days: 30 },
      timestamps: { due_at: new Date(Date.now() - 3 * DAY).toISOString() },
      health: { ratio: 1.12, liquidation_price_sol: 0.00000012 },
    }),
  },
  {
    label: "critical expiry · no symbol · tiny price · huge amount",
    loan: loanFixture({
      loan_id: "316755458128207702",
      loan_pda: "FixturePda3333333333333333333333333333333333",
      collateral: { symbol: null, decimals: 9, amount: "9987654321987654321" },
      loan: { original_amount_lamports: "50000000000", ltv_percentage: 35, duration_days: 7 },
      timestamps: { due_at: new Date(Date.now() + 9 * HOUR).toISOString() },
      health: { ratio: 1.35, liquidation_price_sol: 3.2e-9 },
    }),
  },
  {
    label: "V4 · armed TP+SL+ladder · fired + failed orders",
    loan: loanFixture({
      loan_id: "416755458128207703",
      loan_pda: "FixturePda4444444444444444444444444444444444",
      collateral: { symbol: "TROLL", decimals: 6, amount: "555000000000" },
      health: { ratio: 1.8, liquidation_price_sol: 0.0000015 },
    }),
  },
  {
    label: "no health snapshot",
    loan: loanFixture({
      loan_id: "516755458128207704",
      loan_pda: "FixturePda5555555555555555555555555555555555",
      collateral: { symbol: "PONKE" },
      health: null,
    }),
  },
  {
    label: "repay-ready with vault SOL returning",
    loan: loanFixture({
      loan_id: "616755458128207705",
      loan_pda: "FixturePda6666666666666666666666666666666666",
      collateral: { symbol: "MEW", auto_sells_fired: 1, current_amount: "5000000000", sol_proceeds_lamports: "2100000000" },
      loan: { original_amount_lamports: "300000000", ltv_percentage: 50, duration_days: 14 },
      health: { ratio: 3.1, liquidation_price_sol: 0.0009 },
    }),
  },
];

/**
 * Cast fixtures rather than fully typing TakeProfitState internals — the QA
 * page needs realistic SHAPES, and the components under test read the fields
 * defensively. Keeping the cast here (not in the components) means production
 * typing stays strict.
 */
const TP_STATE = {
  linked: true,
  custodial: true,
  loans: FIXTURES.map((f, i) => ({
    id: i + 1,
    loan_id: f.loan.loan_id,
    loan_pda: f.loan.loan_pda,
    collateral_mint: f.loan.collateral.mint,
    collateral_symbol: f.loan.collateral.symbol,
    collateral_decimals: f.loan.collateral.decimals,
    collateral_amount: f.loan.collateral.amount ?? "0",
    current_collateral_amount: f.loan.collateral.current_amount ?? f.loan.collateral.amount ?? "0",
    eligible_tp: true,
    eligible_sl: true,
    ineligibility_reasons: [],
    sl_ineligibility_reasons: [],
  })),
  orders: [
    { id: 11, loan_id: 4, trigger_kind: "price_usd", trigger_value_micro: "185000000", trigger_direction: "above", slippage_bps: 150, sell_destination: "sol", status: "armed", created_at: new Date().toISOString() },
    { id: 12, loan_id: 4, trigger_kind: "price_usd", trigger_value_micro: "95000000", trigger_direction: "below", slippage_bps: 300, sell_destination: "sol", status: "armed", created_at: new Date().toISOString() },
    { id: 13, loan_id: 4, trigger_kind: "mc_usd", trigger_value_micro: "205000000000000", trigger_direction: "above", slippage_bps: 150, sell_destination: "sol", status: "fired", fired_at: new Date(Date.now() - 2 * DAY).toISOString(), tx_signature: "5xK9aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafQ2m", proceeds_lamports: "1234567890", created_at: new Date(Date.now() - 3 * DAY).toISOString() },
    { id: 14, loan_id: 4, trigger_kind: "price_usd", trigger_value_micro: "170000000", trigger_direction: "above", slippage_bps: 100, sell_destination: "sol", status: "failed", failure_count: 3, failure_reason: "borrower_wallet_changed", created_at: new Date(Date.now() - 4 * DAY).toISOString() },
  ],
  pending_intents: [],
  pending_arms: [],
} as unknown as TakeProfitState;

const noop = () => {};

export default function LoanCardGallery() {
  return (
    <WalletProvider>
      <div id="gallery" className="mx-auto max-w-3xl px-4 py-8" style={{ background: "var(--d-bg, #faf7f2)", color: "var(--d-ink, #1c1917)" }}>
        <h1 className="mb-1 text-lg font-bold">ActiveLoanCard — overlap QA gallery</h1>
        <p className="mb-6 text-xs opacity-70">
          Real production component, hostile fixtures. scripts/check-loan-overlap.mjs asserts zero text collisions and zero overflow at every breakpoint.
        </p>
        <div className="flex flex-col gap-6">
          {FIXTURES.map((f) => (
            <section key={f.loan.loan_pda}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">{f.label}</div>
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/60">
                <ActiveLoanCard
                  loan={f.loan}
                  siteRepayEnabled
                  pending={{ repay: false, extend: false, topup: false }}
                  onRepay={noop}
                  onExtend={noop}
                  onTopup={noop}
                  solBalanceLamports={400000000}
                  tpState={TP_STATE}
                  onTpMutated={noop}
                  botApiUrl=""
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </WalletProvider>
  );
}
