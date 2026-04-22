/**
 * Single source of truth for all approved collateral tokens.
 * Used by: /api/v1/tokens, /tokens page, /dashboard eligible collateral.
 *
 * To add a new token: append to this array and redeploy.
 * To remove a token: delete the entry and redeploy.
 */

export interface RegisteredToken {
  symbol: string;
  name: string;
  mint: string;
}

export const TOKEN_REGISTRY: RegisteredToken[] = [
  // ── A ──
  { symbol: "67", name: "67", mint: "9AvytnUKsLxPxFHFqS6VLxaxt5p6BhYNr53SD2Chpump" },
  { symbol: "ACT", name: "Act I: The AI Prophecy", mint: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump" },
  { symbol: "AI16Z", name: "ai16z", mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC" },
  { symbol: "ALCH", name: "Alchemist AI", mint: "HNg5PYJmtqcmzXrv6S9zP1CDKk5BgDuyFBxbvNApump" },
  { symbol: "ANSEM", name: "Ansem", mint: "HiEDq2KbMF3JCzrMFAPVS9bEF4Lx1MtuoGPwvJxpump" },
  { symbol: "ARC", name: "Arc", mint: "61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump" },
  { symbol: "ASTEROID", name: "Asteroid", mint: "F1ppSHedBsGGwEKH78JVgoqr4xkQHswtsGGLpgM7bCP2" },
  { symbol: "AURA", name: "Aura", mint: "DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2" },
  { symbol: "AWW", name: "Aww", mint: "Aww2F44Ak8BXFuZHi94K1m3rNiUfMZ1i26F3Enpump" },

  // ── B ──
  { symbol: "BAN", name: "Ban", mint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump" },
  { symbol: "BEEP", name: "Beep", mint: "D8r8XTuCrUhLheWeGXSwC3G92RhASficV3YA7B2Vpump" },
  { symbol: "BERT", name: "Bert", mint: "HgBRWfYxEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump" },
  { symbol: "BILLY", name: "Billy", mint: "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump" },
  { symbol: "BLINK", name: "Blink", mint: "6jnhbFSaRP56WGFMEByFx3BgqrNBvJT4sqUjiCMpump" },
  { symbol: "BOME", name: "Bome", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "BORK", name: "Bork", mint: "41SuGqiJqXEbNJn9TRWFSngvLmGUf7bTzNSyZjr6pump" },
  { symbol: "BUCK", name: "Buck", mint: "BxWBBBHqLdEfTTKNHPWFKGq3n5RY8kHDCkBH9KJXpump" },
  { symbol: "BULL", name: "Bull", mint: "3TYgKwkE2Y3rxdw9osLRSpxpXmSC1C1oo19W9KHspump" },
  { symbol: "BULLY", name: "Dolos The Bully", mint: "51KuEpFMDZaxGCSAcsdZMKZkfQMK2KRXE3G2gPpXpump" },
  { symbol: "BUTTCOIN", name: "Buttcoin", mint: "Cm6fNnMk7NfzStP9CZpsQA2v3jjzbcYGAxdJySmHpump" },
  { symbol: "BUTTHOLE", name: "Butthole", mint: "FxMLnWRBsdQtHhwXPjDNKXDtC73c3Rv35bB4cVDpump" },

  // ── C ──
  { symbol: "CATFISH", name: "Catfish", mint: "9P1T7BQLJqoWkemjaGTxLzDBMG2mTxjzSaMKmnsDpump" },
  { symbol: "CHILLGUY", name: "Just a chill guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump" },
  { symbol: "CHILLHOUSE", name: "Chillhouse", mint: "GkyPYa7NnCFbduLknCfBfP7p8564X1VZhwZYJ6CZpump" },
  { symbol: "CODEC", name: "Codec", mint: "69LjZUUzxj3Cb3Fxeo1X4QpYEQTboApkhXTysPpbpump" },
  { symbol: "COPPERINU", name: "Copper Inu", mint: "61Wj56QgGyyB966T7YsMzEAKRLcMvJpDbPzjkrCZc4Bi" },

  // ── D ──
  { symbol: "DADDY", name: "DADDY TATE", mint: "4Cnk9EPnW5ixfLZatCPJjDB1PUtcRpVEgTEi3ti2pump" },
  { symbol: "DARK", name: "Dark", mint: "5573MgVNGh9dFaoqPFCajHBPnLjTexUi6vjFvvhgpump" },
  { symbol: "DNUT", name: "Deez Nuts", mint: "Hb1gKr8VSwvXRMWUTRN64PiYJYhXXZ96JFyNLRCpump" },
  { symbol: "DOGINME", name: "doginme", mint: "GJtJuWD9qYcCkrwMBmtY1tpapV1sKfB2zUv9Q4aqpump" },
  { symbol: "DREAMS", name: "Dreams", mint: "GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump" },

  // ── F ──
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" },
  { symbol: "FIH", name: "Fih", mint: "8SkfuQkYNTskoQUbbjr2JbZQeqQV9egnJXgfMXf5bonk" },
  { symbol: "FORCA", name: "Forca", mint: "J1wsY5rqFesHmQojnzBNs4Bhk5vEtCb9GU5xv7A7pump" },
  { symbol: "FWOG", name: "Fwog", mint: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump" },

  // ── G ──
  { symbol: "GIGA", name: "Giga Chad", mint: "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9" },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump" },
  { symbol: "GRIFFAIN", name: "Griffain", mint: "KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP" },
  { symbol: "GROYPER", name: "Groyper", mint: "BDZ8bpKBe9Fxs3YD8RNhZE2oecRRxAcSpBoGprdJpump" },
  { symbol: "GUMMY", name: "Gummy", mint: "HF5iVVbV9rdoSF4SGUKLPRHsKzVhBJaqpvdCvpSUpump" },

  // ── H ──
  { symbol: "HAMMY", name: "Hammy", mint: "26VBfmUVxQ4i3ENqXjkk95sB9LPf5xzB1C4ECNnpump" },
  { symbol: "HODL", name: "Hodl", mint: "Hh3oTaqDCKKfdBgsQEvxp9sUwyNf8x9qmKqEMLBWpump" },
  { symbol: "HOSICO", name: "Hosico Cat", mint: "Au6EdrSDubCUc34awy9c6iKtNwVCkFczBMosIN45pump" },
  { symbol: "HOUSE", name: "House", mint: "E3UjYUoB3CWdMHkSfWpFH7V9j1x4Me5NJKFK6Mppump" },

  // ── J ──
  { symbol: "JELLYJELLY", name: "Jelly Jelly", mint: "FeR8VBqNRSUD5NtXAj2n3j1dAHkZHfyDktKuLXD4pump" },

  // ── K ──
  { symbol: "KHAI", name: "Khai", mint: "2cJgFSqZxyKRMCJWtUe6YYpS2M3VaFRvS2QDRkBEpump" },
  { symbol: "KWEEN", name: "Kween", mint: "GceKqmDyFnFhTMzmRBgrafbF4LRaZJQtaJWz9dHpump" },

  // ── L ──
  { symbol: "LLM", name: "Large Language Model", mint: "G2YReBNBfh1kE6JVr3MyGTAJn4KPsHCBz9G91WTUpump" },
  { symbol: "LOBSTAR", name: "Lobstar", mint: "AVF9F4C4j8b1Kh4BmNHqybDaHgnZpJ7W7yLvL7hUpump" },
  { symbol: "LOCKIN", name: "Lock In", mint: "8Ki8DpuWNxu9VsS3kQbarsCWMcFGWkzzA8pUPto9zBio" },
  { symbol: "LOL", name: "LOL", mint: "34q2KmCvapecJgR6ZrtbCTrzZVtkt3a5mHEA3TuEsWYb" },
  { symbol: "LUCE", name: "LUCE", mint: "CBdCxKo9QavR9hfShgRMPg6mnaN2Hi7L7HPERTdpump" },
  { symbol: "LUIGI", name: "Luigi", mint: "GBkKboGR6AFqjmMSEWnNamJXDKfbDeSHnPGZ5MdYpump" },

  // ── M ──
  { symbol: "MAXXING", name: "MAXXING", mint: "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5" },
  { symbol: "MICHI", name: "Michi", mint: "5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp" },
  { symbol: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY" },

  // ── N ──
  { symbol: "NEET", name: "Neet", mint: "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump" },
  { symbol: "NOBODY", name: "Nobody", mint: "C29ebrgYjYoJPMGPnPSGY1q3mMGk4iDSqnQeQQA7moon" },
  { symbol: "NPC", name: "Non-Playable Coin", mint: "Hrt9jHBQTGFnDMKiTemaMGFRmGCi7VZFwsP5Hpumpfun" },

  // ── P ──
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" },
  { symbol: "PENGUIN", name: "Penguin", mint: "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump" },
  { symbol: "PITY", name: "Pity", mint: "4DMVnTcZPBNmVTfj7K9EhWMkaZoD2kRRUCdHJNApump" },
  { symbol: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  { symbol: "PUMP", name: "Pump", mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn" },
  { symbol: "PUMPCADE", name: "Pumpcade", mint: "Eg2ymQ2aQqjMcibnmTt8erC6Tvk9PVpJZCxvVPJz2agu" },
  { symbol: "PUNCH", name: "Punch", mint: "NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump" },
  { symbol: "PVS", name: "PVS", mint: "AdL1dFRczHDDVE3tPkjxbFGHqxs6GiLKfuFvNjpump" },
  { symbol: "PYTH", name: "Pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" },
  { symbol: "PYTHIA", name: "Pythia", mint: "CreiuhfwdWCN5mJbMJtA9bBpYQrQF2tCBuZwSPWfpump" },

  // ── R ──
  { symbol: "RAIN", name: "Rain", mint: "3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump" },
  { symbol: "REITRE", name: "Reitre", mint: "zGh48JtNHVBb5evgoZLXwgPD2Qu4MhkWdJLGDAupump" },
  { symbol: "RENTA", name: "Renta", mint: "5MxQUFdPisppdVfjitL6hs492GyikCFnsBWYtuAqpump" },
  { symbol: "RETARDIO", name: "Retardio", mint: "6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx" },
  { symbol: "RFC", name: "Retard Finder Coin", mint: "GByvk4yoKMotBim2t1ym2ZYNNMuZuMhfCJJDFRrgpump" },
  { symbol: "ROUTINE", name: "Routine", mint: "35F9cQg3jkDq3bYFNQBq1GqU7jQPNshLinBfVpnwpump" },

  // ── S ──
  { symbol: "SC", name: "Smoking Chicken Fish", mint: "CeMnM3HMfUPPECcEMrG8w5HMuYE4emPbCuMfHZnpump" },
  { symbol: "SCOOPY", name: "Scoopy", mint: "78F3Ln95cCfCC3K2zTDqWK9rMgzRYRLGLgZ7o7BEpump" },
  { symbol: "SHOGGOTH", name: "Shoggoth", mint: "H1G6sZ1WDoMmMCFqBKAbg9gkQPCo1sKQtaJWz9dHpump" },
  { symbol: "SIGMA", name: "Sigma", mint: "5SVG3T9CNQsm1CtEjVJjMDdHwikkEMbCmo4VH5Bpump" },
  { symbol: "SKIBIDI", name: "Skibidi Toilet", mint: "BZdLPF2jMNcFEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump" },
  { symbol: "SLOP", name: "Slop", mint: "8cMKnMkP6TtV5NKSHg89W7AEFwen6MFjFVE2VBYepump" },
  { symbol: "SMR", name: "Smr", mint: "EiRfZeWLW1NymAfjKUePz3jwtq5rZ69XM3zLDS1Npump" },
  { symbol: "SPIKE", name: "Spike", mint: "BFiGUxnidogqcZAPVPDZRCfhx3nXnFLYqpQUaUGpump" },
  { symbol: "SPX", name: "SPX6900", mint: "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr" },
  { symbol: "SWAG", name: "Swag", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J1z" },
  { symbol: "SWARMS", name: "Swarms", mint: "74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump" },

  // ── T ──
  { symbol: "TACO", name: "Taco", mint: "E3wRGJoN5q1oGz9VwKQ3CP4YDy3Bp7hpbPCfn4Hmpump" },
  { symbol: "TANK", name: "Tank", mint: "FmKAfMMnu65jMBFoSrejCbNgRCiCpMh7hb8bAMv7pump" },
  { symbol: "TESTICLE", name: "Testicle", mint: "4TyZGqRLG3VcHTGMcLBoPUmqYitMVojXinAmkL8xpump" },
  { symbol: "TITCOIN", name: "Titcoin", mint: "HRs8WzyGHMBzCMEKVCmwREjpYMTYMGjEMLCmpVMpump" },
  { symbol: "TRIPLET", name: "TripleT", mint: "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump" },
  { symbol: "TROLL", name: "Troll", mint: "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2" },
  { symbol: "TRUMP", name: "Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN" },

  // ── U ──
  { symbol: "UBC", name: "Universal Basic Compute", mint: "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump" },
  { symbol: "UFD", name: "UFD", mint: "eL5fUxj2J4CiQsmW85k5FG9DvuQjjUoBHoQBi2Kpump" },
  { symbol: "UNC", name: "Unc", mint: "ACtfUWtgvaXrQGNMiohTusi5jcx5RJf5zwu9aAxkpump" },
  { symbol: "USDUC", name: "USDUC", mint: "CB9dDufT3ZuQXqqSfa1c5kY935TEreyBw9XJXxHKpump" },
  { symbol: "USELESS", name: "Useless", mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk" },

  // ── V ──
  { symbol: "VINE", name: "Vine Coin", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump" },

  // ── W ──
  { symbol: "WHITEWHALE", name: "White Whale", mint: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "WOJAK", name: "Wojak", mint: "8J69rbLTzWWgUJziFY8jeu5tDwEPBwUz4pKBMr5rpump" },
  { symbol: "WOULD", name: "Would", mint: "J1Wpmugrooj1yMyQKrdZ2vwRXG5rhfx3vTnYE39gpump" },

  // ── Z ──
  { symbol: "ZAUTH", name: "Zauth", mint: "DNhQZ1CE9qZ2FNrVhsCXwQJ2vZG8ufZkcYakTS5Jpump" },
  { symbol: "ZEREBRO", name: "Zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn" },
];
