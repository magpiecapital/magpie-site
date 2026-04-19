"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { Header } from "@/components/Header";

/* ─── Constants ─── */
const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const X_URL = "https://x.com/MagpieLending";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const FEE_RATE = 0.015;

/* ─── Token Registry (64 approved tokens) ─── */
const REGISTRY: { symbol: string; name: string; mint: string }[] = [
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  { symbol: "MOO DENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY" },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump" },
  { symbol: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5" },
  { symbol: "CHILLGUY", name: "Just a chill guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" },
  { symbol: "ACT", name: "Act I: The AI Prophecy", mint: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump" },
  { symbol: "SPX", name: "SPX6900", mint: "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr" },
  { symbol: "GIGA", name: "Giga Chad", mint: "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9" },
  { symbol: "MOODENG", name: "Baby Moo Deng", mint: "8bFiMRLQ2kBsLe9TFbMDJYBNGNrPFGRb87ipPMPR3Tup" },
  { symbol: "BUCK", name: "Buck", mint: "BxWBBBHqLdEfTTKNHPWFKGq3n5RY8kHDCkBH9KJXpump" },
  { symbol: "HOUSE", name: "House", mint: "E3UjYUoB3CWdMHkSfWpFH7V9j1x4Me5NJKFK6Mppump" },
  { symbol: "AI16Z", name: "ai16z", mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC" },
  { symbol: "WOULD", name: "Would", mint: "75DSVgBDEUPRQnJqKGBjMZaW72k2CEwjhsTrQMpfpump" },
  { symbol: "ROUTINE", name: "Routine", mint: "35F9cQg3jkDq3bYFNQBq1GqU7jQPNshLinBfVpnwpump" },
  { symbol: "VINE", name: "Vine Coin", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHnd3EJXMJ" },
  { symbol: "TITCOIN", name: "Titcoin", mint: "HRs8WzyGHMBzCMEKVCmwREjpYMTYMGjEMLCmpVMpump" },
  { symbol: "RFC", name: "Retard Finder Coin", mint: "GByvk4yoKMotBim2t1ym2ZYNNMuZuMhfCJJDFRrgpump" },
  { symbol: "DARK", name: "Dark", mint: "5573MgVNGh9dFaoqPFCajHBPnLjTexUi6vjFvvhgpump" },
  { symbol: "ALCH", name: "Alchemist AI", mint: "HNg5PYJoQKSx9gKGAjKHSVG5DrJkpJJRBtECbpzpump" },
  { symbol: "BULLY", name: "Dolos The Bully", mint: "51KuEpFMDZaxGCSAcsdZMKZkfQMK2KRXE3G2gPpXpump" },
  { symbol: "KWEEN", name: "Kween", mint: "GceKqmDyFnFhTMzmRBgrafbF4LRaZJQtaJWz9dHpump" },
  { symbol: "LUCE", name: "LUCE", mint: "CBdCxKo9QavR9hfShgRMPg6mnaN2Hi7L7HPERTdpump" },
  { symbol: "SLOP", name: "Slop", mint: "8cMKnMkP6TtV5NKSHg89W7AEFwen6MFjFVE2VBYepump" },
  { symbol: "ANSEM", name: "Ansem", mint: "HiEDq2KbMF3JCzrMFAPVS9bEF4Lx1MtuoGPwvJxpump" },
  { symbol: "CATFISH", name: "Catfish", mint: "9P1T7BQLJqoWkemjaGTxLzDBMG2mTxjzSaMKmnsDpump" },
  { symbol: "PVS", name: "PVS", mint: "AdL1dFRczHDDVE3tPkjxbFGHqxs6GiLKfuFvNjpump" },
  { symbol: "SIGMA", name: "Sigma", mint: "5SVG3T9CNQsm1CtEjVJjMDdHwikkEMbCmo4VH5Bpump" },
  { symbol: "SWAG", name: "Swag", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J1z" },
  { symbol: "BORK", name: "Bork", mint: "41SuGqiJqXEbNJn9TRWFSngvLmGUf7bTzNSyZjr6pump" },
  { symbol: "GUMMY", name: "Gummy", mint: "HF5iVVbV9rdoSF4SGUKLPRHsKzVhBJaqpvdCvpSUpump" },
  { symbol: "BEEP", name: "Beep", mint: "D8r8XTuCrUhLheWeGXSwC3G92RhASficV3YA7B2Vpump" },
  { symbol: "UBC", name: "Universal Basic Compute", mint: "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump" },
  { symbol: "DNUT", name: "Deez Nuts", mint: "Hb1gKr8VSwvXRMWUTRN64PiYJYhXXZ96JFyNLRCpump" },
  { symbol: "SHOGGOTH", name: "Shoggoth", mint: "H1G6sZ1WDoMmMCFqBKAbg9gkQPCo1sKQtaJWz9dHpump" },
  { symbol: "SKIBIDI", name: "Skibidi Toilet", mint: "BZdLPF2jMNcFEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump" },
  { symbol: "HAMMY", name: "Hammy", mint: "26VBfmUVxQ4i3ENqXjkk95sB9LPf5xzB1C4ECNnpump" },
  { symbol: "SCOOPY", name: "Scoopy", mint: "78F3Ln95cCfCC3K2zTDqWK9rMgzRYRLGLgZ7o7BEpump" },
  { symbol: "MICHI", name: "Michi", mint: "5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp" },
  { symbol: "RETARDIO", name: "Retardio", mint: "6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx" },
  { symbol: "BILLY", name: "Billy", mint: "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump" },
  { symbol: "BUTTHOLE", name: "Butthole", mint: "FxMLnWRBsdQtHhwXPjDNKXDtC73c3Rv35bB4cVDpump" },
  { symbol: "DOGINME", name: "doginme", mint: "GJtJuWD9qYcCkrwMBmtY1tpapV1sKfB2zUv9Q4aqpump" },
  { symbol: "HOSICO", name: "Hosico Cat", mint: "Au6EdrSDubCUc34awy9c6iKtNwVCkFczBMosIN45pump" },
  { symbol: "LLM", name: "Large Language Model", mint: "G2YReBNBfh1kE6JVr3MyGTAJn4KPsHCBz9G91WTUpump" },
  { symbol: "TANK", name: "Tank", mint: "FmKAfMMnu65jMBFoSrejCbNgRCiCpMh7hb8bAMv7pump" },
  { symbol: "KHAI", name: "Khai", mint: "2cJgFSqZxyKRMCJWtUe6YYpS2M3VaFRvS2QDRkBEpump" },
  { symbol: "LOCKIN", name: "Lock In", mint: "8Ki8DpuWNxu9VsS3kQbarsCWMcFGWkzzA8pUPto9zBio" },
  { symbol: "ZEREBRO", name: "Zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn" },
  { symbol: "NPC", name: "Non-Playable Coin", mint: "Hrt9jHBQTGFnDMKiTemaMGFRmGCi7VZFwsP5Hpumpfun" },
  { symbol: "DADDY", name: "DADDY TATE", mint: "4Cnk9EPnW5ixfLZatCPJjDB1PUtcRpVEgTEi3ti2pump" },
  { symbol: "GROYPER", name: "Groyper", mint: "BDZ8bpKBe9Fxs3YD8RNhZE2oecRRxAcSpBoGprdJpump" },
  { symbol: "LUIGI", name: "Luigi", mint: "GBkKboGR6AFqjmMSEWnNamJXDKfbDeSHnPGZ5MdYpump" },
  { symbol: "SC", name: "Smoking Chicken Fish", mint: "CeMnM3HMfUPPECcEMrG8w5HMuYE4emPbCuMfHZnpump" },
  { symbol: "AWW", name: "Aww", mint: "Aww2F44Ak8BXFuZHi94K1m3rNiUfMZ1i26F3Enpump" },
  { symbol: "PUMP", name: "Pump", mint: "AxRoXRxQmigsrJBaBjNtuN2sPgHagSqZnptai2vQpump" },
  { symbol: "BLINK", name: "Blink", mint: "6jnhbFSaRP56WGFMEByFx3BgqrNBvJT4sqUjiCMpump" },
  { symbol: "TACO", name: "Taco", mint: "E3wRGJoN5q1oGz9VwKQ3CP4YDy3Bp7hpbPCfn4Hmpump" },
  { symbol: "PITY", name: "Pity", mint: "4DMVnTcZPBNmVTfj7K9EhWMkaZoD2kRRUCdHJNApump" },
  { symbol: "MAXXING", name: "MAXXING", mint: "7P9b1V6WiMZGJBxUqm1s2vHJJLkR2N8ACCESS6MtgY" },
];

/* ─── Tier definitions ─── */
const TIERS = [
  { name: "Express", ltv: 0.3, days: 2, highlight: true, label: "Most SOL" },
  { name: "Quick", ltv: 0.25, days: 3, highlight: false, label: "Popular" },
  { name: "Standard", ltv: 0.2, days: 7, highlight: false, label: "Safest" },
];

/* ─── Helpers ─── */
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function fmtSol(n: number): string {
  if (n >= 1000) return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SOL`;
  if (n >= 1) return `${n.toFixed(4)} SOL`;
  return `${n.toFixed(6)} SOL`;
}

function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

/* ─── Main Component ─── */
export default function CalculatorClient() {
  const [selectedMint, setSelectedMint] = useState(REGISTRY[0].mint);
  const [amount, setAmount] = useState("");
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedToken = REGISTRY.find((t) => t.mint === selectedMint)!;
  const numAmount = parseFloat(amount) || 0;

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Fetch prices */
  const fetchPrice = useCallback(async (mint: string) => {
    setLoading(true);
    setError(null);
    try {
      const [tokenRes, solRes] = await Promise.all([
        fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`),
        fetch(`https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`),
      ]);

      if (!tokenRes.ok || !solRes.ok) throw new Error("Failed to fetch prices");

      const tokenData = await tokenRes.json();
      const solData = await solRes.json();

      // Pick the pair with highest liquidity
      const tokenPairs = Array.isArray(tokenData) ? tokenData : tokenData.pairs || [];
      const solPairs = Array.isArray(solData) ? solData : solData.pairs || [];

      if (tokenPairs.length === 0) throw new Error("No trading pairs found for this token");

      const bestTokenPair = tokenPairs.reduce((best: any, pair: any) =>
        (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best
      );
      const bestSolPair = solPairs.reduce((best: any, pair: any) =>
        (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best
      );

      const tp = parseFloat(bestTokenPair.priceUsd);
      const sp = parseFloat(bestSolPair.priceUsd);

      if (isNaN(tp) || isNaN(sp)) throw new Error("Invalid price data");

      setTokenPrice(tp);
      setSolPrice(sp);
    } catch (err: any) {
      setError(err.message || "Failed to fetch price data");
      setTokenPrice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice(selectedMint);
  }, [selectedMint, fetchPrice]);

  /* Calculations */
  const collateralValueUsd = tokenPrice ? numAmount * tokenPrice : null;

  const tierCalcs = TIERS.map((tier) => {
    if (!collateralValueUsd || !solPrice || numAmount <= 0) {
      return { ...tier, loanUsd: 0, loanSol: 0, feeUsd: 0, feeSol: 0, repayUsd: 0, repaySol: 0, liqPrice: 0, health: 0 };
    }
    const loanUsd = collateralValueUsd * tier.ltv;
    const feeUsd = loanUsd * FEE_RATE;
    const payoutUsd = loanUsd - feeUsd;
    const loanSol = payoutUsd / solPrice;
    const feeSol = feeUsd / solPrice;
    const repayUsd = loanUsd;
    const repaySol = repayUsd / solPrice;
    // Liquidation: health = collateralValue / debt = 1.1 => tokenPrice * amount / debt = 1.1
    // liqPrice = (1.1 * debt) / amount
    const liqPrice = (1.1 * repayUsd) / numAmount;
    const health = collateralValueUsd / repayUsd;
    return { ...tier, loanUsd: payoutUsd, loanSol, feeUsd, feeSol, repayUsd, repaySol, liqPrice, health };
  });

  const hasResults = collateralValueUsd !== null && collateralValueUsd > 0 && numAmount > 0;

  /* Filtered tokens for dropdown */
  const filteredTokens = REGISTRY.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span className="text-[var(--ink)]">Live prices</span>
          </div>

          <h1 className="fade-up fade-up-1 font-display max-w-4xl text-[clamp(2.5rem,7vw,6rem)] leading-[0.92] tracking-[-0.04em] font-medium">
            Loan Calculator
          </h1>

          <p className="fade-up fade-up-2 mt-6 max-w-xl text-xl text-[var(--ink-soft)] leading-relaxed">
            See exactly what you&apos;ll receive before you open the bot.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        {/* Input controls */}
        <div className="fade-up fade-up-3 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 shadow-sm md:p-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Token selector */}
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                Token
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => { setDropdownOpen(!dropdownOpen); setSearch(""); }}
                  className="flex w-full items-center justify-between rounded-2xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-5 py-4 text-left transition hover:border-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-bold text-[var(--accent-deep)]">
                      {selectedToken.symbol.slice(0, 2)}
                    </span>
                    <div>
                      <div className="font-semibold tracking-tight">{selectedToken.symbol}</div>
                      <div className="text-xs text-[var(--ink-soft)]">{selectedToken.name}</div>
                    </div>
                  </div>
                  <svg className={`h-4 w-4 text-[var(--ink-soft)] transition ${dropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] shadow-lg">
                    <div className="border-b border-[var(--hairline)] p-3">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tokens..."
                        className="w-full rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--ink-faint)]"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredTokens.map((token) => (
                        <button
                          key={token.mint}
                          onClick={() => {
                            setSelectedMint(token.mint);
                            setDropdownOpen(false);
                            setSearch("");
                          }}
                          className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[var(--surface)] ${
                            token.mint === selectedMint ? "bg-[var(--accent-dim)]" : ""
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[10px] font-bold text-[var(--ink-soft)]">
                            {token.symbol.slice(0, 2)}
                          </span>
                          <div>
                            <div className="text-sm font-semibold">{token.symbol}</div>
                            <div className="text-xs text-[var(--ink-soft)]">{token.name}</div>
                          </div>
                        </button>
                      ))}
                      {filteredTokens.length === 0 && (
                        <div className="px-5 py-6 text-center text-sm text-[var(--ink-soft)]">
                          No tokens found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-2xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-5 py-4 pr-24 text-2xl font-semibold tabular tracking-tight outline-none transition placeholder:text-[var(--ink-faint)] hover:border-[var(--ink)] focus:border-[var(--ink)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--ink-soft)]">
                  {selectedToken.symbol}
                </span>
              </div>
            </div>
          </div>

          {/* Price display */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--hairline-strong)] border-t-[var(--accent)]" />
                Fetching live prices...
              </div>
            )}
            {error && (
              <div className="text-sm text-[var(--bad)]">{error}</div>
            )}
            {!loading && tokenPrice !== null && (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-sm">
                  <span className="text-[var(--ink-soft)]">{selectedToken.symbol}</span>
                  <span className="font-semibold tabular">{fmtPrice(tokenPrice)}</span>
                </div>
                {solPrice !== null && (
                  <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-sm">
                    <span className="text-[var(--ink-soft)]">SOL</span>
                    <span className="font-semibold tabular">{fmtUsd(solPrice)}</span>
                  </div>
                )}
                {collateralValueUsd !== null && collateralValueUsd > 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-sm">
                    <span className="text-[var(--ink-soft)]">Collateral</span>
                    <span className="font-semibold tabular">{fmtUsd(collateralValueUsd)}</span>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => fetchPrice(selectedMint)}
              className="ml-auto text-xs font-medium text-[var(--accent-deep)] transition hover:text-[var(--accent)]"
              disabled={loading}
            >
              Refresh prices
            </button>
          </div>
        </div>

        {/* Tier cards */}
        {hasResults && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {tierCalcs.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-3xl border p-7 transition ${
                  tier.highlight
                    ? "border-[var(--ink)] bg-[var(--bg-elevated)] shadow-[0_30px_80px_-30px_rgba(30,22,0,0.3)]"
                    : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--ink)] hover:shadow-md"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)] shadow-sm">
                    {tier.label}
                  </span>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="font-display text-2xl font-medium tracking-[-0.02em]">{tier.name}</div>
                  <div className="chip">{tier.days}d</div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <div className="font-display tabular text-5xl font-medium tracking-[-0.04em]">
                    {(tier.ltv * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-[var(--ink-soft)]">LTV</div>
                </div>

                {/* Results */}
                <div className="mt-6 space-y-0 divide-y divide-[var(--hairline)]">
                  <ResultRow label="Collateral value" value={fmtUsd(collateralValueUsd!)} />
                  <ResultRow
                    label="You receive"
                    value={fmtSol(tier.loanSol)}
                    subvalue={fmtUsd(tier.loanUsd)}
                    accent
                  />
                  <ResultRow
                    label={`Fee (${(FEE_RATE * 100).toFixed(1)}%)`}
                    value={fmtUsd(tier.feeUsd)}
                  />
                  <ResultRow
                    label="Repay to reclaim"
                    value={fmtSol(tier.repaySol)}
                    subvalue={fmtUsd(tier.repayUsd)}
                  />
                  <ResultRow
                    label="Liquidation price"
                    value={fmtPrice(tier.liqPrice)}
                    warn
                  />
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-[var(--ink-soft)]">Health at current price</span>
                    <HealthBadge health={tier.health} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasResults && !loading && tokenPrice !== null && (
          <div className="mt-8 rounded-3xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface)] p-12 text-center">
            <div className="font-display text-2xl font-medium tracking-tight text-[var(--ink-soft)]">
              Enter an amount to see your loan breakdown
            </div>
            <p className="mt-2 text-sm text-[var(--ink-faint)]">
              Results update instantly as you type
            </p>
          </div>
        )}
      </section>

      {/* Understanding LTV */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="chip mb-5">Education</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
            Understanding <span className="italic">LTV</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Loan-to-Value is the percentage of your collateral&apos;s USD value you receive as SOL. Higher LTV means more SOL but a tighter margin to liquidation.
          </p>

          {/* Visual breakdown */}
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Example card */}
            <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Example</div>
              <div className="mt-3 font-display text-xl font-medium tracking-tight">10,000 WIF at $0.50</div>
              <div className="mt-6 space-y-4">
                <div>
                  <div className="text-xs text-[var(--ink-soft)]">Collateral value</div>
                  <div className="mt-1 text-2xl font-semibold tabular">$5,000</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: "100%" }} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { pct: "30%", usd: "$1,500", tier: "Express" },
                    { pct: "25%", usd: "$1,250", tier: "Quick" },
                    { pct: "20%", usd: "$1,000", tier: "Standard" },
                  ].map((t) => (
                    <div key={t.tier} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-3">
                      <div className="text-xs text-[var(--ink-soft)]">{t.tier}</div>
                      <div className="mt-1 text-lg font-semibold tabular">{t.usd}</div>
                      <div className="text-xs text-[var(--ink-faint)]">{t.pct} LTV</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* How health works */}
            <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Health ratio</div>
              <div className="mt-3 font-display text-xl font-medium tracking-tight">Collateral / Debt</div>
              <div className="mt-6 space-y-4">
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                  Your health ratio tracks how much your collateral covers your debt. If health drops to <strong className="text-[var(--ink)]">1.1x</strong>, your position is liquidated to protect the protocol.
                </p>
                <div className="space-y-3">
                  {[
                    { health: 3.33, label: "30% LTV (fresh)", color: "var(--accent-deep)" },
                    { health: 2.0, label: "Price dropped ~40%", color: "var(--accent-deep)" },
                    { health: 1.5, label: "Getting risky", color: "var(--warn)" },
                    { health: 1.1, label: "Liquidation", color: "var(--bad)" },
                  ].map((h) => (
                    <div key={h.label} className="flex items-center gap-3">
                      <div className="w-14 text-right text-sm font-semibold tabular" style={{ color: h.color }}>
                        {h.health.toFixed(1)}x
                      </div>
                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min((h.health / 3.33) * 100, 100)}%`,
                              backgroundColor: h.color,
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-36 text-xs text-[var(--ink-soft)]">{h.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* What you can do */}
            <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">If price drops</div>
              <div className="mt-3 font-display text-xl font-medium tracking-tight">You have options</div>
              <div className="mt-6 space-y-5">
                {[
                  { icon: "01", title: "Top up collateral", desc: "Send more tokens to improve your health ratio" },
                  { icon: "02", title: "Partial repay", desc: "Pay back some SOL to reduce your debt" },
                  { icon: "03", title: "Extend the loan", desc: "Pay 1.5% to get more time (resets the due date)" },
                  { icon: "04", title: "Repay in full", desc: "Return the SOL + fee to reclaim your entire bag" },
                ].map((opt) => (
                  <div key={opt.icon} className="flex gap-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs font-semibold text-[var(--ink-soft)]">
                      {opt.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight">{opt.title}</div>
                      <div className="text-xs text-[var(--ink-soft)] leading-relaxed">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
          <Mark size={64} className="mx-auto mb-8 hop" />
          <h2 className="font-display mx-auto max-w-3xl text-5xl font-medium tracking-[-0.04em] text-white md:text-7xl">
            Ready to <span className="italic text-[var(--accent)]">borrow?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-white/70">
            Open the bot, pick your tier, and get SOL in under 30 seconds.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-lg">
              Open @magpie_capital_bot
              <span aria-hidden>&#8594;</span>
            </a>
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Browse approved tokens
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              <Wordmark size={24} />
              <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[var(--ink-soft)]">
                Borrow SOL against your memecoin bags, in a Telegram chat.
              </p>
            </div>
            <FooterCol title="Product">
              <FooterLink href="/">How it works</FooterLink>
              <FooterLink href="/demo">Demo</FooterLink>
              <FooterLink href="/tokens">Approved Tokens</FooterLink>
              <FooterLink href="/calculate">Calculator</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
            </FooterCol>
            <FooterCol title="Company">
              <FooterLink href="#">FAQ</FooterLink>
              <FooterLink href="#">Docs</FooterLink>
              <FooterLink href="#">Security</FooterLink>
              <FooterLink href="#">Contact</FooterLink>
            </FooterCol>
            <FooterCol title="Social">
              <FooterLink href={X_URL}>X</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
              <FooterLink href="#">GitHub</FooterLink>
            </FooterCol>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--hairline)] pt-6 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
            </div>
            <div className="text-xs text-[var(--ink-faint)]">
              Not financial advice. Loans carry liquidation risk.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function ResultRow({
  label,
  value,
  subvalue,
  accent,
  warn,
}: {
  label: string;
  value: string;
  subvalue?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-[var(--ink-soft)]">{label}</span>
      <div className="text-right">
        <span
          className={`text-sm font-semibold tabular ${
            accent
              ? "text-[var(--accent-deep)]"
              : warn
              ? "text-[var(--bad)]"
              : ""
          }`}
        >
          {value}
        </span>
        {subvalue && (
          <div className="text-xs text-[var(--ink-faint)] tabular">{subvalue}</div>
        )}
      </div>
    </div>
  );
}

function HealthBadge({ health }: { health: number }) {
  let color = "var(--accent-deep)";
  let label = "Healthy";
  if (health < 1.5) {
    color = "var(--bad)";
    label = "Critical";
  } else if (health < 2.0) {
    color = "var(--warn)";
    label = "Caution";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold tabular" style={{ color }}>
        {health.toFixed(2)}x
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{
          color,
          backgroundColor: health < 1.5
            ? "rgba(184, 58, 58, 0.1)"
            : health < 2.0
            ? "rgba(201, 106, 61, 0.1)"
            : "rgba(201, 154, 44, 0.1)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
        {title}
      </div>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
      {children}
    </a>
  );
}
