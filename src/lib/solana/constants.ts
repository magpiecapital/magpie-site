import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "69NB7NPaTLPY2X7hmvV57xL8on9XMJnmXGnbkyTDdSQs",
);

export const LENDER_PUBKEY = new PublicKey(
  "5hsZBreKCt9PqZB4GdTqiGq2tZ1k7rfN4LZ9vEt1S2ML",
);

export const LOAN_TIERS = [
  { option: 0, ltv: 0.30, days: 2, fee: 0.03, label: "Express" },
  { option: 1, ltv: 0.25, days: 3, fee: 0.02, label: "Quick" },
  { option: 2, ltv: 0.20, days: 7, fee: 0.015, label: "Standard" },
] as const;
