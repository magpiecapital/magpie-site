/**
 * Single source of truth for all approved collateral tokens.
 * Used by: /api/v1/tokens, /tokens page, /dashboard eligible collateral.
 *
 * To add a new token: append to this array and redeploy.
 * Every token MUST have an image — either a local path in /public/tokens/
 * or DexScreener will be used as fallback for memecoins.
 * To remove a token: delete the entry and redeploy.
 */

export type TokenCategory = "stock" | "memecoin";

export interface RegisteredToken {
  symbol: string;
  name: string;
  mint: string;
  category: TokenCategory;
  /** Local image path (e.g. "/tokens/xTSLA.svg") — required for stocks, optional for memecoins (DexScreener fallback). */
  image?: string;
}

export const TOKEN_REGISTRY: RegisteredToken[] = [
  // ── xStocks (Tokenized Equities) ──
  { symbol: "xTSLA", name: "Tesla", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", category: "stock", image: "/tokens/xTSLA.svg" },
  { symbol: "xNVDA", name: "NVIDIA", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", category: "stock", image: "/tokens/xNVDA.svg" },
  { symbol: "xAAPL", name: "Apple", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", category: "stock", image: "/tokens/xAAPL.svg" },
  { symbol: "xGOOGL", name: "Alphabet", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", category: "stock", image: "/tokens/xGOOGL.svg" },
  { symbol: "xAMZN", name: "Amazon", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", category: "stock", image: "/tokens/xAMZN.svg" },
  { symbol: "xMSFT", name: "Microsoft", mint: "FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo", category: "stock", image: "/tokens/xMSFT.svg" },
  { symbol: "xMETA", name: "Meta", mint: "fDxs5y12E7x7jBwCKBXGqt71uJmCWsAQ3Srkte6ondo", category: "stock", image: "/tokens/xMETA.svg" },
  { symbol: "xMSTR", name: "MicroStrategy", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", category: "stock", image: "/tokens/xMSTR.svg" },
  { symbol: "xCOIN", name: "Coinbase", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", category: "stock", image: "/tokens/xCOIN.svg" },

  // ── Memecoins & SPL Tokens ──
  { symbol: "PUMP", name: "Pump", mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", category: "memecoin" },
  { symbol: "TRUMP", name: "Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", category: "memecoin" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", category: "memecoin" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", category: "memecoin" },
  { symbol: "PYTH", name: "Pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", category: "memecoin" },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", category: "memecoin" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", category: "memecoin" },
  { symbol: "BAN", name: "Ban", mint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump", category: "memecoin" },
  { symbol: "WOULD", name: "Would", mint: "J1Wpmugrooj1yMyQKrdZ2vwRXG5rhfx3vTnYE39gpump", category: "memecoin" },
  { symbol: "ALCH", name: "Alchemist AI", mint: "HNg5PYJmtqcmzXrv6S9zP1CDKk5BgDuyFBxbvNApump", category: "memecoin" },
  { symbol: "ARC", name: "Arc", mint: "61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump", category: "memecoin" },
  { symbol: "PYTHIA", name: "Pythia", mint: "CreiuhfwdWCN5mJbMJtA9bBpYQrQF2tCBuZwSPWfpump", category: "memecoin" },
  { symbol: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", category: "memecoin" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", category: "memecoin" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", category: "memecoin" },
  { symbol: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", category: "memecoin" },
  { symbol: "SPX", name: "SPX6900", mint: "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr", category: "memecoin" },
  { symbol: "JELLYJELLY", name: "Jelly Jelly", mint: "FeR8VBqNRSUD5NtXAj2n3j1dAHkZHfyDktKuLXD4pump", category: "memecoin" },
  { symbol: "USELESS", name: "Useless", mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", category: "memecoin" },
  { symbol: "BOME", name: "Bome", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", category: "memecoin" },
  { symbol: "NEET", name: "Neet", mint: "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump", category: "memecoin" },
  { symbol: "PUMPCADE", name: "Pumpcade", mint: "Eg2ymQ2aQqjMcibnmTt8erC6Tvk9PVpJZCxvVPJz2agu", category: "memecoin" },
  { symbol: "TROLL", name: "Troll", mint: "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2", category: "memecoin" },
  { symbol: "VINE", name: "Vine Coin", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump", category: "memecoin" },
  { symbol: "SWARMS", name: "Swarms", mint: "74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump", category: "memecoin" },
  { symbol: "GIGA", name: "Giga Chad", mint: "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9", category: "memecoin" },
  { symbol: "GRIFFAIN", name: "Griffain", mint: "KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP", category: "memecoin" },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump", category: "memecoin" },
  { symbol: "ZEREBRO", name: "Zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn", category: "memecoin" },
  { symbol: "CHILLGUY", name: "Just a chill guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", category: "memecoin" },
  { symbol: "FORCA", name: "Forca", mint: "J1wsY5rqFesHmQojnzBNs4Bhk5vEtCb9GU5xv7A7pump", category: "memecoin" },
  { symbol: "ACT", name: "Act I: The AI Prophecy", mint: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump", category: "memecoin" },
  { symbol: "BERT", name: "Bert", mint: "HgBRWfYxEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump", category: "memecoin" },
  { symbol: "SPIKE", name: "Spike", mint: "BFiGUxnidogqcZAPVPDZRCfhx3nXnFLYqpQUaUGpump", category: "memecoin" },
  { symbol: "AURA", name: "Aura", mint: "DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2", category: "memecoin" },
  { symbol: "UFD", name: "UFD", mint: "eL5fUxj2J4CiQsmW85k5FG9DvuQjjUoBHoQBi2Kpump", category: "memecoin" },
  { symbol: "RAIN", name: "Rain", mint: "3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump", category: "memecoin" },
  { symbol: "BUTTCOIN", name: "Buttcoin", mint: "Cm6fNnMk7NfzStP9CZpsQA2v3jjzbcYGAxdJySmHpump", category: "memecoin" },
  { symbol: "WHITEWHALE", name: "White Whale", mint: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump", category: "memecoin" },
  { symbol: "UNC", name: "Unc", mint: "ACtfUWtgvaXrQGNMiohTusi5jcx5RJf5zwu9aAxkpump", category: "memecoin" },
  { symbol: "TESTICLE", name: "Testicle", mint: "4TyZGqRLG3VcHTGMcLBoPUmqYitMVojXinAmkL8xpump", category: "memecoin" },
  { symbol: "REITRE", name: "Reitre", mint: "zGh48JtNHVBb5evgoZLXwgPD2Qu4MhkWdJLGDAupump", category: "memecoin" },
  { symbol: "FWOG", name: "Fwog", mint: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump", category: "memecoin" },
  { symbol: "WOJAK", name: "Wojak", mint: "8J69rbLTzWWgUJziFY8jeu5tDwEPBwUz4pKBMr5rpump", category: "memecoin" },
  { symbol: "BULL", name: "Bull", mint: "3TYgKwkE2Y3rxdw9osLRSpxpXmSC1C1oo19W9KHspump", category: "memecoin" },
  { symbol: "TRIPLET", name: "TripleT", mint: "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", category: "memecoin" },
  { symbol: "DREAMS", name: "Dreams", mint: "GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump", category: "memecoin" },
  { symbol: "HODL", name: "Hodl", mint: "Hh3oTaqDCKKfdBgsQEvxp9sUwyNf8x9qmKqEMLBWpump", category: "memecoin" },
  { symbol: "PUNCH", name: "Punch", mint: "NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump", category: "memecoin" },
  { symbol: "NOBODY", name: "Nobody", mint: "C29ebrgYjYoJPMGPnPSGY1q3mMGk4iDSqnQeQQA7moon", category: "memecoin" },
  { symbol: "FIH", name: "Fih", mint: "8SkfuQkYNTskoQUbbjr2JbZQeqQV9egnJXgfMXf5bonk", category: "memecoin" },
  { symbol: "ZAUTH", name: "Zauth", mint: "DNhQZ1CE9qZ2FNrVhsCXwQJ2vZG8ufZkcYakTS5Jpump", category: "memecoin" },
  { symbol: "PENGUIN", name: "Penguin", mint: "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump", category: "memecoin" },
  { symbol: "CHILLHOUSE", name: "Chillhouse", mint: "GkyPYa7NnCFbduLknCfBfP7p8564X1VZhwZYJ6CZpump", category: "memecoin" },
  { symbol: "67", name: "67", mint: "9AvytnUKsLxPxFHFqS6VLxaxt5p6BhYNr53SD2Chpump", category: "memecoin" },
  { symbol: "COPPERINU", name: "Copper Inu", mint: "61Wj56QgGyyB966T7YsMzEAKRLcMvJpDbPzjkrCZc4Bi", category: "memecoin" },
  { symbol: "USDUC", name: "USDUC", mint: "CB9dDufT3ZuQXqqSfa1c5kY935TEreyBw9XJXxHKpump", category: "memecoin" },
  { symbol: "MAXXING", name: "MAXXING", mint: "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump", category: "memecoin" },
  { symbol: "LOL", name: "LOL", mint: "34q2KmCvapecJgR6ZrtbCTrzZVtkt3a5mHEA3TuEsWYb", category: "memecoin" },
  { symbol: "RETARDIO", name: "Retardio", mint: "6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx", category: "memecoin" },
  { symbol: "CODEC", name: "Codec", mint: "69LjZUUzxj3Cb3Fxeo1X4QpYEQTboApkhXTysPpbpump", category: "memecoin" },
  { symbol: "LOBSTAR", name: "Lobstar", mint: "AVF9F4C4j8b1Kh4BmNHqybDaHgnZpJ7W7yLvL7hUpump", category: "memecoin" },
  { symbol: "AI16Z", name: "ai16z", mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC", category: "memecoin" },
  { symbol: "BILLY", name: "Billy", mint: "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump", category: "memecoin" },
  { symbol: "ASTEROID", name: "Asteroid", mint: "F1ppSHedBsGGwEKH78JVgoqr4xkQHswtsGGLpgM7bCP2", category: "memecoin" },
  { symbol: "MICHI", name: "Michi", mint: "5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp", category: "memecoin" },
  { symbol: "DOGINME", name: "doginme", mint: "GJtJuWD9qYcCkrwMBmtY1tpapV1sKfB2zUv9Q4aqpump", category: "memecoin" },
  { symbol: "UBC", name: "Universal Basic Compute", mint: "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump", category: "memecoin" },
  { symbol: "RENTA", name: "Renta", mint: "5MxQUFdPisppdVfjitL6hs492GyikCFnsBWYtuAqpump", category: "memecoin" },
];
