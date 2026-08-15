# Collectibles catalog pipeline

The set-driven expansion + comp-refresh pipeline behind the 541-asset catalog
(waves 1-2, 2026-08-15). Runs OUTSIDE the app (needs puppeteer + network).

## Stages
1. `wave2-enum.js` — enumerate sets from PriceCharting console pages
   (?sort=highest-price, PER-SET cap — never a global cap: it starves later
   sets). Edit the SETS table to add sets. Writes `wave2-candidates.json`.
2. `wave2-verify-chunk.js` — resumable graded-band verification (CHUNK env,
   appends `wave2-verified.jsonl`; run repeatedly until "ALL DONE"). Bar:
   ≥2 graded bands AND ≥1 accepted-grade value in $50–$3,000.
3. `wave2-codegen.py` — images (official pokemontcg.io art first via the
   PTCGIO_SET map; PriceCharting scans otherwise; NO IMAGE = NOT LISTED) +
   emits `src/lib/collectibles-catalog-wave2.ts`. Resumable (skips existing
   webp). Set SCRATCH_DIR paths before running.
4. `wave2-audit.py` — pre-ship consistency gate: slug uniqueness, cat↔sub
   validity, sport/player presence, band ordering, image files exist.
   MUST exit 0 before any catalog merge.

## Comp refresh (REQUIRED before asOf + 45 days)
Re-run stages 2-3 against the existing catalog's product URLs and bump every
`asOf`. If comps go stale the UI auto-hides the numbers (by design) — refresh
BEFORE that happens. PriceCharting extraction map:
used_price/new_price/graded_price/manual_only_price = raw/G8/G9/PSA10.
Pages 403 plain HTTP → plain puppeteer (no stealth). Image CDNs allow
direct GET (storage.googleapis.com/images.pricecharting.com, images.pokemontcg.io).
